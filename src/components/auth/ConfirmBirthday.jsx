// ConfirmBirthday: the one question for an account in the 'confirm' tier
// (go-live decision 2, 2026-10-13). The account holds a birth year but no
// month or day, and that year could fall on either side of a birthday that
// matters, so the worker can't place the age: stamping and posting wait
// (403 confirm_birthday) and nothing on the account is deleted. This asks
// for the month and day once (never the year again, never a hint of which
// age matters), shows one neutral check of the WHOLE date ("Is your birthday
// March 14, 2013?", teens plan section 3) so a typo in the stored year can be
// caught, and saves. "The year is wrong" writes to us instead of saving (a
// correction to the year goes through support). The worker recomputes the
// tier from the full birthday; AuthContext re-reads it and App.jsx shows what
// that tier gets.
// "Not now" is a real choice: the travel tools keep working, the sheet stays
// away for the rest of the session, and it comes back only when a stamp or a
// post needs it (callWorker announces the refusal, src/lib/ageGate.js).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/Toast";
import { useOverlayClose } from "@/components/home/SuggestPlaceSection";
import { getAgeInfo, setBirthday, setAgeGate, splitDob } from "@/lib/passport";
import { AGE_GATE_EVENT } from "@/lib/ageGate";

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const INK = "#16110D", INK2 = "#3A3128", INK3 = "#736657", RULE = "rgba(22,17,13,.12)";
const IVORY = "#FFFCF7", STAMP = "#B0472F";
const fs = (px) => `calc(${px}px * var(--fs, 1))`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Days a month can have. February keeps the 29th: the year isn't asked again.
const daysIn = (m) => (m === 2 ? 29 : [4, 6, 9, 11].includes(m) ? 30 : 31);
const LATER_KEY = "gs_bday_confirm_later";
// Where a wrong stored year goes (the founder's mailbox, as on FrozenScreen).
const CORRECT_TO = "founder@globeskimmers.io";
const laterThisSession = () => { try { return sessionStorage.getItem(LATER_KEY) === "1"; } catch { return false; } };
const rememberLater = () => { try { sessionStorage.setItem(LATER_KEY, "1"); } catch { /* asks again next open */ } };

export default function ConfirmBirthday() {
  const { user, socialTier, refreshSocialTier } = useAuth();
  const [asked, setAsked] = useState(false);          // a refused stamp or post needs it now
  const [later, setLater] = useState(laterThisSession); // "Not now", this session
  const open = asked || (socialTier === "confirm" && !later);

  useEffect(() => {
    const onAgeGate = (e) => { if (e?.detail?.code === "confirm_birthday") setAsked(true); };
    window.addEventListener(AGE_GATE_EVENT, onAgeGate);
    return () => window.removeEventListener(AGE_GATE_EVENT, onAgeGate);
  }, []);

  const putAway = () => { rememberLater(); setLater(true); setAsked(false); };
  const saved = async () => {
    putAway();
    const tier = await refreshSocialTier();
    // A frozen account gets FrozenScreen next; a cheerful toast would be wrong there.
    if (tier !== "blocked") showToast("Saved privately 🎂", "success");
  };
  // Month and day were saved already (another screen, another device): nothing to ask.
  const nothingToAsk = () => { putAway(); refreshSocialTier(); };

  if (!open) return null;
  return <ConfirmSheet onLater={putAway} onSaved={saved} onNothingToAsk={nothingToAsk} account={user} />;
}

function ConfirmSheet({ onLater, onSaved, onNothingToAsk, account }) {
  const [phase, setPhase] = useState("loading"); // loading | ask | check | saving
  const [needYear, setNeedYear] = useState(false); // no birth year either: ask the full date
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [dob, setDob] = useState("");               // 'YYYY-MM-DD', only when needYear
  const [storedYear, setStoredYear] = useState(null); // the year on the account, read back in the check
  const [err, setErr] = useState(null);
  const panel = useRef(null);
  const head = useRef(null);
  useOverlayClose(true, () => { if (phase !== "saving") onLater(); }, panel);

  // Focus moves into the sheet, and back to where it was when the sheet closes.
  useEffect(() => {
    const from = /** @type {HTMLElement | null} */ (document.activeElement);
    panel.current?.focus({ preventScroll: true });
    return () => { from?.focus?.({ preventScroll: true }); };
  }, []);
  // Each step announces itself: its heading takes focus.
  useEffect(() => { if (phase === "ask" || phase === "check") head.current?.focus({ preventScroll: true }); }, [phase]);

  useEffect(() => {
    let gone = false;
    (async () => {
      const info = await getAgeInfo();
      if (gone) return;
      if (!info.error && info.birth_md) { onNothingToAsk(); return; }
      setNeedYear(!info.error && !info.set);
      setStoredYear(info.birth_year || null);
      setPhase("ask");
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = Number(month);
  const full = splitDob(dob);
  const ready = needYear ? !!full : !!(month && day);
  const pick = needYear && full ? { m: Number(full.md.slice(0, 2)), d: Number(full.md.slice(3, 5)), y: full.year } : { m, d: Number(day), y: storedYear };
  const spoken = `${MONTHS[pick.m - 1] || ""} ${pick.d || ""}${pick.y ? `, ${pick.y}` : ""}`;
  // "The year is wrong": a mail to us with the account in it (unseen body),
  // and the sheet goes away for this session without saving anything.
  const mailBody = [account?.email && `GlobeSkimmers account: ${account.email}`, account?.id && `Account ID: ${account.id}`, storedYear && `The year on my account (${storedYear}) is wrong. My birthday is: `].filter(Boolean).join("\n");
  const correctHref = `mailto:${CORRECT_TO}?subject=${encodeURIComponent("Birthday correction")}${mailBody ? `&body=${encodeURIComponent(mailBody)}` : ""}`;

  const chooseMonth = (v) => {
    setMonth(v); setErr(null);
    if (day && Number(day) > daysIn(Number(v))) setDay("");
  };
  const save = async () => {
    if (phase === "saving") return;
    setPhase("saving"); setErr(null);
    const res = needYear ? await setAgeGate(full.year, full.md) : await setBirthday(`${month}-${day}`);
    if (res.error && res.error !== "age_required") { setErr(res.error); setPhase("ask"); return; }
    onSaved();
  };

  const btn = "flex-1 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50";
  const btnStyle = { minHeight: 48, fontSize: fs(14.5) };
  const field = { minHeight: 48, border: `1px solid ${RULE}`, background: "#fff", color: INK, fontSize: fs(15) };

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(22,17,13,.5)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="gs-bday-confirm-h" aria-describedby="gs-bday-confirm-d" aria-busy={phase === "saving" || phase === "loading"}
        className="relative w-full max-w-md rounded-[18px] px-5 py-6 outline-none" style={{ background: IVORY, border: `1px solid ${RULE}` }}>
        <div className="uppercase" style={{ fontSize: fs(10), letterSpacing: ".2em", color: STAMP, fontWeight: 700 }}>Globeskimmers</div>

        {phase === "loading" && (
          <>
            <div className="flex items-center gap-2" style={{ marginTop: 10, color: INK3, fontSize: fs(14) }}>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span id="gs-bday-confirm-h">Confirm your birthday</span>
              <span id="gs-bday-confirm-d" className="sr-only">Loading</span>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={onLater} className={btn} style={{ ...btnStyle, background: "#fff", color: INK2, border: `1px solid ${RULE}` }}>Not now</button>
            </div>
          </>
        )}

        {phase === "ask" && (
          <>
            <h2 id="gs-bday-confirm-h" ref={head} tabIndex={-1} className="outline-none" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), lineHeight: 1.1, color: INK, marginTop: 6 }}>
              Confirm your birthday
            </h2>
            <p id="gs-bday-confirm-d" style={{ fontSize: fs(14.5), lineHeight: 1.5, color: INK2, marginTop: 10 }}>
              {needYear
                ? "We don’t have your birthday yet. Stamps and posts wait until we do; everything else works as usual."
                : "We have the year you were born, but not the month and day. Stamps and posts wait until we have them; everything else works as usual."}
            </p>
            <p style={{ fontSize: fs(12.5), lineHeight: 1.45, color: INK3, marginTop: 6 }}>
              It keeps GlobeSkimmers safe and sets the right privacy for your age. Private: never shown on your profile or passport.
            </p>
            {needYear ? (
              <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); setErr(null); }} aria-label="Your birthday" autoComplete="bday"
                min="1900-01-01" max={new Date().toISOString().slice(0, 10)}
                className="mt-4 w-full rounded-xl px-3 outline-none" style={field} />
            ) : (
              <div className="flex gap-2 mt-4">
                <select value={month} onChange={(e) => chooseMonth(e.target.value)} aria-label="Birthday month" autoComplete="bday-month"
                  className="flex-1 min-w-0 rounded-xl px-2" style={field}>
                  <option value="">Month</option>
                  {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
                </select>
                <select value={day} onChange={(e) => { setDay(e.target.value); setErr(null); }} aria-label="Birthday day" autoComplete="bday-day"
                  className="rounded-xl px-2" style={{ ...field, width: "34%" }}>
                  <option value="">Day</option>
                  {Array.from({ length: month ? daysIn(m) : 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
                </select>
              </div>
            )}
            {err && <p role="alert" style={{ fontSize: fs(13), color: STAMP, lineHeight: 1.4, marginTop: 8 }}>{err}</p>}
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={onLater} className={btn} style={{ ...btnStyle, background: "#fff", color: INK2, border: `1px solid ${RULE}` }}>Not now</button>
              <button type="button" onClick={() => setPhase("check")} disabled={!ready} className={btn} style={{ ...btnStyle, background: INK, color: "#fff" }}>Continue</button>
            </div>
          </>
        )}

        {(phase === "check" || phase === "saving") && (
          <>
            <h2 id="gs-bday-confirm-h" ref={head} tabIndex={-1} className="outline-none" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: fs(26), lineHeight: 1.1, color: INK, marginTop: 6 }}>
              Is your birthday {spoken}?
            </h2>
            <p id="gs-bday-confirm-d" style={{ fontSize: fs(14.5), lineHeight: 1.5, color: INK2, marginTop: 10 }}>
              It&rsquo;s saved once. To change it later you&rsquo;d need to write to us, so take a second look.
            </p>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setPhase("ask")} disabled={phase === "saving"} className={btn} style={{ ...btnStyle, background: "#fff", color: INK2, border: `1px solid ${RULE}` }}>Change</button>
              <button type="button" onClick={save} disabled={phase === "saving"} className={btn} style={{ ...btnStyle, background: INK, color: "#fff" }}>
                {phase === "saving" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {phase === "saving" ? "Saving…" : "Yes, save it"}
              </button>
            </div>
            {!needYear && storedYear && phase !== "saving" && (
              <a href={correctHref} onClick={() => onLater()} className="mt-2 flex items-center justify-center underline underline-offset-2"
                style={{ minHeight: 44, fontSize: fs(13), color: INK3 }}>
                The year is wrong
              </a>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
