package com.globeskimmers.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.agesignals.AgeSignalsException;
import com.google.android.play.agesignals.AgeSignalsManager;
import com.google.android.play.agesignals.AgeSignalsManagerFactory;
import com.google.android.play.agesignals.AgeSignalsRequest;

// The phone's own age answer on Android: Google's Play Age Signals (teens plan Phase 0; Google
// returns signals in Texas since 2026-05-28 and Brazil since 2026-03-17). The JS side is
// src/lib/ageSignal.js. check() asks Play silently and answers { available, lower, upper,
// source, significantChange }: bounds only when the person shares them, and the server keeps
// only the tier they imply. Every call resolves, never rejects: { available: false, error }
// without Play, or where Google has no signal. MainActivity registers this plugin: one in the
// app module isn't found on its own.
@CapacitorPlugin(name = "AgeSignals")
public class AgeSignalsPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        final AgeSignalsManager manager;
        try {
            manager = AgeSignalsManagerFactory.create(getContext());
        } catch (Exception e) {
            unavailable(call, "no_manager");
            return;
        }
        manager.checkAgeSignals(AgeSignalsRequest.builder().build())
            .addOnSuccessListener(result -> {
                JSObject out = new JSObject();
                out.put("available", true);
                if (result.ageLower() != null) out.put("lower", result.ageLower());
                if (result.ageUpper() != null) out.put("upper", result.ageUpper());
                if (result.ageRangeSource() != null) out.put("source", result.ageRangeSource());
                if (result.significantChangeStatus() != null) out.put("significantChange", result.significantChangeStatus());
                call.resolve(out);
            })
            .addOnFailureListener(e -> unavailable(call, e instanceof AgeSignalsException ? String.valueOf(((AgeSignalsException) e).getErrorCode()) : "unknown"));
    }

    private void unavailable(PluginCall call, String error) {
        JSObject out = new JSObject();
        out.put("available", false);
        out.put("error", error);
        call.resolve(out);
    }
}
