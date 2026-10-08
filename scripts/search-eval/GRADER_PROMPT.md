You are a skeptical travel expert grading a travel app's search results. Read the JSON file {FILE} — {N} cases. Each case has the traveler's typed search (q), where the app searched (resolved_place), which finder it used, the query it sent, the filters the app applied (filters_applied), and the TOP results the traveler would actually see (name, Google rating, review count, miles from the search center, address, and where known: price level, today's opening hours in the place's own timezone, and Google's place type).

Some cases also list page_sections: the landmark strips the page shows above its list, in page order (top holds the same places, flattened).

The app applies filters (late night, price, bars only, sort order) separately from the query text, so a word missing from query_sent is NOT dropped when filters_applied covers it. Judge whether the results actually satisfy those filters using the hours and price shown.

For EACH case, judge whether those top results genuinely answer what the traveler asked, using your own knowledge of the place. Be strict and honest — the founder will act on this:
- GOOD: the top results are relevant and a local or seasoned traveler would accept them as a fair answer.
- WEAK: partly relevant — notable junk mixed in, wrong emphasis, results too far away for the ask, or the obvious famous answers are missing.
- WRONG: the results don't answer the question (wrong kind of place, wrong city, nonsense).
For WEAK/WRONG, give one specific reason and, where you know them, name 1-3 famous places a traveler would expect that are missing. Don't invent places — if unsure, say so. Do not penalize a case just because a famous place is #6 instead of #1.

Write ONLY a JSON array to {OUT}, one object per case in input order:
[{"id":"…","verdict":"GOOD|WEAK|WRONG","reason":"one sentence","missing":["…"]}]
Then reply with just the number of cases you wrote.
