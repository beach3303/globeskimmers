import Capacitor
import CoreLocation
import Foundation
import UserNotifications

// Border Watch (founder, 2026-11-06: "include border watch with this build"; docs/plans/border-grace.md,
// phase 3). For a road trip, ON BY THE TRAVELER and off by itself after 24 hours: the phone checks which
// state or country it is in at the points iOS hands out anyway (the significant-change service — about
// every 500 m, minutes apart, with the app closed too; iOS relaunches the app for it), keeps only the
// last state or country and the crossings it noticed, and shows one local notification per line crossed.
// Nothing leaves the phone: the crossings wait here until the app opens and reads them (drain), and the
// 48-hour window does the rest (src/lib/borderWatch.js → src/lib/crossings.js).
// The state shapes are the app's own public/data/us-states.json (the Census 1:5M lines, bundled with the
// web assets); abroad the country comes from Apple's geocoder, at most once per 2 km.
// Registered in MainViewController; JavaScript reaches it as "BorderWatch". Resumed from AppDelegate on
// every launch while a trip is on.
final class BorderWatchCore: NSObject, CLLocationManagerDelegate {
  static let shared = BorderWatchCore()
  private static let keyUntil = "gs_bw_until", keyLast = "gs_bw_last", keyCrossings = "gs_bw_crossings", keyGeo = "gs_bw_geo"
  private let defaults = UserDefaults.standard
  private var manager: CLLocationManager?
  private var shapes: [StateShape]?
  private let geocoder = CLGeocoder()

  private struct StateShape {
    let abbr: String
    let name: String
    let polys: [(outer: [[Double]], holes: [[[Double]]])]
    let bbox: [Double]   // west, south, east, north
  }

  // ── The trip ───────────────────────────────────────────────────────────────
  var until: Double { defaults.double(forKey: BorderWatchCore.keyUntil) }   // ms since 1970; 0 = off
  var isOn: Bool { until > Date().timeIntervalSince1970 * 1000 }

  func permissionWord() -> String {
    let s: CLAuthorizationStatus
    if #available(iOS 14, *) { s = ensureManager().authorizationStatus } else { s = CLLocationManager.authorizationStatus() }
    switch s {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "whenInUse"
    case .denied, .restricted: return "denied"
    default: return "unknown"
    }
  }

  func status(_ done: @escaping ([String: Any]) -> Void) {
    let on = isOn, untilMs = until, permission = permissionWord()
    UNUserNotificationCenter.current().getNotificationSettings { s in
      let allowed = s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
      done(["on": on, "until": on ? untilMs : NSNull(), "permission": permission, "notifications": allowed])
    }
  }

  // Main thread. A new trip starts from wherever the phone is now: the first reading is the baseline.
  func start(hours: Double) {
    let h = max(1, min(72, hours))
    defaults.set(Date().timeIntervalSince1970 * 1000 + h * 3600 * 1000, forKey: BorderWatchCore.keyUntil)
    defaults.removeObject(forKey: BorderWatchCore.keyLast)
    let m = ensureManager()
    m.requestAlwaysAuthorization()
    m.startMonitoringSignificantLocationChanges()
    m.requestLocation()
  }

  func stop() {
    defaults.removeObject(forKey: BorderWatchCore.keyUntil)
    defaults.removeObject(forKey: BorderWatchCore.keyLast)
    manager?.stopMonitoringSignificantLocationChanges()
  }

  // Every launch (AppDelegate): keep watching while the trip is on; tidy up once it has lapsed.
  func resumeIfOn() {
    if isOn { ensureManager().startMonitoringSignificantLocationChanges() } else if until > 0 { stop() }
  }

  // The crossings noticed since the last read, oldest first; read once.
  func drain() -> [[String: Any]] {
    let list = (defaults.array(forKey: BorderWatchCore.keyCrossings) as? [[String: Any]]) ?? []
    defaults.removeObject(forKey: BorderWatchCore.keyCrossings)
    return list
  }

  private func ensureManager() -> CLLocationManager {
    if let m = manager { return m }
    let m = CLLocationManager()
    m.delegate = self
    m.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager = m
    return m
  }

  // ── Readings ───────────────────────────────────────────────────────────────
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    guard isOn else { stop(); return }
    judge(loc)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // The next reading tries again.
  }

  private func judge(_ loc: CLLocation) {
    let acc = loc.horizontalAccuracy
    guard acc > 0, acc <= 3000 else { return }
    let lat = loc.coordinate.latitude, lng = loc.coordinate.longitude
    let at = loc.timestamp.timeIntervalSince1970 * 1000
    if let st = stateAt(lat, lng) {
      settle(cc: "US", region: st.name, abbr: st.abbr, lat: lat, lng: lng, acc: acc, at: at)
      return
    }
    // Outside every state: abroad, or at sea. The country from Apple's geocoder — a fresh ask only 2 km
    // from the last answer.
    if let g = defaults.dictionary(forKey: BorderWatchCore.keyGeo), let glat = g["lat"] as? Double, let glng = g["lng"] as? Double, let gcc = g["cc"] as? String,
       CLLocation(latitude: glat, longitude: glng).distance(from: loc) < 2000 {
      settle(cc: gcc, region: "", abbr: "", lat: lat, lng: lng, acc: acc, at: at)
      return
    }
    if geocoder.isGeocoding { return }
    geocoder.reverseGeocodeLocation(loc) { [weak self] marks, _ in
      guard let self = self, let cc = marks?.first?.isoCountryCode?.uppercased(), cc.count == 2 else { return }
      self.defaults.set(["lat": lat, "lng": lng, "cc": cc], forKey: BorderWatchCore.keyGeo)
      self.settle(cc: cc, region: "", abbr: "", lat: lat, lng: lng, acc: acc, at: at)
    }
  }

  private func settle(cc: String, region: String, abbr: String, lat: Double, lng: Double, acc: Double, at: Double) {
    let here: [String: Any] = ["cc": cc, "region": region, "abbr": abbr, "lat": lat, "lng": lng, "at": at]
    guard let last = defaults.dictionary(forKey: BorderWatchCore.keyLast), let lcc = last["cc"] as? String else {
      defaults.set(here, forKey: BorderWatchCore.keyLast)   // the baseline
      return
    }
    let labbr = (last["abbr"] as? String) ?? ""
    let moved = lcc != cc || (cc == "US" && labbr != abbr)
    if !moved { defaults.set(here, forKey: BorderWatchCore.keyLast); return }
    // Well inside the new state: the four points one reading's radius away agree. If not, this reading
    // waits for a better one; the baseline stays where it was.
    if cc == "US" {
      let r = max(acc, 300) / 1000.0
      let dlat = r / 111.2, dlng = r / (111.2 * cos(lat * .pi / 180))
      for (a, b) in [(dlat, 0.0), (-dlat, 0.0), (0.0, dlng), (0.0, -dlng)] {
        guard stateAt(lat + a, lng + b)?.abbr == abbr else { return }
      }
    }
    var list = (defaults.array(forKey: BorderWatchCore.keyCrossings) as? [[String: Any]]) ?? []
    list.append(["at": at, "lat": lat, "lng": lng, "accuracy": acc, "from": last, "to": ["cc": cc, "region": region, "abbr": abbr]])
    if list.count > 20 { list.removeFirst(list.count - 20) }
    defaults.set(list, forKey: BorderWatchCore.keyCrossings)
    defaults.set(here, forKey: BorderWatchCore.keyLast)
    notify(cc: cc, region: region, at: at)
  }

  private func notify(cc: String, region: String, at: Double) {
    let name = cc == "US" && !region.isEmpty ? region : (Locale(identifier: "en_US").localizedString(forRegionCode: cc) ?? cc)
    let c = UNMutableNotificationContent()
    c.title = "You crossed into \(name)"
    c.body = "Your border stamp is ready in GlobeSkimmers — it waits 48 hours."
    c.sound = .default
    c.threadIdentifier = "border-watch"
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "bw-\(Int(at))", content: c, trigger: nil))
  }

  // ── The state at a point (the bundled Census shapes) ───────────────────────
  private func loadShapes() -> [StateShape] {
    if let s = shapes { return s }
    var out: [StateShape] = []
    if let url = Bundle.main.url(forResource: "us-states", withExtension: "json", subdirectory: "public/data"),
       let data = try? Data(contentsOf: url),
       let fc = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let feats = fc["features"] as? [[String: Any]] {
      for f in feats {
        guard let props = f["properties"] as? [String: Any], let abbr = props["abbr"] as? String, let name = props["name"] as? String,
              let geom = f["geometry"] as? [String: Any], let type = geom["type"] as? String else { continue }
        var polys: [[[[Double]]]] = []
        if type == "Polygon", let c = geom["coordinates"] as? [[[Double]]] { polys = [c] }
        else if type == "MultiPolygon", let c = geom["coordinates"] as? [[[[Double]]]] { polys = c }
        var w = Double.infinity, s = Double.infinity, e = -Double.infinity, n = -Double.infinity
        var rings: [(outer: [[Double]], holes: [[[Double]]])] = []
        for p in polys where !p.isEmpty {
          for pt in p[0] where pt.count >= 2 { w = min(w, pt[0]); e = max(e, pt[0]); s = min(s, pt[1]); n = max(n, pt[1]) }
          rings.append((outer: p[0], holes: Array(p.dropFirst())))
        }
        out.append(StateShape(abbr: abbr, name: name, polys: rings, bbox: [w, s, e, n]))
      }
    }
    shapes = out
    return out
  }

  // Ray casting, lng/lat straight (fine for "which side of a line").
  private func inRing(_ ring: [[Double]], _ lng: Double, _ lat: Double) -> Bool {
    var inside = false
    var j = ring.count - 1
    for i in 0..<ring.count {
      let xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
      if (yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi { inside.toggle() }
      j = i
    }
    return inside
  }

  func stateAt(_ lat: Double, _ lng: Double) -> (abbr: String, name: String)? {
    for s in loadShapes() {
      let b = s.bbox
      if lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3] { continue }
      for p in s.polys where inRing(p.outer, lng, lat) && !p.holes.contains(where: { inRing($0, lng, lat) }) { return (s.abbr, s.name) }
    }
    return nil
  }
}

@objc(BorderWatchPlugin)
public class BorderWatchPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "BorderWatchPlugin"
  public let jsName = "BorderWatch"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
  ]

  // { on, until (ms) | null, permission: always | whenInUse | denied | unknown, notifications }
  @objc func status(_ call: CAPPluginCall) {
    DispatchQueue.main.async { BorderWatchCore.shared.status { call.resolve($0) } }
  }

  // { hours } — rejects "location" when the phone's location is off for the app.
  @objc func start(_ call: CAPPluginCall) {
    let hours = call.getDouble("hours") ?? 24
    DispatchQueue.main.async {
      let core = BorderWatchCore.shared
      if core.permissionWord() == "denied" { call.reject("location"); return }
      core.start(hours: hours)
      core.status { call.resolve($0) }
    }
  }

  @objc func stop(_ call: CAPPluginCall) {
    DispatchQueue.main.async {
      BorderWatchCore.shared.stop()
      BorderWatchCore.shared.status { call.resolve($0) }
    }
  }

  // { crossings: [{ at, lat, lng, accuracy, from: { cc, region, abbr, lat, lng, at }, to: { cc, region, abbr } }] }
  @objc func drain(_ call: CAPPluginCall) {
    DispatchQueue.main.async { call.resolve(["crossings": BorderWatchCore.shared.drain()]) }
  }
}
