package com.globeskimmers.app;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

// The app's bridge. Capacitor finds npm plugins on its own; a plugin in this module has to be
// registered here, before super.onCreate, or JavaScript never reaches it.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgeSignalsPlugin.class);
        registerPlugin(VideoShrinkPlugin.class);   // clips: probe + shrink on the phone (2026-10-30)
        super.onCreate(savedInstanceState);

        // If the WebView's renderer dies (out of memory, a GPU driver fault), Capacitor answers
        // "not handled" and Android kills the whole app — it just vanishes (the founder's Samsung
        // S10, 2026-10-30: "the app closes, it doesn't move forward"). Handled here: the moment is
        // noted where the web side can read it (Preferences' CapacitorStorage, key
        // gs_webview_gone_v1 → the next start logs a webview_renderer_gone event), and the activity
        // is recreated, so the member sees the app restart instead of disappearing.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
                int priority = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null ? detail.rendererPriorityAtExit() : -1;
                Log.e("Globeskimmers", "WebView renderer gone: crashed=" + crashed + " priority=" + priority);
                try {
                    String note = "{\"at\":" + System.currentTimeMillis() + ",\"crashed\":" + crashed + ",\"priority\":" + priority
                        + ",\"url\":\"" + String.valueOf(webView.getUrl()).replace("\"", "") + "\"}";
                    getSharedPreferences("CapacitorStorage", MODE_PRIVATE).edit().putString("gs_webview_gone_v1", note).commit();
                } catch (Exception ignored) {
                    // The note is a nicety; the restart is what matters.
                }
                runOnUiThread(() -> { try { recreate(); } catch (Exception e) { finish(); } });
                return true;
            }
        });
    }
}
