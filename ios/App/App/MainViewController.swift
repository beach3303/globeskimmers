import Capacitor

// The app's bridge (Main.storyboard). Capacitor finds npm plugins on its own, but a plugin
// that lives in this target has to be registered here, or JavaScript never reaches it:
// AgeRangePlugin went unregistered from September to October 2026 and every age answer
// came back "unavailable".
class MainViewController: CAPBridgeViewController {
  override open func capacitorDidLoad() {
    bridge?.registerPluginInstance(AgeRangePlugin())
    bridge?.registerPluginInstance(VideoShrinkPlugin())   // clips: probe + shrink on the phone (2026-10-30)
  }
}
