// BoardPostcards — the home of a member's postcards on City Boards (founder, 2026-10-28: "should
// we have a home for posted postcards in city boards next to the folder contribution in profile?
// i think so"): the second envelope in the albums' corner, under Contribute to City Boards. It
// opens a sheet listing every card they posted to a city, state or country board, newest first,
// with Delete on each — a card comes off its board for good (photo, likes and comments too).
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, X } from "lucide-react";
import PostcardCard from "@/components/social/PostcardCard";
import { showToast } from "@/components/Toast";
import { useDismissable } from "@/lib/dismissStack";
import { getHandle } from "@/lib/passport";
import { listBoardPostcards, deleteBoardPostcard, boardWord } from "@/lib/boardPostcards";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const AIR_BLUE = "#1F4E8C", AIR_RED = "#B0472F";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function BoardPostcards() {
  const [items, setItems] = useState(null);   // the member's board cards, newest first
  const [open, setOpen] = useState(false);
  const load = () => listBoardPostcards().then((r) => { if (!r.error) setItems(r.items); });
  useEffect(() => { load(); }, []);
  const count = items?.length || 0;
  return (
    <>
      <Envelope count={count} peek={items?.[0]?.photo || null} onOpen={() => setOpen(true)} />
      {open ? <BoardPostcardsSheet items={items || []} onChanged={load} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// The envelope on the shelf: airmail stripes, a postcard badge, the newest card peeking out.
function Envelope({ count, peek, onOpen }) {
  return (
    <button type="button" onClick={onOpen}
      aria-label={`My postcards, sent to City Boards.${count ? ` ${plural(count, "card", "cards")}.` : " None yet."} See them`}
      className="block w-full active:scale-95 transition-transform" style={{ background: "transparent", border: 0, padding: 0 }}>
      <div style={{ position: "relative", height: 118 }}>
        {peek ? (
          <div aria-hidden style={{ position: "absolute", left: 12, right: 12, top: 0, height: 72, borderRadius: 6, overflow: "hidden", background: "#8FB2C8", transform: "rotate(3deg)", border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" }}>
            <img src={peek} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          <div aria-hidden style={{ position: "absolute", left: 14, right: 14, top: 2, height: 70, borderRadius: 6, background: "rgba(176,71,47,.06)", border: `1.5px dashed ${AIR_RED}`, transform: "rotate(3deg)", display: "grid", placeItems: "start center", paddingTop: 8 }}>
            <Mail size={20} color={AIR_RED} strokeWidth={2} />
          </div>
        )}
        <span aria-hidden="true" style={{ position: "absolute", top: -6, right: -6, zIndex: 3, width: 30, height: 30, borderRadius: 999, background: AIR_RED, display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,.22)", border: "2px solid #fff" }}>
          <Mail size={15} color="#fff" strokeWidth={2.4} />
        </span>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderRadius: 10, overflow: "hidden", background: "#FFFDF8", border: `1.5px solid ${AIR_BLUE}`, boxShadow: "0 4px 10px -6px rgba(0,0,0,.3)", zIndex: 2 }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, padding: 4, background: `repeating-linear-gradient(135deg, ${AIR_RED} 0 8px, #FFFDF8 8px 14px, ${AIR_BLUE} 14px 22px, #FFFDF8 22px 28px)` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 6, background: "#FFFDF8" }} />
          </div>
          <div className="absolute inset-x-0 text-center px-2" style={{ bottom: 9 }}>
            <div className="truncate" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs(13.5), color: AIR_BLUE, letterSpacing: ".03em" }}>MY POSTCARDS</div>
            <div className="truncate" style={{ fontFamily: MONO, fontSize: fs(8), color: AIR_RED, letterSpacing: ".12em" }}>
              SENT TO BOARDS · {count ? plural(count, "CARD", "CARDS") : "NONE YET"}
            </div>
          </div>
        </div>
      </div>
      {/* Plain words (founder, 2026-10-30: "make it clear postcards that were sent to city board"). */}
      <span aria-hidden="true" className="block text-center" style={{ marginTop: 6, color: AIR_BLUE, fontSize: fs(12), fontWeight: 700, lineHeight: 1.25 }}>
        {count ? "See the postcards you sent" : "Postcards you send to a board"}
      </span>
      <span aria-hidden="true" className="block text-center" style={{ marginTop: 1, color: INK3, fontSize: fs(10.5), lineHeight: 1.3 }}>
        {count ? "Only the ones sent to City Boards" : "Post one from any board"}
      </span>
    </button>
  );
}

function BoardPostcardsSheet({ items, onChanged, onClose }) {
  useDismissable(true, onClose);
  const [me, setMe] = useState(null);
  useEffect(() => { getHandle().then((r) => setMe(r?.handle || null)).catch(() => {}); }, []);
  // Newest first, grouped by board, newest board first.
  const groups = useMemo(() => {
    const by = new Map();
    for (const it of items) { const k = `${it.board?.name || "A board"}|${boardWord(it.board)}`; if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
    return [...by.entries()];
  }, [items]);
  const remove = async (it) => {
    const r = await deleteBoardPostcard(it.id);
    if (!r.ok) { showToast(r.error || "Couldn’t delete it — try again", "error"); return false; }
    showToast(`Taken off ${it.board?.name || "the"}’s board`, "success");
    onChanged();
    return true;
  };
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 9997, background: "rgba(22,17,13,.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Your postcards on City Boards" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-2xl overflow-y-auto" style={{ maxHeight: "92vh", background: "#F3EEE1", borderRadius: "22px 22px 0 0", padding: "14px 18px calc(24px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: "rgba(22,17,13,.18)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: fs(9.5), letterSpacing: ".2em", color: AIR_RED }}>City Boards · Public</div>
            <h2 style={{ margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(26), fontWeight: 400, lineHeight: 1.1, color: INK }}>My postcards on <em style={{ fontStyle: "italic", color: AIR_BLUE }}>City Boards</em></h2>
            <p style={{ margin: "4px 0 0", fontSize: fs(14), lineHeight: 1.4, color: INK2 }}>
              Every card you posted to a city, state or country board. Delete any of them any time: it comes off the board for good, likes and comments too.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ flex: "none", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "transparent", border: 0, color: INK2, cursor: "pointer" }}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {groups.length ? (
          groups.map(([k, list]) => {
            const [name, word] = k.split("|");
            return (
              <section key={k} aria-label={`${name}’s ${word}, ${plural(list.length, "card", "cards")}`} style={{ marginTop: 16 }}>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontFamily: SERIF, fontSize: fs(18), color: INK }}>{name}</span>
                  <span className="uppercase" style={{ fontFamily: MONO, fontSize: fs(8.5), letterSpacing: ".14em", color: INK3 }}>{word} · {plural(list.length, "card", "cards")}</span>
                </div>
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  {list.map((it) => (
                    <PostcardCard key={it.id} me={me}
                      row={{ id: it.id, photo: it.photo, message: it.message, place: it.place, dish: it.dish, city: it.board?.city, region: it.board?.region, country: it.board?.country, created_at: it.created_at, by: { handle: me }, anon: null }}
                      onDelete={() => remove(it)} deleteLine={`It comes off ${name}’s ${word} for good, likes and comments too.`} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ marginTop: 16, padding: "18px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${RULE}`, textAlign: "center" }}>
            <Mail size={28} strokeWidth={1.6} color={AIR_BLUE} aria-hidden="true" style={{ display: "block", margin: "0 auto" }} />
            <p style={{ margin: "8px 0 0", fontFamily: SERIF, fontSize: fs(18), color: INK }}>Nothing on a board yet</p>
            <p style={{ margin: "4px auto 0", maxWidth: "34ch", fontSize: fs(13), lineHeight: 1.5, color: INK2 }}>Open any City Board, tap Post to this board, and send a postcard. It shows here the moment it’s up.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
