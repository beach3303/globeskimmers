// Which travel-buddy breeds have the founder's picture on R2 (founder, 2026-10-14: "do not
// allow users to add a travel buddy if their breed png is not uploaded yet"). A snapshot of the
// 2026-10-13 pet audit (87 of 391 breeds: a plain sitting picture, or one for a coat in
// petCoats.js). It only sorts the breed chips and labels the rest "Coming soon"; the buddy sheet's
// Add button waits for the picture itself to load, so a breed uploaded after this list still works.
// Refresh it with the next pet upload.
const READY = {
  dog: [
    "akita", "alaskan-malamute", "american-cocker-spaniel", "american-staffordshire-terrier",
    "australian-shepherd", "basset-hound", "beagle", "belgian-malinois", "bernese-mountain-dog",
    "bichon-frise", "bloodhound", "border-collie", "boston-terrier", "boxer", "bull-terrier",
    "bulldog", "bullmastiff", "cane-corso", "cavalier-king-charles-spaniel", "chihuahua",
    "chinese-shar-pei", "chow-chow", "collie-rough", "dachshund", "dalmatian", "doberman-pinscher",
    "french-bulldog", "german-shepherd-dog", "german-shorthaired-pointer", "golden-retriever",
    "great-dane", "greyhound", "havanese", "irish-setter", "jack-russell-terrier",
    "labrador-retriever", "maltese", "mastiff", "miniature-pinscher", "miniature-schnauzer",
    "newfoundland", "papillon", "pekingese", "pembroke-welsh-corgi", "pointer", "pomeranian",
    "poodle-standard", "pug", "rhodesian-ridgeback", "rottweiler", "saint-bernard", "samoyed",
    "shetland-sheepdog", "shiba-inu", "shih-tzu", "siberian-husky", "vizsla", "weimaraner",
    "west-highland-white-terrier", "whippet", "yorkshire-terrier",
  ],
  cat: [
    "abyssinian", "bengal", "birman", "bombay", "british-shorthair", "burmese", "cornish-rex",
    "devon-rex", "domestic-shorthair", "exotic-shorthair", "himalayan", "maine-coon", "manx",
    "norwegian-forest-cat", "persian", "ragdoll", "russian-blue", "savannah", "scottish-fold",
    "siamese", "sphynx", "turkish-angora",
  ],
  hamster: [
    "syrian",
  ],
  bird: [
    "cockatiel",
  ],
  reptile: [
    "bearded-dragon", "green-iguana",
  ],
};

const SETS = Object.fromEntries(Object.entries(READY).map(([sp, keys]) => [sp, new Set(keys)]));

export const hasPetArt = (species, breed) => !!SETS[species]?.has(breed);
