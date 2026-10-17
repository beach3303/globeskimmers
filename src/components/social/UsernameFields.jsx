import React from "react";

// The @username form's fields, with the birthday while the worker still needs it: sign-up's
// step and Home's ask both draw these. `claim` is what useUsernameClaim returns.
export default function UsernameFields({ claim, idPrefix = "gs-onb" }) {
  const { held, draft, setDraft, askBirthday, dob, setDob, sugs, pick, error, ready, submit } = claim;
  return (
    <>
      {held ? (
        <p className="mb-2 text-[13.5px] font-semibold text-[#0E7C86] text-center">@{held.handle} is ready for you — it’s filled in below.</p>
      ) : null}
      <label className="flex items-center gap-1 h-12 px-4 rounded-xl border-2 border-gray-300 focus-within:border-[#088395] bg-white">
        <span aria-hidden="true" className="text-[17px] font-bold text-gray-400">@</span>
        <span className="sr-only">Your username</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && ready) submit(); }}
          placeholder="yourname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-w-0 h-full bg-transparent outline-none text-[16px] text-[#0F1419]"
        />
      </label>
      <p className="mt-1 mb-4 px-1 text-[12.5px] text-gray-500">3–20 letters, numbers or _</p>

      {askBirthday ? (
        <div className="mb-4">
          <label htmlFor={`${idPrefix}-birthday`} className="block text-[14px] font-semibold text-[#0F1419]">Your birthday</label>
          <p className="text-[12.5px] text-gray-500">Asked once, never shown.</p>
          <input
            id={`${idPrefix}-birthday`}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            autoComplete="bday"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className="mt-2 w-full h-12 px-4 rounded-xl border-2 border-gray-300 focus:border-[#088395] focus:outline-none text-[15px] bg-white"
          />
        </div>
      ) : null}

      {error ? <p role="alert" className="mb-2 px-1 text-[13px] font-medium text-red-600">{error}</p> : null}
      {sugs.length ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[12.5px] text-gray-500">Free right now:</span>
          {sugs.map((sug) => (
            <button key={sug} type="button" onClick={() => pick(sug)}
              className="min-h-[44px] px-3 rounded-full border border-gray-300 bg-white text-[13px] font-semibold text-[#0F1419]">
              @{sug}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
