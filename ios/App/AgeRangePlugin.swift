import Capacitor
import DeclaredAgeRange

@objc(AgeRangePlugin)
public class AgeRangePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "AgeRangePlugin"
  public let jsName = "AgeRange"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise)
  ]

  @objc func request(_ call: CAPPluginCall) {
    guard #available(iOS 26.0, *) else { call.resolve(["available": false]); return }
    Task { @MainActor in
      do {
        guard let vc = self.bridge?.viewController else {
          call.resolve(["available": false]); return
        }
        let service = AgeRangeService.shared
        let response = try await service.requestAgeRange(ageGates: 13, 16, 18, in: vc)
        switch response {
        case .sharing(let range):
          call.resolve([
            "available": true,
            "lower": range.lowerBound as Any,
            "upper": range.upperBound as Any,
            "parentControlled": range.activeParentalControls != nil
          ])
        case .declinedSharing:
          call.resolve(["available": true, "declined": true])
        @unknown default:
          call.resolve(["available": false])
        }
      } catch { call.resolve(["available": false]) }
    }
  }
}
