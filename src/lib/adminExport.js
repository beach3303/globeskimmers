// Spreadsheet export for the Admin page (founder, 2026-10-05: "all the data you
// could capture should be exportable via spreadsheet"). CSV with a UTF-8 BOM so
// Excel, Numbers and Sheets open it cleanly. Native app: the file is written to
// cache and handed to the share sheet (Save to Files, AirDrop, mail). Web: a
// plain download.
import { Capacitor } from "@capacitor/core";

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

// header: string[]; rows: (string|number|null)[][]. Resolves true when handed
// off, false when the person closed the share sheet without saving.
export async function exportCsv(filename, header, rows) {
  const csv = "﻿" + toCsv(header, rows);
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const w = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try { await Share.share({ title: filename, files: [w.uri] }); } catch { return false; } // closed the sheet
    return true;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
