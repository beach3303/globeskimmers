// The founder's 2026-10-07 list: "can each page's search bar deliver these?"
// Run twice — through Home search (planSearch) and as typed into the page's own
// search bar (EVAL_MODE=page) — from Santa Clarita, where the founder was:
//   EVAL_CASES=./cases-founder.mjs EVAL_HOME="34.3917,-118.5426,Santa Clarita,United States,Santa Clarita, CA" node scripts/search-eval/run.mjs
// `page` = the finder whose search bar the founder meant (Shopping has none).
const P = (id, page, q) => ({ id, page, q, expect: {}, tags: ["founder-pages", page] });

export const CASES = [
  // Places to Eat
  P("fp-kebab", "eat", "best kebab"),
  P("fp-positano-pasta", "eat", "best pasta in Positano"),
  P("fp-filipino", "eat", "Filipino food"),
  P("fp-pizza", "eat", "pizza"),
  P("fp-best-pizza", "eat", "best pizza"),
  P("fp-ice-cream", "eat", "ice cream"),
  P("fp-shaved-ice", "eat", "shaved ice"),
  P("fp-snow-ice", "eat", "snow ice"),
  P("fp-best-dessert", "eat", "best dessert"),
  P("fp-sugar-free", "eat", "sugar-free food"),
  P("fp-vegan", "eat", "vegan food"),
  P("fp-halal", "eat", "halal"),
  P("fp-kosher", "eat", "kosher food"),
  P("fp-spaghetti", "eat", "spaghetti"),
  P("fp-steak-germany", "eat", "best steak in Germany"),
  P("fp-seafood-boil", "eat", "seafood boil"),
  P("fp-steamed-crabs", "eat", "steamed crabs"),
  P("fp-where-steamed-crabs", "eat", "where can I eat steamed crabs"),
  P("fp-best-sushi", "eat", "best sushi"),
  P("fp-fish-chips", "eat", "best fish and chips"),
  P("fp-british", "eat", "best British food in the area"),
  P("fp-open-late", "eat", "restaurants that are open late"),
  // Things to Do
  P("fp-kids-4", "things", "best activities for a 4 year old"),
  P("fp-kids-10", "things", "best activities for a 10 year old"),
  P("fp-seniors", "things", "best activities for seniors"),
  P("fp-senior-couples", "things", "best activities for senior couples"),
  P("fp-teen-groups", "things", "best group activities for teenagers"),
  P("fp-adult-groups", "things", "best group activities for adults"),
  P("fp-free-4yo", "things", "free things to do for a 4 year old"),
  P("fp-atv-hawaii", "things", "ATV in Hawaii"),
  P("fp-atv-honolulu", "things", "ATV in Honolulu"),
  P("fp-nyc-local", "things", "things to do in New York City that are not iconic but local"),
  P("fp-best-local", "things", "best local activity"),
  // Coffee
  P("fp-matcha", "coffee", "best matcha"),
  P("fp-espresso", "coffee", "coffee shops that serve espresso"),
  P("fp-iced-coffee", "coffee", "coffee shops that serve iced coffee"),
  // Shopping (no search bar on the page today — Home search only)
  P("fp-trader-joes", "shopping", "Trader Joe's"),
  P("fp-malls", "shopping", "shopping malls nearby"),
  P("fp-souvenirs", "shopping", "souvenir shops nearby"),
  P("fp-luxury-mall", "shopping", "biggest luxury shopping mall"),
];
