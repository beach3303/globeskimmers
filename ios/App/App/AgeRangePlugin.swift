import Capacitor
import DeclaredAgeRange
import PermissionKit
import StoreKit
import UIKit

// The phone's own age answer (Apple's Declared Age Range) and the age-assurance steps some
// US states require (Texas since 2026-06-04; docs/plans/teens-and-minors.md, Phase 0).
//
//   status()                    { available, eligible, features, ageRatingCode }
//                               eligible: the laws apply to this person here (iOS 26.2+);
//                               features: Apple's RegulatoryFeature names (iOS 26.4+)
//   request()                   Apple's age sheet, gates 13 / 16 / 18:
//                               { available, lower, upper, declaration, parentControlled }
//                               or { available, declined }
//   acknowledgeUpdate({ text }) Apple's sheet for a significant update (iOS 26.4+)
//   askParent({ text })         asks the parent to approve a significant update (iOS 26.2+);
//                               the answer arrives later, as the 'parentAnswer' event
//   appTransaction()            { available, id, environment }: the App Store's id for this
//                               Apple Account's download (iOS 16+). A parent's withdrawn
//                               consent (server notification RESCIND_CONSENT) names it, so
//                               the server keeps it with the account.
//
// Every call resolves, never rejects: { available: false } where the iOS has no such API.
// DeclaredAgeRange and PermissionKit are weak-linked (OTHER_LDFLAGS), so iOS 15-25 still
// launch. MainViewController registers this plugin: one in the app target isn't found alone.
@objc(AgeRangePlugin)
public class AgeRangePlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "AgeRangePlugin"
  public let jsName = "AgeRange"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "acknowledgeUpdate", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "askParent", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "appTransaction", returnType: CAPPluginReturnPromise),
  ]

  override public func load() {
    // A parent can answer days later: pass each answer on as it comes.
    if #available(iOS 26.2, *) {
      Task { [weak self] in
        for await response in AskCenter.shared.responses(for: SignificantAppUpdateTopic.self) {
          self?.notifyListeners("parentAnswer", data: ["approved": response.choice.answer == .approval], retainUntilConsumed: true)
        }
      }
    }
  }

  @objc func status(_ call: CAPPluginCall) {
    guard #available(iOS 26.2, *) else { call.resolve(["available": false]); return }
    // Three system answers, asked side by side. Any can stall (no Apple Account, offline, a
    // build not from the App Store), so the call answers after 6 s with what it has.
    let reply = Reply(call, base: ["available": true], expecting: ["eligible", "features", "ageRatingCode"], timeout: 6)
    Task {
      do { reply.set("eligible", try await AgeRangeService.shared.isEligibleForAgeFeatures) }
      catch { reply.set("eligible", nil, error: AgeRangePlugin.code(error)) }
    }
    Task {
      if #available(iOS 26.4, *), let features = try? await AgeRangeService.shared.requiredRegulatoryFeatures {
        reply.set("features", features.map(AgeRangePlugin.name).sorted())
      } else {
        reply.set("features", nil)
      }
    }
    Task { reply.set("ageRatingCode", await AppStore.ageRatingCode) }
  }

  @objc func request(_ call: CAPPluginCall) {
    guard #available(iOS 26.0, *) else { call.resolve(["available": false]); return }
    Task { @MainActor in
      guard let vc = self.bridge?.viewController else { call.resolve(["available": false]); return }
      do {
        switch try await AgeRangeService.shared.requestAgeRange(ageGates: 13, 16, 18, in: vc) {
        case .sharing(let range):
          var out: [String: Any] = ["available": true, "parentControlled": !range.activeParentalControls.isEmpty]
          if let lower = range.lowerBound { out["lower"] = lower }
          if let upper = range.upperBound { out["upper"] = upper }
          if let declaration = range.ageRangeDeclaration { out["declaration"] = AgeRangePlugin.name(declaration) }
          call.resolve(out)
        case .declinedSharing:
          call.resolve(["available": true, "declined": true])
        @unknown default:
          call.resolve(["available": false])
        }
      } catch {
        call.resolve(["available": false, "error": AgeRangePlugin.code(error)])
      }
    }
  }

  @objc func acknowledgeUpdate(_ call: CAPPluginCall) {
    let text = call.getString("text") ?? ""
    guard #available(iOS 26.4, *), !text.isEmpty else { call.resolve(["available": false]); return }
    Task { @MainActor in
      guard let scene = self.bridge?.viewController?.view.window?.windowScene else { call.resolve(["available": false]); return }
      do {
        try await AgeRangeService.shared.showSignificantUpdateAcknowledgment(in: scene, updateDescription: text)
        call.resolve(["available": true, "done": true])
      } catch {
        call.resolve(["available": true, "done": false, "error": AgeRangePlugin.code(error)])
      }
    }
  }

  @objc func askParent(_ call: CAPPluginCall) {
    let text = call.getString("text") ?? ""
    guard #available(iOS 26.2, *), !text.isEmpty else { call.resolve(["available": false]); return }
    Task { @MainActor in
      guard let vc = self.bridge?.viewController else { call.resolve(["available": false]); return }
      do {
        let question = PermissionQuestion(significantAppUpdateTopic: SignificantAppUpdateTopic(description: text))
        try await AskCenter.shared.ask(question, in: vc)
        call.resolve(["available": true, "asked": true])
      } catch {
        call.resolve(["available": true, "asked": false, "error": AgeRangePlugin.code(error)])
      }
    }
  }

  @objc func appTransaction(_ call: CAPPluginCall) {
    guard #available(iOS 16.0, *) else { call.resolve(["available": false]); return }
    Task {
      do {
        switch try await AppTransaction.shared {
        case .verified(let tx):
          call.resolve(["available": true, "id": tx.appTransactionID, "environment": tx.environment.rawValue])
        case .unverified:
          call.resolve(["available": false, "error": "unverified"])
        }
      } catch {
        call.resolve(["available": false, "error": "unknown"])
      }
    }
  }

  // How Apple knows the age: the server keeps only this word, never the range.
  @available(iOS 26.0, *)
  private static func name(_ declaration: AgeRangeService.AgeRangeDeclaration) -> String {
    switch declaration {
    case .selfDeclared: return "selfDeclared"
    case .guardianDeclared: return "guardianDeclared"
    default: break
    }
    if #available(iOS 26.2, *) {
      switch declaration {
      case .checkedByOtherMethod: return "checkedByOtherMethod"
      case .guardianCheckedByOtherMethod: return "guardianCheckedByOtherMethod"
      case .governmentIDChecked: return "governmentIDChecked"
      case .guardianGovernmentIDChecked: return "guardianGovernmentIDChecked"
      case .paymentChecked: return "paymentChecked"
      case .guardianPaymentChecked: return "guardianPaymentChecked"
      default: break
      }
    }
    if #available(iOS 26.5, *), declaration == .confirmed { return "confirmed" }
    return "other"
  }

  @available(iOS 26.4, *)
  private static func name(_ feature: AgeRangeService.RegulatoryFeature) -> String {
    switch feature {
    case .significantAppChangeRequiresAdultNotification: return "significantAppChangeRequiresAdultNotification"
    case .significantAppChangeRequiresParentalConsent: return "significantAppChangeRequiresParentalConsent"
    case .declaredAgeRangeRequired: return "declaredAgeRangeRequired"
    @unknown default: return "other"
    }
  }

  private static func code(_ error: Error) -> String {
    if #available(iOS 26.0, *), let e = error as? AgeRangeService.Error {
      switch e {
      case .notAvailable: return "notAvailable"
      case .invalidRequest: return "invalidRequest"
      case .invalidAccount: return "invalidAccount"
      case .declinedOnboarding: return "declinedOnboarding"
      case .network: return "network"
      @unknown default: return "unknown"
      }
    }
    if #available(iOS 26.1, *), error is AskError { return "askFailed" }
    return "unknown"
  }
}

// Collects a few async answers into one plugin reply: it resolves once every key has its
// answer, or at the deadline with what it has (the rest listed under "timedOut").
private final class Reply {
  private let call: CAPPluginCall
  private var out: [String: Any]
  private var waiting: Set<String>
  private var done = false
  private let lock = NSLock()

  init(_ call: CAPPluginCall, base: [String: Any], expecting: Set<String>, timeout: TimeInterval) {
    self.call = call
    self.out = base
    self.waiting = expecting
    DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { self.finish() }
  }

  func set(_ key: String, _ value: Any?, error: String? = nil) {
    lock.lock()
    if let value { out[key] = value }
    if let error { out["\(key)Error"] = error }
    waiting.remove(key)
    let complete = waiting.isEmpty
    lock.unlock()
    if complete { finish() }
  }

  private func finish() {
    lock.lock()
    if done { lock.unlock(); return }
    done = true
    if !waiting.isEmpty { out["timedOut"] = waiting.sorted() }
    let answer = out
    lock.unlock()
    call.resolve(answer)
  }
}
