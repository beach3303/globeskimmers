package com.globeskimmers.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// The app's bridge. Capacitor finds npm plugins on its own; a plugin in this module has to be
// registered here, before super.onCreate, or JavaScript never reaches it.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgeSignalsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
