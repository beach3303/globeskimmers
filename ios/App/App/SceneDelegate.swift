import UIKit
import Capacitor

// iPadOS 27 and the iOS 27 SDK refuse to launch an app that hasn't adopted the
// UIScene lifecycle: App Review's build 12 trapped at launch on an iPad Air in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption (2026-10-07).
// The Main storyboard (CAPBridgeViewController) still builds the window. With
// scenes, link opens and universal links arrive here instead of the app
// delegate, so they are handed to Capacitor exactly as AppDelegate did.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // A cold launch from a link or a universal link.
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
