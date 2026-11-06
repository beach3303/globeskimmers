package com.globeskimmers.app;

import android.Manifest;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The Border Watch trip on Android (2026-11-06): a foreground service — its own notification shows the
 * whole time, with Stop — asking the fused provider for a balanced-power reading every five minutes or
 * 400 m, each judged by BorderWatchCore. Ends itself at the trip's deadline, on Stop, or once location is
 * off for the app. Started by BorderWatchPlugin from the app (the only way a location foreground service
 * may start on Android 14+).
 */
public class BorderWatchService extends Service {
  static final String ACTION_STOP = "com.globeskimmers.app.BORDER_WATCH_STOP";
  private FusedLocationProviderClient client;
  private LocationCallback callback;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService worker = Executors.newSingleThreadExecutor();

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    boolean stop = intent != null && ACTION_STOP.equals(intent.getAction());
    if (stop || !BorderWatchCore.isOn(this)) { BorderWatchCore.clear(this); stopSelf(); return START_NOT_STICKY; }
    boolean allowed = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
      || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    if (!allowed) { BorderWatchCore.clear(this); stopSelf(); return START_NOT_STICKY; }
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(BorderWatchCore.WATCH_NOTIF_ID, BorderWatchCore.watchNotification(this), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
      else startForeground(BorderWatchCore.WATCH_NOTIF_ID, BorderWatchCore.watchNotification(this));
    } catch (Exception e) {
      // Android would not let a location service start here (the app is in the background): the trip ends.
      BorderWatchCore.clear(this); stopSelf(); return START_NOT_STICKY;
    }
    if (callback == null) startUpdates();
    handler.removeCallbacksAndMessages(null);
    handler.postDelayed(this::stopSelf, Math.max(1000L, BorderWatchCore.until(this) - System.currentTimeMillis()));
    return START_STICKY;
  }

  @SuppressWarnings("MissingPermission")
  private void startUpdates() {
    client = LocationServices.getFusedLocationProviderClient(this);
    LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 300_000L)
      .setMinUpdateIntervalMillis(120_000L)
      .setMinUpdateDistanceMeters(400f)
      .build();
    callback = new LocationCallback() {
      @Override
      public void onLocationResult(LocationResult r) {
        final Location l = r.getLastLocation();
        if (l != null) worker.execute(() -> BorderWatchCore.onFix(getApplicationContext(), l));
        if (!BorderWatchCore.isOn(BorderWatchService.this)) stopSelf();
      }
    };
    try { client.requestLocationUpdates(req, callback, Looper.getMainLooper()); } catch (SecurityException e) { stopSelf(); }
  }

  @Override
  public void onDestroy() {
    if (client != null && callback != null) client.removeLocationUpdates(callback);
    handler.removeCallbacksAndMessages(null);
    worker.shutdown();
    if (!BorderWatchCore.isOn(this)) BorderWatchCore.clear(this);
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
