package com.globeskimmers.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.os.Build;
import android.text.format.DateFormat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Border Watch (founder, 2026-11-06: "include border watch with this build"; docs/plans/border-grace.md,
 * phase 3). For a road trip, ON BY THE TRAVELER and off by itself after 24 hours: the phone checks which
 * state or country it is in every few minutes (BorderWatchService, a foreground service with its own
 * notification, so the member always sees it is on), keeps only the last state or country and the
 * crossings it noticed, and shows one notification per line crossed. Nothing leaves the phone: the
 * crossings wait here until the app opens and reads them (drain), and the 48-hour window does the rest
 * (src/lib/borderWatch.js → src/lib/crossings.js).
 * The state shapes are the app's own public/data/us-states.json (the Census 1:5M lines, bundled with the
 * web assets); abroad the country comes from the phone's geocoder, at most once per 2 km.
 */
public final class BorderWatchCore {
  static final String PREFS = "BorderWatch";
  static final String KEY_UNTIL = "until", KEY_LAST = "last", KEY_CROSSINGS = "crossings", KEY_GEO = "geo";
  static final String CH_WATCH = "border_watch", CH_LINE = "border_line";
  static final int WATCH_NOTIF_ID = 4101;
  private static List<Shape> shapes;

  private BorderWatchCore() {}

  // ── The trip ────────────────────────────────────────────────────────────────
  static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
  static long until(Context c) { return prefs(c).getLong(KEY_UNTIL, 0L); }
  static boolean isOn(Context c) { return until(c) > System.currentTimeMillis(); }
  /** A new trip starts from wherever the phone is now: the first reading is the baseline. */
  static void setUntil(Context c, long ms) { prefs(c).edit().putLong(KEY_UNTIL, ms).remove(KEY_LAST).apply(); }
  static void clear(Context c) { prefs(c).edit().remove(KEY_UNTIL).remove(KEY_LAST).apply(); }
  /** The crossings noticed since the last read, oldest first; read once. */
  static JSONArray drain(Context c) {
    String s = prefs(c).getString(KEY_CROSSINGS, null);
    prefs(c).edit().remove(KEY_CROSSINGS).apply();
    try { return s == null ? new JSONArray() : new JSONArray(s); } catch (Exception e) { return new JSONArray(); }
  }

  // ── Readings ────────────────────────────────────────────────────────────────
  static void onFix(Context c, Location loc) {
    if (!isOn(c)) return;
    float acc = loc.getAccuracy();
    if (!loc.hasAccuracy() || acc <= 0 || acc > 3000) return;
    double lat = loc.getLatitude(), lng = loc.getLongitude();
    long at = loc.getTime() > 0 ? loc.getTime() : System.currentTimeMillis();
    String[] st = stateAt(c, lat, lng);
    if (st != null) { settle(c, "US", st[1], st[0], lat, lng, acc, at); return; }
    // Outside every state: abroad, or at sea. The country from the phone's geocoder — a fresh ask only
    // 2 km from the last answer.
    try {
      JSONObject g = new JSONObject(prefs(c).getString(KEY_GEO, "{}"));
      if (g.has("cc")) {
        float[] d = new float[1];
        Location.distanceBetween(g.getDouble("lat"), g.getDouble("lng"), lat, lng, d);
        if (d[0] < 2000) { settle(c, g.getString("cc"), "", "", lat, lng, acc, at); return; }
      }
      if (!Geocoder.isPresent()) return;
      List<Address> found = new Geocoder(c, Locale.US).getFromLocation(lat, lng, 1);
      String cc = found != null && !found.isEmpty() && found.get(0).getCountryCode() != null ? found.get(0).getCountryCode().toUpperCase(Locale.US) : null;
      if (cc == null || cc.length() != 2) return;
      prefs(c).edit().putString(KEY_GEO, new JSONObject().put("lat", lat).put("lng", lng).put("cc", cc).toString()).apply();
      settle(c, cc, "", "", lat, lng, acc, at);
    } catch (Exception ignored) {
      // The next reading tries again.
    }
  }

  private static void settle(Context c, String cc, String region, String abbr, double lat, double lng, float acc, long at) {
    try {
      JSONObject here = new JSONObject().put("cc", cc).put("region", region).put("abbr", abbr).put("lat", lat).put("lng", lng).put("at", at);
      String ls = prefs(c).getString(KEY_LAST, null);
      if (ls == null) { prefs(c).edit().putString(KEY_LAST, here.toString()).apply(); return; }   // the baseline
      JSONObject last = new JSONObject(ls);
      boolean moved = !cc.equals(last.optString("cc")) || ("US".equals(cc) && !abbr.equals(last.optString("abbr")));
      if (!moved) { prefs(c).edit().putString(KEY_LAST, here.toString()).apply(); return; }
      // Well inside the new state: the four points one reading's radius away agree. If not, this reading
      // waits for a better one; the baseline stays where it was.
      if ("US".equals(cc)) {
        double r = Math.max(acc, 300) / 1000.0;
        double dlat = r / 111.2, dlng = r / (111.2 * Math.cos(Math.toRadians(lat)));
        double[][] offs = { { dlat, 0 }, { -dlat, 0 }, { 0, dlng }, { 0, -dlng } };
        for (double[] o : offs) { String[] s2 = stateAt(c, lat + o[0], lng + o[1]); if (s2 == null || !abbr.equals(s2[0])) return; }
      }
      JSONArray list = new JSONArray(prefs(c).getString(KEY_CROSSINGS, "[]"));
      list.put(new JSONObject().put("at", at).put("lat", lat).put("lng", lng).put("accuracy", acc).put("from", last)
        .put("to", new JSONObject().put("cc", cc).put("region", region).put("abbr", abbr)));
      while (list.length() > 20) list.remove(0);
      prefs(c).edit().putString(KEY_CROSSINGS, list.toString()).putString(KEY_LAST, here.toString()).apply();
      String name = "US".equals(cc) && !region.isEmpty() ? region : new Locale("", cc).getDisplayCountry(Locale.US);
      notifyCrossing(c, name, at);
    } catch (Exception ignored) {
      // Nothing recorded; the next reading tries again.
    }
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  private static void channels(Context c) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel watch = new NotificationChannel(CH_WATCH, "Border Watch", NotificationManager.IMPORTANCE_LOW);
    watch.setDescription("Shows while Border Watch is on for a trip");
    nm.createNotificationChannel(watch);
    NotificationChannel line = new NotificationChannel(CH_LINE, "Border crossings", NotificationManager.IMPORTANCE_DEFAULT);
    line.setDescription("A state or country line you crossed, with a stamp waiting");
    nm.createNotificationChannel(line);
  }

  private static PendingIntent openApp(Context c) {
    Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    if (open == null) open = new Intent(c, MainActivity.class);
    open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    return PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
  }

  /** The foreground service's own notification: the member always sees the watch is on, and can stop it. */
  static Notification watchNotification(Context c) {
    channels(c);
    Intent stop = new Intent(c, BorderWatchService.class).setAction(BorderWatchService.ACTION_STOP);
    int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
    PendingIntent stopPi = Build.VERSION.SDK_INT >= 26 ? PendingIntent.getForegroundService(c, 1, stop, flags) : PendingIntent.getService(c, 1, stop, flags);
    String until = DateFormat.format("EEE h:mm a", until(c)).toString();
    return new NotificationCompat.Builder(c, CH_WATCH)
      .setSmallIcon(R.drawable.ic_stat_globeskimmers)
      .setColor(ContextCompat.getColor(c, R.color.gs_alert))
      .setContentTitle("Border Watch is on")
      .setContentText("Until " + until + " · your location stays on your phone")
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(openApp(c))
      .addAction(0, "Stop", stopPi)
      .build();
  }

  private static void notifyCrossing(Context c, String name, long at) {
    channels(c);
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
    String body = "Your border stamp is ready in GlobeSkimmers — it waits 48 hours.";
    Notification n = new NotificationCompat.Builder(c, CH_LINE)
      .setSmallIcon(R.drawable.ic_stat_globeskimmers)
      .setColor(ContextCompat.getColor(c, R.color.gs_alert))
      .setContentTitle("You crossed into " + name)
      .setContentText(body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(openApp(c))
      .build();
    try { NotificationManagerCompat.from(c).notify(5000 + (int) (at % 100000), n); } catch (SecurityException ignored) { /* notifications off */ }
  }

  // ── The state at a point (the bundled Census shapes) ────────────────────────
  private static final class Shape {
    final String abbr, name;
    final List<double[][]> outers = new ArrayList<>();
    final List<List<double[][]>> holes = new ArrayList<>();
    double w = 1e9, s = 1e9, e = -1e9, n = -1e9;
    Shape(String abbr, String name) { this.abbr = abbr; this.name = name; }
  }

  private static synchronized List<Shape> shapes(Context c) {
    if (shapes != null) return shapes;
    List<Shape> out = new ArrayList<>();
    try (InputStream in = c.getAssets().open("public/data/us-states.json")) {
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      byte[] buf = new byte[65536];
      int n;
      while ((n = in.read(buf)) > 0) bytes.write(buf, 0, n);
      JSONArray feats = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8)).getJSONArray("features");
      for (int i = 0; i < feats.length(); i++) {
        JSONObject f = feats.getJSONObject(i);
        JSONObject p = f.getJSONObject("properties");
        JSONObject g = f.getJSONObject("geometry");
        Shape sh = new Shape(p.getString("abbr"), p.getString("name"));
        JSONArray coords = g.getJSONArray("coordinates");
        if ("Polygon".equals(g.getString("type"))) addPoly(sh, coords);
        else if ("MultiPolygon".equals(g.getString("type"))) for (int k = 0; k < coords.length(); k++) addPoly(sh, coords.getJSONArray(k));
        out.add(sh);
      }
    } catch (Exception e) {
      // No shapes: no state lines, country lines still work.
    }
    shapes = out;
    return out;
  }

  private static void addPoly(Shape sh, JSONArray poly) throws Exception {
    List<double[][]> hs = new ArrayList<>();
    for (int r = 0; r < poly.length(); r++) {
      double[][] ring = ring(poly.getJSONArray(r));
      if (r == 0) {
        sh.outers.add(ring);
        for (double[] pt : ring) { sh.w = Math.min(sh.w, pt[0]); sh.e = Math.max(sh.e, pt[0]); sh.s = Math.min(sh.s, pt[1]); sh.n = Math.max(sh.n, pt[1]); }
      } else hs.add(ring);
    }
    sh.holes.add(hs);
  }

  private static double[][] ring(JSONArray a) throws Exception {
    double[][] out = new double[a.length()][];
    for (int i = 0; i < a.length(); i++) { JSONArray p = a.getJSONArray(i); out[i] = new double[] { p.getDouble(0), p.getDouble(1) }; }
    return out;
  }

  // Ray casting, lng/lat straight (fine for "which side of a line").
  private static boolean inRing(double[][] ring, double lng, double lat) {
    boolean inside = false;
    for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      double xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /** { abbr, name } of the state the point is in, or null. */
  static String[] stateAt(Context c, double lat, double lng) {
    for (Shape sh : shapes(c)) {
      if (lng < sh.w || lng > sh.e || lat < sh.s || lat > sh.n) continue;
      for (int i = 0; i < sh.outers.size(); i++) {
        if (!inRing(sh.outers.get(i), lng, lat)) continue;
        boolean inHole = false;
        for (double[][] h : sh.holes.get(i)) if (inRing(h, lng, lat)) { inHole = true; break; }
        if (!inHole) return new String[] { sh.abbr, sh.name };
      }
    }
    return null;
  }
}
