package com.globeskimmers.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * Border Watch for JavaScript (src/lib/borderWatch.js): status · start { hours } · stop · drain. The trip
 * itself runs in BorderWatchService; the judging in BorderWatchCore. Registered in MainActivity.
 */
@CapacitorPlugin(name = "BorderWatch")
public class BorderWatchPlugin extends Plugin {
  private boolean located() {
    Context c = getContext();
    return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
      || ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private boolean notifications() {
    return Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
  }

  // { on, until (ms) | null, permission: always | denied, notifications } — a foreground service needs no
  // "all the time" location on Android, so a granted location reads as "always".
  private JSObject statusObj() {
    JSObject o = new JSObject();
    boolean on = BorderWatchCore.isOn(getContext());
    o.put("on", on);
    if (on) o.put("until", BorderWatchCore.until(getContext())); else o.put("until", JSONObject.NULL);
    o.put("permission", located() ? "always" : "denied");
    o.put("notifications", notifications());
    return o;
  }

  @PluginMethod
  public void status(PluginCall call) { call.resolve(statusObj()); }

  @PluginMethod
  public void start(PluginCall call) {
    if (!located()) { call.reject("location"); return; }
    double hours = Math.max(1, Math.min(72, call.getDouble("hours", 24.0)));
    Context c = getContext();
    BorderWatchCore.setUntil(c, System.currentTimeMillis() + (long) (hours * 3600_000L));
    try { ContextCompat.startForegroundService(c, new Intent(c, BorderWatchService.class)); }
    catch (Exception e) { BorderWatchCore.clear(c); call.reject("service"); return; }
    call.resolve(statusObj());
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Context c = getContext();
    BorderWatchCore.clear(c);
    c.stopService(new Intent(c, BorderWatchService.class));
    call.resolve(statusObj());
  }

  @PluginMethod
  public void drain(PluginCall call) {
    JSObject o = new JSObject();
    o.put("crossings", BorderWatchCore.drain(getContext()));
    call.resolve(o);
  }
}
