# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor's bridge reaches plugins through reflection: the plugin's @CapacitorPlugin annotation,
# its PluginHandle and its @PluginMethod methods. With R8 shrinking on (1.0.8, 2026-10-14) the
# release build crashed on the FIRST location permission check — NullPointerException in
# Bridge.getPermissionStates, reached from the Geolocation plugin's checkPermissions — on every
# Android phone (Play vitals 1.0.8–1.0.10; reproduced on the emulator with the obfuscated release
# build, 2026-11-01). Debug builds never showed it: R8 runs without optimization there. Keep the
# bridge, its annotations, the plugins and the geolocation library whole.
-keep class com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.ionic.libs.** { *; }
-keep class com.globeskimmers.app.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
