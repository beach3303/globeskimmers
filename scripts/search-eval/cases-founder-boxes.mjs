// The founder's 2026-10-25 list: "snorkel with whales in french polynesia, ziplining in honolulu,
// best pasta in positano, authentic tacos in los angeles, best coffee in dtla — can it deliver on
// these searches?" Each typed into its finder's own search bar (finderSearch.js), from Arcadia:
//   EVAL_MODE=box EVAL_CASES=./cases-founder-boxes.mjs EVAL_OUT=./last-run-founder-boxes.json node scripts/search-eval/run.mjs
const B = (id, page, q, expect = {}) => ({ id, page, q, expect, tags: ["founder-boxes", page] });

export const CASES = [
  B("fb-whales-polynesia", "things", "snorkel with whales in french polynesia", { place: /polynesia|papeete|tahiti|moorea|bora|rangiroa/i }),
  B("fb-zipline-honolulu", "things", "ziplining in honolulu", { place: /honolulu/i, query: /zip/i }),
  B("fb-pasta-positano", "eat", "best pasta in positano", { place: /positano/i, sort: "rating", query: /pasta/i }),
  B("fb-tacos-la", "eat", "authentic tacos in los angeles", { place: /los angeles/i, query: /taco/i }),
  B("fb-coffee-dtla", "coffee", "best coffee in dtla", { place: /downtown|dtla|los angeles/i, sort: "rating" }),
];
