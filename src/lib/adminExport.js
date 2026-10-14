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
  try { return await saveCsvText(filename, toCsv(header, rows)); } catch { return false; }   // these callers never handled errors
}

// A finished CSV (e.g. one the worker built, already formula-safe) → the same
// hand-off. Adds the byte-order mark unless the text already starts with it.
export async function saveCsvText(filename, text) {
  const csv = String(text || "").startsWith("﻿") ? String(text) : "﻿" + String(text || "");
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share") && Capacitor.isPluginAvailable("Filesystem")) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const w = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try { await Share.share({ title: filename, files: [w.uri] }); }
    catch (e) { if (/cancel/i.test(String(e?.message || e))) return false; throw e; }   // closed the sheet → false; a real failure → the caller
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
