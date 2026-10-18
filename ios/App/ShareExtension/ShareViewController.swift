import UIKit
import ImageIO
import UniformTypeIdentifiers

// "Globeskimmers" in the Photos share sheet (2026-10-17: a photo shared from the gallery found no
// Globeskimmers to send it to). Each shared photo is copied into the app group as a JPEG that keeps
// its own location tag and capture time, the proof "Stamp a place" reads, and the app opens at
// globeskimmers://share, where @capgo/capacitor-share-target hands the files to
// src/lib/sharedPhotos.js. The plugin also looks each time the app comes forward, so a phone that
// won't let an extension open its app still gets the photos on the next open. The app group id
// must match capacitor.config.ts and both targets' entitlements.
class ShareViewController: UIViewController {
    private let appGroupId = "group.com.globeskimmers.app"
    private let dataKey = "share-target-data"
    // NSExtensionActivationSupportsImageWithMaxCount in Info.plist is the same 10: past it the
    // share sheet drops Globeskimmers from the list. A stamp keeps the first 4.
    private let maxPhotos = 10
    // The app resizes to 1280 before upload; this keeps the copy small without losing detail.
    private let maxPixels = 2560

    private let ivory = UIColor(red: 1, green: 0.988, blue: 0.969, alpha: 1)        // #FFFCF7
    private let ink = UIColor(red: 0.086, green: 0.067, blue: 0.051, alpha: 1)      // #16110D
    private let ink3 = UIColor(red: 0.451, green: 0.4, blue: 0.341, alpha: 1)       // #736657
    private let stamp = UIColor(red: 0.69, green: 0.278, blue: 0.184, alpha: 1)     // #B0472F

    private let card = UIView()
    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let doneButton = UIButton(type: .system)
    private var started = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)

        card.backgroundColor = ivory
        card.layer.cornerRadius = 20
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        titleLabel.text = "Globeskimmers"
        titleLabel.font = UIFont(name: "Georgia", size: 22) ?? .systemFont(ofSize: 22, weight: .semibold)
        titleLabel.textColor = ink
        bodyLabel.text = "Adding your photos…"
        bodyLabel.font = .systemFont(ofSize: 15)
        bodyLabel.textColor = ink3
        bodyLabel.numberOfLines = 0
        bodyLabel.textAlignment = .center
        spinner.color = ink3
        spinner.startAnimating()
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.backgroundColor = stamp
        doneButton.layer.cornerRadius = 12
        doneButton.isHidden = true
        doneButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [titleLabel, spinner, bodyLabel, doneButton])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 300),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 28),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -24),
            doneButton.heightAnchor.constraint(equalToConstant: 46),
            doneButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true
        Task { await handOver() }
    }

    private func handOver() async {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
            .filter { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
            .prefix(maxPhotos)
        guard let dir = sharedDir() else { return show("These photos couldn’t be added. Try again from Globeskimmers.") }
        var files: [[String: Any]] = []
        for provider in providers {
            if let url = await copyPhoto(provider, into: dir) {
                files.append(["uri": url.path, "name": url.lastPathComponent, "mimeType": "image/jpeg"])
            }
        }
        guard !files.isEmpty else { return show("These photos couldn’t be read. Try another photo.") }
        UserDefaults(suiteName: appGroupId)?.set(["title": "", "texts": [String](), "files": files], forKey: dataKey)
        openApp(URL(string: "globeskimmers://share")!) { [weak self] opened in
            if opened { self?.close() } else { self?.show("Your photos are ready. Open Globeskimmers to stamp them.") }
        }
    }

    // <app group>/SharedPhotos, cleared of copies over a day old (the app reads them right away).
    private func sharedDir() -> URL? {
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else { return nil }
        let dir = root.appendingPathComponent("SharedPhotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let old = Date().addingTimeInterval(-24 * 60 * 60)
        for f in (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            if let d = (try? f.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate, d < old {
                try? FileManager.default.removeItem(at: f)
            }
        }
        return dir
    }

    private func copyPhoto(_ provider: NSItemProvider, into dir: URL) async -> URL? {
        let out = dir.appendingPathComponent("share-\(UUID().uuidString).jpg")
        return await withCheckedContinuation { (done: CheckedContinuation<URL?, Never>) in
            // The Photos app hands over the original file (HEIC or JPEG), valid only inside this block.
            provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
                if let url, let src = CGImageSourceCreateWithURL(url as CFURL, nil), self.writeJPEG(src, to: out) {
                    done.resume(returning: out)
                    return
                }
                // Other apps may share the image itself rather than a file.
                provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, _ in
                    var src: CGImageSource?
                    if let u = item as? URL { src = CGImageSourceCreateWithURL(u as CFURL, nil) }
                    else if let d = item as? Data { src = CGImageSourceCreateWithData(d as CFData, nil) }
                    else if let img = item as? UIImage, let d = img.jpegData(compressionQuality: 0.9) { src = CGImageSourceCreateWithData(d as CFData, nil) }
                    done.resume(returning: src.map { self.writeJPEG($0, to: out) } == true ? out : nil)
                }
            }
        }
    }

    // A JPEG (src/lib/photoExif.js reads JPEG only) with the photo's own EXIF and GPS kept. The
    // thumbnail is drawn upright, so the orientation tag resets to 1.
    private func writeJPEG(_ src: CGImageSource, to out: URL) -> Bool {
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary),
              let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return false }
        var props = (CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]) ?? [:]
        props[kCGImagePropertyOrientation] = 1
        if var tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] {
            tiff[kCGImagePropertyTIFFOrientation] = 1
            props[kCGImagePropertyTIFFDictionary] = tiff
        }
        props[kCGImageDestinationLossyCompressionQuality] = 0.88
        CGImageDestinationAddImage(dest, image, props as CFDictionary)
        return CGImageDestinationFinalize(dest)
    }

    // An extension has no UIApplication.shared; the app object is found up the responder chain and
    // its openURL:options:completionHandler: is called through the runtime, since the Swift
    // method is marked unavailable to extensions.
    private func openApp(_ url: URL, then: @escaping (Bool) -> Void) {
        let sel = NSSelectorFromString("openURL:options:completionHandler:")
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication, app.responds(to: sel), let imp = app.method(for: sel) {
                typealias OpenFn = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, (@convention(block) (Bool) -> Void)?) -> Void
                let open = unsafeBitCast(imp, to: OpenFn.self)
                let block: @convention(block) (Bool) -> Void = { ok in DispatchQueue.main.async { then(ok) } }
                open(app, sel, url as NSURL, NSDictionary(), block)
                return
            }
            responder = r.next
        }
        then(false)
    }

    private func show(_ message: String) {
        DispatchQueue.main.async {
            self.spinner.stopAnimating()
            self.spinner.isHidden = true
            self.bodyLabel.text = message
            self.bodyLabel.textColor = self.ink
            self.doneButton.isHidden = false
        }
    }

    @objc private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
