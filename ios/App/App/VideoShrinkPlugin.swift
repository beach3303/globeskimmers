import AVFoundation
import Capacitor
import Foundation

// VideoShrink (founder, 2026-10-30: 20-second clips on R2, shrunk on the phone). Two calls:
//   probe  { path } → { duration, width, height, size, lat?, lng?, takenAt? } — read from the clip's own
//          metadata (the QuickTime location and creation date iPhones write), no decode;
//   shrink { path, start, duration, maxHeight } → { path, duration, size } — the chosen seconds exported
//          as 720p H.264 MP4 (AVAssetExportSession), a few MB instead of a hundred.
// Registered in MainViewController (a plugin in this target is not found on its own); JavaScript
// reaches it as "VideoShrink" (src/lib/videoShrink.js). Paths come from the native picker.
@objc(VideoShrinkPlugin)
public class VideoShrinkPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "VideoShrinkPlugin"
  public let jsName = "VideoShrink"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "probe", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "shrink", returnType: CAPPluginReturnPromise),
  ]

  private func fileURL(_ call: CAPPluginCall) -> URL? {
    guard let p = call.getString("path"), !p.isEmpty else { return nil }
    if p.hasPrefix("file://") { return URL(string: p) }
    return URL(fileURLWithPath: p)
  }

  // "+34.1016-118.3267+045.000/" → (lat, lng)
  private func parseISO6709(_ s: String) -> (Double, Double)? {
    guard let re = try? NSRegularExpression(pattern: "([+-]\\d+\\.\\d+)([+-]\\d+\\.\\d+)"),
          let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)),
          let r1 = Range(m.range(at: 1), in: s), let r2 = Range(m.range(at: 2), in: s),
          let lat = Double(s[r1]), let lng = Double(s[r2]) else { return nil }
    return (lat, lng)
  }

  // Local time, "2026-10-24T18:03:11" — the shape the worker's taken_at takes (as a photo's EXIF).
  private static func stamp(_ d: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
    return f.string(from: d)
  }

  @objc func probe(_ call: CAPPluginCall) {
    guard let url = fileURL(call) else { call.reject("No clip path"); return }
    guard #available(iOS 16, *) else { call.reject("Clips need iOS 16"); return }
    let asset = AVURLAsset(url: url)
    Task {
      do {
        let duration = try await asset.load(.duration).seconds
        var width = 0, height = 0
        if let track = try await asset.loadTracks(withMediaType: .video).first {
          let size = try await track.load(.naturalSize)
          let transform = try await track.load(.preferredTransform)
          let rect = CGRect(origin: .zero, size: size).applying(transform)
          width = Int(abs(rect.width))
          height = Int(abs(rect.height))
        }
        let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        var out: [String: Any] = ["duration": duration, "width": width, "height": height, "size": bytes]
        for item in try await asset.load(.metadata) {
          let locationKey = item.commonKey == .commonKeyLocation
            || item.identifier == .quickTimeMetadataLocationISO6709
            || item.identifier == .quickTimeUserDataLocationISO6709
          if locationKey, let s = try? await item.load(.stringValue), let (lat, lng) = parseISO6709(s) {
            out["lat"] = lat
            out["lng"] = lng
          }
          let dateKey = item.commonKey == .commonKeyCreationDate
            || item.identifier == .quickTimeMetadataCreationDate
            || item.identifier == .quickTimeUserDataCreationDate
          if dateKey {
            if let d = try? await item.load(.dateValue) { out["takenAt"] = Self.stamp(d) }
            else if let s = try? await item.load(.stringValue), s.count >= 19 { out["takenAt"] = String(s.prefix(19)) }
          }
        }
        call.resolve(out)
      } catch {
        call.reject("Couldn’t read this clip: \(error.localizedDescription)")
      }
    }
  }

  @objc func shrink(_ call: CAPPluginCall) {
    guard let url = fileURL(call) else { call.reject("No clip path"); return }
    guard #available(iOS 16, *) else { call.reject("Clips need iOS 16"); return }
    let start = call.getDouble("start") ?? 0
    let maxSeconds = call.getDouble("duration") ?? 20
    let maxHeight = call.getInt("maxHeight") ?? 720
    let asset = AVURLAsset(url: url)
    Task {
      do {
        let total = try await asset.load(.duration).seconds
        let s = max(0, min(start, max(0, total - 0.5)))
        let len = max(0.5, min(maxSeconds, total - s))
        let preset = maxHeight > 720 ? AVAssetExportPreset1920x1080 : AVAssetExportPreset1280x720
        guard let export = AVAssetExportSession(asset: asset, presetName: preset) else {
          call.reject("Couldn’t prepare the export")
          return
        }
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("gs-clip-\(UUID().uuidString).mp4")
        export.outputURL = out
        export.outputFileType = .mp4
        export.shouldOptimizeForNetworkUse = true
        export.timeRange = CMTimeRange(start: CMTime(seconds: s, preferredTimescale: 600), duration: CMTime(seconds: len, preferredTimescale: 600))
        await export.export()
        if export.status == .completed {
          let bytes = (try? FileManager.default.attributesOfItem(atPath: out.path)[.size] as? Int) ?? 0
          call.resolve(["path": out.absoluteString, "duration": len, "size": bytes])
        } else {
          call.reject("Couldn’t shrink this clip: \(export.error?.localizedDescription ?? "unknown")")
        }
      } catch {
        call.reject("Couldn’t shrink this clip: \(error.localizedDescription)")
      }
    }
  }
}
