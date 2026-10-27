// Travelers' photos of a place — their reviewed dish, drink, find and visit posts — for
// the card's photo strip, next to Google's (founder, 2026-10-26: "all photos added by
// users also go to the restaurant's photos"). Cards ask by place id; the asks made in the
// same moment go to the worker as one batch (/places/traveler-photos), and each answer is
// kept for the session. Posts are anonymous and passed photo review before they were saved.
import { useEffect, useState } from "react";
import { callWorker } from "@/lib/callWorker";

const answers = new Map();   // place id → Promise<[{ id, url, caption }]>
const listeners = new Map(); // place id → Set<(list) => void>
let queue = new Map();       // place id → resolve, for the next batch
let timer = null;

function flush() {
  timer = null;
  const q = queue;
  queue = new Map();
  const ids = [...q.keys()];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    callWorker("places/traveler-photos", { place_ids: chunk })
      .then(({ data }) => chunk.forEach((id) => q.get(id)(Array.isArray(data?.photos?.[id]) ? data.photos[id] : [])))
      .catch(() => chunk.forEach((id) => { answers.delete(id); q.get(id)([]); }));
  }
}

function ask(id) {
  if (!answers.has(id)) {
    answers.set(id, new Promise((resolve) => {
      queue.set(id, resolve);
      if (!timer) timer = setTimeout(flush, 60);
    }));
  }
  return answers.get(id);
}

/** Travelers' photos of one place: [{ id, url, caption }], newest first, at most six. */
export function useTravelerPhotos(placeId) {
  const id = placeId ? String(placeId) : "";
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!id) { setList([]); return undefined; }
    let live = true;
    const set = (l) => { if (live) setList(l); };
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(set);
    ask(id).then(set);
    return () => { live = false; listeners.get(id)?.delete(set); };
  }, [id]);
  return list;
}

/** After a traveler shares or removes a photo here: ask again, and update every card showing the place. */
export function refreshTravelerPhotos(placeId) {
  const id = placeId ? String(placeId) : "";
  if (!id) return;
  answers.delete(id);
  ask(id).then((l) => listeners.get(id)?.forEach((set) => set(l)));
}

/** The card's strip: Google's cover first, then travelers' photos, then the rest of Google's. */
export function withTravelerPhotos(google, travelers) {
  const g = (google || []).filter(Boolean);
  const t = (travelers || []).map((p) => p?.url).filter(Boolean);
  if (!t.length) return g;
  return [...new Set([...g.slice(0, 1), ...t, ...g.slice(1)])];
}
