// AUTO-BUILT from the founder's rendered coat set (2026-10-05) — scripts in the
// session scratchpad read the delivered files and wrote this registry. A breed
// listed here shows ITS real colorways in the buddy sheet (keys match the R2
// render paths pets/<species>/<breed>/<coat>/<pose>.png); any other breed falls
// back to the generic species palette in petCatalog.js.
import { COATS } from "@/lib/petCatalog";

export const BREED_COATS = {
 "cat/abyssinian": [
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
  { key: "ruddy", name: "Ruddy", body: "#A66A42", belly: "#D8AF88", ear: "#7A4A2B" },
 ],
 "cat/bengal": [
  { key: "brown-rosette", name: "Brown Rosette", body: "#B0804A", belly: "#E0C49A", ear: "#7E5830" },
  { key: "snow-lynx", name: "Snow Lynx", body: "#EFE8DC", belly: "#F9F5EC", ear: "#B49C82" },
 ],
 "cat/british-shorthair": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
 ],
 "cat/domestic-shorthair": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "brown-tabby", name: "Brown Tabby", body: "#8A6B4D", belly: "#C8B090", ear: "#5C4530" },
  { key: "grey", name: "Grey", body: "#9B9790", belly: "#CFCCC6", ear: "#6E6A63" },
  { key: "orange-tabby", name: "Orange Tabby", body: "#D98E4A", belly: "#F2D8B8", ear: "#A96630" },
  { key: "tuxedo", name: "Tuxedo", body: "#35332F", belly: "#F3EFE6", ear: "#211F1C" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "cat/maine-coon": [
  { key: "brown-tabby", name: "Brown Tabby", body: "#8A6B4D", belly: "#C8B090", ear: "#5C4530" },
  { key: "silver-tabby", name: "Silver Tabby", body: "#B9BCC0", belly: "#E2E4E7", ear: "#7F8389" },
 ],
 "cat/norwegian-forest-cat": [
  { key: "black-smoke", name: "Black Smoke", body: "#4A4846", belly: "#8E8A86", ear: "#2C2A28" },
  { key: "brown-tabby", name: "Brown Tabby", body: "#8A6B4D", belly: "#C8B090", ear: "#5C4530" },
 ],
 "cat/persian": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "cat/ragdoll": [
  { key: "blue-point", name: "Blue Point", body: "#E2DED8", belly: "#F2EFEA", ear: "#7A828C" },
  { key: "seal-point", name: "Seal Point", body: "#E4D6C2", belly: "#F3EADC", ear: "#5A4436" },
 ],
 "cat/scottish-fold": [
  { key: "brown-tabby", name: "Brown Tabby", body: "#8A6B4D", belly: "#C8B090", ear: "#5C4530" },
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
 ],
 "cat/siamese": [
  { key: "chocolate-point", name: "Chocolate Point", body: "#E7DACA", belly: "#F4ECDF", ear: "#6B4A32" },
  { key: "lilac-point", name: "Lilac Point", body: "#E9E2DC", belly: "#F6F1EC", ear: "#A79390" },
 ],
 "cat/sphynx": [
  { key: "charcoal", name: "Charcoal", body: "#55534E", belly: "#8E8B84", ear: "#35332F" },
  { key: "pink", name: "Pink", body: "#E8C4BA", belly: "#F6E3DD", ear: "#C49288" },
 ],
 "dog/akita": [
  { key: "brindle", name: "Brindle", body: "#8A6A48", belly: "#C9A87E", ear: "#5B452F" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/alaskan-malamute": [
  { key: "black-and-white", name: "Black & White", body: "#3D3B39", belly: "#F2EEE6", ear: "#262422" },
  { key: "gray-and-white", name: "Gray & White", body: "#8F949A", belly: "#F0F1F3", ear: "#62686F" },
 ],
 "dog/american-cocker-spaniel": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "buff", name: "Buff", body: "#DCC094", belly: "#F1E4C8", ear: "#B2905F" },
 ],
 "dog/american-staffordshire-terrier": [
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/australian-shepherd": [
  { key: "black-tri", name: "Black Tri", body: "#43403C", belly: "#EFE6D8", ear: "#2A2724" },
  { key: "red-merle", name: "Red Merle", body: "#B98A74", belly: "#E2C9BA", ear: "#8A5F4C" },
 ],
 "dog/basset-hound": [
  { key: "lemon-and-white", name: "Lemon & White", body: "#E9DCB8", belly: "#F8F2E2", ear: "#C3AC76" },
  { key: "red-and-white", name: "Red & White", body: "#B86B3C", belly: "#F3ECE2", ear: "#8C4A26" },
 ],
 "dog/beagle": [
  { key: "lemon", name: "Lemon", body: "#E4CF9E", belly: "#F5EBCC", ear: "#C2A96E" },
  { key: "tricolor", name: "Tricolor", body: "#4A403A", belly: "#EFE6D8", ear: "#2E2824" },
 ],
 "dog/belgian-malinois": [
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
  { key: "mahogany", name: "Mahogany", body: "#7E4327", belly: "#BE8660", ear: "#5A2D18" },
 ],
 "dog/bichon-frise": [
  { key: "apricot", name: "Apricot", body: "#E0B07C", belly: "#F3DFC4", ear: "#B4854F" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/bloodhound": [
  { key: "black-and-tan", name: "Black & Tan", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
  { key: "liver-and-tan", name: "Liver & Tan", body: "#6B4A32", belly: "#C98F56", ear: "#4A3221" },
 ],
 "dog/border-collie": [
  { key: "blue-merle", name: "Blue Merle", body: "#A3A7AD", belly: "#D4D6DA", ear: "#6B7076" },
  { key: "red-and-white", name: "Red & White", body: "#B86B3C", belly: "#F3ECE2", ear: "#8C4A26" },
 ],
 "dog/boston-terrier": [
  { key: "brindle-and-white", name: "Brindle & White", body: "#8A6A48", belly: "#F2ECE2", ear: "#5B452F" },
  { key: "seal-and-white", name: "Seal & White", body: "#4A3E3A", belly: "#F2ECE2", ear: "#2E2522" },
 ],
 "dog/bull-terrier": [
  { key: "brindle-and-white", name: "Brindle & White", body: "#8A6A48", belly: "#F2ECE2", ear: "#5B452F" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/bulldog": [
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/bullmastiff": [
  { key: "brindle", name: "Brindle", body: "#8A6A48", belly: "#C9A87E", ear: "#5B452F" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/cane-corso": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/cavalier-king-charles-spaniel": [
  { key: "ruby", name: "Ruby", body: "#8C4A30", belly: "#C98F6B", ear: "#63301C" },
  { key: "tricolor", name: "Tricolor", body: "#4A403A", belly: "#EFE6D8", ear: "#2E2824" },
 ],
 "dog/chihuahua": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/chinese-shar-pei": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/chow-chow": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
 ],
 "dog/collie-rough": [
  { key: "blue-merle", name: "Blue Merle", body: "#A3A7AD", belly: "#D4D6DA", ear: "#6B7076" },
  { key: "sable", name: "Sable", body: "#C09355", belly: "#E8D3AC", ear: "#8A6334" },
 ],
 "dog/dachshund": [
  { key: "black-and-tan", name: "Black & Tan", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
  { key: "chocolate", name: "Chocolate", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
 ],
 "dog/dalmatian": [
  { key: "lemon", name: "Lemon", body: "#E4CF9E", belly: "#F5EBCC", ear: "#C2A96E" },
  { key: "liver", name: "Liver", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
 ],
 "dog/doberman-pinscher": [
  { key: "cropped-ears", name: "Cropped Ears", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
 ],
 "dog/french-bulldog": [
  { key: "brindle", name: "Brindle", body: "#8A6A48", belly: "#C9A87E", ear: "#5B452F" },
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
 ],
 "dog/german-shepherd-dog": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "black-and-tan", name: "Black & Tan", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
 ],
 "dog/german-shorthaired-pointer": [
  { key: "liver", name: "Liver", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
  { key: "liver-and-white", name: "Liver & White", body: "#7A563B", belly: "#F0EAE0", ear: "#55381F" },
 ],
 "dog/golden-retriever": [
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
  { key: "dark-gold", name: "Dark Gold", body: "#B9823C", belly: "#E2C491", ear: "#8A5D28" },
 ],
 "dog/great-dane": [
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
  { key: "harlequin", name: "Harlequin", body: "#E8E4DC", belly: "#F7F4EE", ear: "#3A3835" },
 ],
 "dog/greyhound": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
 ],
 "dog/havanese": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "chocolate", name: "Chocolate", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
 ],
 "dog/irish-setter": [
  { key: "chestnut", name: "Chestnut", body: "#95502D", belly: "#CE9468", ear: "#6B371E" },
  { key: "mahogany", name: "Mahogany", body: "#7E4327", belly: "#BE8660", ear: "#5A2D18" },
 ],
 "dog/jack-russell-terrier": [
  { key: "tricolor", name: "Tricolor", body: "#4A403A", belly: "#EFE6D8", ear: "#2E2824" },
  { key: "white-and-tan", name: "White & Tan", body: "#EFE8DA", belly: "#F9F5EC", ear: "#C79A62" },
 ],
 "dog/labrador-retriever": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "chocolate", name: "Chocolate", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
 ],
 "dog/maltese": [
  { key: "lemon", name: "Lemon", body: "#E4CF9E", belly: "#F5EBCC", ear: "#C2A96E" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/mastiff": [
  { key: "brindle", name: "Brindle", body: "#8A6A48", belly: "#C9A87E", ear: "#5B452F" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/miniature-pinscher": [
  { key: "black-and-tan", name: "Black & Tan", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
 ],
 "dog/miniature-schnauzer": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "salt-and-pepper", name: "Salt & Pepper", body: "#9A968F", belly: "#D0CDC7", ear: "#6D6962" },
 ],
 "dog/newfoundland": [
  { key: "brown", name: "Brown", body: "#6B4A32", belly: "#A9876A", ear: "#4C3221" },
  { key: "landseer", name: "Landseer", body: "#E6E1D7", belly: "#F6F2EA", ear: "#3C3A36" },
 ],
 "dog/papillon": [
  { key: "black-and-white", name: "Black & White", body: "#3D3B39", belly: "#F2EEE6", ear: "#262422" },
  { key: "sable", name: "Sable", body: "#C09355", belly: "#E8D3AC", ear: "#8A6334" },
 ],
 "dog/pekingese": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/pembroke-welsh-corgi": [
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
  { key: "tricolor", name: "Tricolor", body: "#4A403A", belly: "#EFE6D8", ear: "#2E2824" },
 ],
 "dog/pointer": [
  { key: "black-and-white", name: "Black & White", body: "#3D3B39", belly: "#F2EEE6", ear: "#262422" },
  { key: "liver-and-white", name: "Liver & White", body: "#7A563B", belly: "#F0EAE0", ear: "#55381F" },
 ],
 "dog/pomeranian": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
 ],
 "dog/poodle-standard": [
  { key: "apricot", name: "Apricot", body: "#E0B07C", belly: "#F3DFC4", ear: "#B4854F" },
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
 ],
 "dog/pug": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/rhodesian-ridgeback": [
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
  { key: "wheaten", name: "Wheaten", body: "#D8C19A", belly: "#EFE4CB", ear: "#AB9268" },
 ],
 "dog/rottweiler": [
  { key: "black-and-rust", name: "Black & Rust", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
  { key: "mahogany", name: "Mahogany", body: "#7E4327", belly: "#BE8660", ear: "#5A2D18" },
 ],
 "dog/saint-bernard": [
  { key: "mahogany-and-white", name: "Mahogany & White", body: "#7E4327", belly: "#F3ECE2", ear: "#5A2D18" },
  { key: "red-and-white", name: "Red & White", body: "#B86B3C", belly: "#F3ECE2", ear: "#8C4A26" },
 ],
 "dog/samoyed": [
  { key: "biscuit", name: "Biscuit", body: "#DFC9A4", belly: "#F2E7D1", ear: "#B49A6E" },
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
 ],
 "dog/shetland-sheepdog": [
  { key: "blue-merle", name: "Blue Merle", body: "#A3A7AD", belly: "#D4D6DA", ear: "#6B7076" },
  { key: "sable", name: "Sable", body: "#C09355", belly: "#E8D3AC", ear: "#8A6334" },
 ],
 "dog/shiba-inu": [
  { key: "black-and-tan", name: "Black & Tan", body: "#3F3732", belly: "#C98F56", ear: "#262120" },
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
  { key: "sesame", name: "Sesame", body: "#A5774B", belly: "#D8BE9A", ear: "#775430" },
 ],
 "dog/shih-tzu": [
  { key: "black-and-white", name: "Black & White", body: "#3D3B39", belly: "#F2EEE6", ear: "#262422" },
  { key: "gold", name: "Gold", body: "#D9A45B", belly: "#F0DCB4", ear: "#A8763B" },
 ],
 "dog/siberian-husky": [
  { key: "black", name: "Black", body: "#3B3A38", belly: "#6E6A64", ear: "#232220" },
  { key: "red", name: "Red", body: "#B86B3C", belly: "#E6C49E", ear: "#8C4A26" },
 ],
 "dog/vizsla": [
  { key: "gold", name: "Gold", body: "#D9A45B", belly: "#F0DCB4", ear: "#A8763B" },
  { key: "mahogany", name: "Mahogany", body: "#7E4327", belly: "#BE8660", ear: "#5A2D18" },
 ],
 "dog/weimaraner": [
  { key: "blue", name: "Blue", body: "#8A8F96", belly: "#C4C8CD", ear: "#5E646C" },
  { key: "silver", name: "Silver", body: "#C3C6CA", belly: "#E3E5E8", ear: "#8F9398" },
 ],
 "dog/west-highland-white-terrier": [
  { key: "cream", name: "Cream", body: "#EDD9B8", belly: "#F7EEDC", ear: "#D9BE94" },
  { key: "white", name: "White", body: "#F1EDE4", belly: "#FAF7F0", ear: "#D8D2C4" },
 ],
 "dog/whippet": [
  { key: "brindle", name: "Brindle", body: "#8A6A48", belly: "#C9A87E", ear: "#5B452F" },
  { key: "fawn", name: "Fawn", body: "#D3B089", belly: "#EEDDC2", ear: "#A98659" },
 ],
 "dog/yorkshire-terrier": [
  { key: "blue-and-gold", name: "Blue & Gold", body: "#5E6670", belly: "#C98F56", ear: "#3E444C" },
  { key: "parti", name: "Parti", body: "#C9C0B0", belly: "#EBE5D9", ear: "#8A7A5E" },
 ],
 "reptile/bearded-dragon": [
  { key: "brown-camo", name: "Brown Camo", body: "#A08455", belly: "#D2BF97", ear: "#6F5833" },
 ],
};

export const coatsFor = (species, breed) => BREED_COATS[`${species}/${breed}`] || COATS[species] || [];
export const coatFor = (species, breed, key) =>
 coatsFor(species, breed).find((c) => c.key === key) || coatsFor(species, breed)[0] || { body: "#C9B291", belly: "#EADFC9", ear: "#9A815D" };
