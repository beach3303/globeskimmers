package com.globeskimmers.app;

import android.media.MediaMetadataRetriever;
import android.net.Uri;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.Collections;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * VideoShrink (founder, 2026-10-30: 20-second clips on R2, shrunk on the phone). Two calls:
 *   probe  { path } → { duration, width, height, size, lat?, lng?, takenAt? } — from the clip's own
 *          metadata (MediaMetadataRetriever), no decode;
 *   shrink { path, start, duration, maxHeight } → { path, duration, size } — the chosen seconds exported
 *          as 720p H.264 / AAC MP4 (Media3 Transformer), a few MB instead of a hundred.
 * Registered in MainActivity; JavaScript reaches it as "VideoShrink" (src/lib/videoShrink.js).
 */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "VideoShrink")
public class VideoShrinkPlugin extends Plugin {
  private static final Pattern ISO6709 = Pattern.compile("([+-]\\d+\\.\\d+)([+-]\\d+\\.\\d+)");

  private static Uri uriOf(String path) {
    return path.startsWith("/") ? Uri.fromFile(new File(path)) : Uri.parse(path);
  }

  @PluginMethod
  public void probe(PluginCall call) {
    String path = call.getString("path");
    if (path == null || path.isEmpty()) { call.reject("No clip path"); return; }
    MediaMetadataRetriever r = new MediaMetadataRetriever();
    try {
      Uri uri = uriOf(path);
      r.setDataSource(getContext(), uri);
      JSObject out = new JSObject();
      String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
      out.put("duration", d == null ? 0 : Long.parseLong(d) / 1000.0);
      String w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
      String h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
      String rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
      int wi = w == null ? 0 : Integer.parseInt(w), hi = h == null ? 0 : Integer.parseInt(h);
      boolean turned = "90".equals(rot) || "270".equals(rot);
      out.put("width", turned ? hi : wi);
      out.put("height", turned ? wi : hi);
      String p = uri.getPath();
      File f = p == null ? null : new File(p);
      out.put("size", f != null && f.exists() ? f.length() : 0);
      // "+34.1016-118.3267/" — the location most camera apps write.
      String loc = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_LOCATION);
      if (loc != null) {
        Matcher m = ISO6709.matcher(loc);
        if (m.find()) { out.put("lat", Double.parseDouble(m.group(1))); out.put("lng", Double.parseDouble(m.group(2))); }
      }
      // "20261024T180311.000Z" → "2026-10-24T18:03:11" (the worker's taken_at shape)
      String date = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE);
      if (date != null && date.length() >= 15 && date.charAt(8) == 'T') {
        out.put("takenAt", date.substring(0, 4) + "-" + date.substring(4, 6) + "-" + date.substring(6, 8) + "T" + date.substring(9, 11) + ":" + date.substring(11, 13) + ":" + date.substring(13, 15));
      }
      call.resolve(out);
    } catch (Exception e) {
      call.reject("Couldn’t read this clip: " + e.getMessage());
    } finally {
      try { r.release(); } catch (Exception ignored) { /* nothing to release */ }
    }
  }

  @PluginMethod
  public void shrink(PluginCall call) {
    String path = call.getString("path");
    if (path == null || path.isEmpty()) { call.reject("No clip path"); return; }
    double start = call.getDouble("start", 0.0);
    double maxSeconds = call.getDouble("duration", 20.0);
    int maxHeight = call.getInt("maxHeight", 720);
    final File out = new File(getContext().getCacheDir(), "gs-clip-" + UUID.randomUUID() + ".mp4");
    final double s = Math.max(0, start);
    final Uri uri = uriOf(path);
    // The short side comes down to maxHeight (a portrait clip keeps its height, 720 × 1280), and
    // nothing is scaled up: the effect takes a height, so it's worked out from the upright frame.
    int outHeight = maxHeight;
    MediaMetadataRetriever r = new MediaMetadataRetriever();
    try {
      r.setDataSource(getContext(), uri);
      String w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
      String h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
      String rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
      if (w != null && h != null) {
        int wi = Integer.parseInt(w), hi = Integer.parseInt(h);
        boolean turned = "90".equals(rot) || "270".equals(rot);
        int upW = turned ? hi : wi, upH = turned ? wi : hi;
        int shortSide = Math.min(upW, upH);
        if (shortSide > 0) outHeight = Math.min(upH, (int) Math.round(upH * (Math.min(maxHeight, shortSide) / (double) shortSide)));
        if (outHeight % 2 == 1) outHeight -= 1;
      }
    } catch (Exception ignored) {
      // Unknown size: the default height.
    } finally {
      try { r.release(); } catch (Exception ignored) { /* nothing to release */ }
    }
    final int height = Math.max(2, outHeight);
    MediaItem item = new MediaItem.Builder()
      .setUri(uri)
      .setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder()
        .setStartPositionMs((long) (s * 1000))
        .setEndPositionMs((long) ((s + maxSeconds) * 1000))
        .build())
      .build();
    final EditedMediaItem edited = new EditedMediaItem.Builder(item)
      .setEffects(new Effects(Collections.emptyList(), Collections.singletonList(Presentation.createForHeight(height))))
      .build();
    // The transformer runs on the thread that builds it, and that thread needs a Looper: the
    // main thread, where its callbacks also land.
    getActivity().runOnUiThread(() -> {
      try {
        Transformer transformer = new Transformer.Builder(getContext())
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .addListener(new Transformer.Listener() {
            @Override
            public void onCompleted(Composition composition, ExportResult result) {
              JSObject o = new JSObject();
              o.put("path", Uri.fromFile(out).toString());
              o.put("duration", result.durationMs > 0 ? result.durationMs / 1000.0 : maxSeconds);
              o.put("size", out.length());
              call.resolve(o);
            }

            @Override
            public void onError(Composition composition, ExportResult result, ExportException exception) {
              call.reject("Couldn’t shrink this clip: " + exception.getMessage());
            }
          })
          .build();
        transformer.start(edited, out.getAbsolutePath());
      } catch (Exception e) {
        call.reject("Couldn’t shrink this clip: " + e.getMessage());
      }
    });
  }
}
