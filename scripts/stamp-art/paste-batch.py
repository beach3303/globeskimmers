#!/usr/bin/env python3
"""A batch of stamps the founder PASTED into the chat → the Stamp inbox, trimmed and named.

Pasted images land on disk as <session>/images/NN.png with a thin black frame baked in. Usage:
    python3 scripts/stamp-art/paste-batch.py <images dir> <batch tag> NN="Place Name" NN="Place Name" …
For each NN: trim the dark frame (walk inward from the middle of each edge), save as "<Place Name>.png" into
~/Desktop/Stamp inbox/ (the full set, for the final upload.sh) AND into <scratch>/batch-<tag>/ (this batch alone),
then run intake on this batch only:  STAMP_INBOX=<scratch>/batch-<tag> python3 scripts/stamp-art/intake.py --country China --pad
No PIL on this Mac: sips converts to BMP for the pixel walk and does the crop."""
import os, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INBOX = Path(os.environ.get("STAMP_INBOX") or Path.home() / "Desktop" / "Stamp inbox")
SCRATCH = Path(os.environ.get("STAMP_SCRATCH") or "/tmp/stamp-batches")

def frame(p, tmp):
    out = tmp / (p.stem + ".bmp"); subprocess.run(["sips", "-s", "format", "bmp", str(p), "--out", str(out)], capture_output=True)
    b = open(out, "rb").read(); off = int.from_bytes(b[10:14], "little"); w = int.from_bytes(b[18:22], "little")
    h = int.from_bytes(b[22:26], "little", signed=True); bpp = int.from_bytes(b[28:30], "little") // 8
    flip = h > 0; h = abs(h); stride = (w * bpp + 3) // 4 * 4
    def dark(x, y):
        row = (h - 1 - y) if flip else y; i = off + row * stride + x * bpp
        return b[i] < 40 and b[i + 1] < 40 and b[i + 2] < 40
    def run(pts):
        n = 0
        for x, y in pts:
            if dark(x, y): n += 1
            else: break
        return n
    mx, my = w // 2, h // 2
    L = run((x, my) for x in range(0, 40)); R = run((x, my) for x in range(w - 1, w - 41, -1))
    T = run((mx, y) for y in range(0, 40)); B = run((mx, y) for y in range(h - 1, h - 41, -1))
    out.unlink(missing_ok=True)
    return w, h, L, R, T, B

def main():
    if len(sys.argv) < 4: print(__doc__); sys.exit(1)
    src = Path(sys.argv[1]); tag = sys.argv[2]
    batch = SCRATCH / f"batch-{tag}"; batch.mkdir(parents=True, exist_ok=True); INBOX.mkdir(parents=True, exist_ok=True)
    tmp = SCRATCH / "tmp"; tmp.mkdir(exist_ok=True)
    for arg in sys.argv[3:]:
        nn, _, name = arg.partition("="); name = name.strip().strip('"')
        p = src / f"{nn}.png"
        if not p.exists(): print(f"  missing: {p}"); continue
        w, h, L, R, T, B = frame(p, tmp); pad = 2
        dst = batch / f"{name}.png"
        if max(L, R, T, B):
            cw, ch = w - L - R - 2 * pad, h - T - B - 2 * pad
            subprocess.run(["sips", "-c", str(ch), str(cw), "--cropOffset", str(T + pad), str(L + pad), str(p), "--out", str(dst)], capture_output=True)
            how = f"frame {L}/{R}/{T}/{B} → {cw}×{ch}"
        else:
            subprocess.run(["cp", str(p), str(dst)]); how = f"{w}×{h}, no frame"
        subprocess.run(["cp", str(dst), str(INBOX / dst.name)])
        print(f"  {nn}.png → {dst.name}  ({how})")
    print(f"\nbatch folder: {batch}\n")
    env = dict(os.environ, STAMP_INBOX=str(batch))
    subprocess.run([sys.executable, str(REPO / "scripts" / "stamp-art" / "intake.py"), "--country", "China", "--pad"], env=env)

if __name__ == "__main__": main()
