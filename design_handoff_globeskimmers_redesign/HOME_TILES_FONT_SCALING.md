# Home tiles — readable labels, balanced rows, no holes (for Claude Code)

Final behavior for the Home category grid. UI only — no data/logic changes.

**Goals**
1. **No clipping:** labels never get cut off ("Convenience Store", "Nearby Restaurants").
2. **Wrapping is allowed, but tidy:** a long label may drop its last word to a **2nd line** — and that 2nd line **eats the gap above the label** (a flexible spacer shrinks first), so the box height barely changes.
3. **Balanced rows:** tiles go in **pairs per row** as the font enlarges. If there's an odd tile left over, it **spans the full row** (a deliberate full-width solo) — never a half-empty row with a hole.
4. **Keep the big colorful emoji/icon chips.**

The simplest way to guarantee "pairs, with a full-width solo for the odd one" is an even count or the orphan-span rule below (which handles both).

---

## Tile component
```jsx
// CategoryTile.jsx
export function CategoryTile({ icon, label, ink, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative flex min-h-[102px] flex-col overflow-hidden rounded-2xl p-3 text-left text-white"
      style={{ background: ink, boxShadow: `0 8px 18px -12px ${ink}` }}
    >
      <span className="pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/15" />
      {/* big colorful icon chip */}
      <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white/20 text-[21px]">
        {icon}
      </span>
      {/* flexible spacer: gives up its space first, so a 2-line label
          eats the GAP (not extra height) */}
      <span className="min-h-[5px] flex-1" />
      {/* label: wraps to max 2 lines, never clipped mid-word */}
      <span className="text-[0.92em] font-bold leading-[1.12] line-clamp-2">
        {label}
      </span>
    </button>
  );
}
```

## Grid — pairs per row at large text, never 1-with-a-hole
```jsx
{/* min(7.5em, 46%): the em min grows with font size, but the 46% cap
    means at least 2 columns ALWAYS fit → pairs per row when enlarged.
    Default text → 4 cols · enlarged → 3 → 2 cols. */}
<div
  className="tile-grid grid gap-2.5"
  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(7.5em, 46%), 1fr))" }}
>
  <CategoryTile icon="🚌"  label="Transit Info"       ink="#3F49D4" />
  <CategoryTile icon="🍽️"  label="Nearby Restaurants" ink="#E63946" />
  <CategoryTile icon="☕"  label="Coffee Shop Finder" ink="#A85A2E" />
  <CategoryTile icon="🏧"  label="ATM Finder"         ink="#1F5BD6" />
  <CategoryTile icon="🚻"  label="Restroom Finder"    ink="#0E8A7C" />
  <CategoryTile icon="🏪"  label="Convenience Store"  ink="#15803D" />
  <CategoryTile icon="☀️"  label="Weather"            ink="#D4861A" />
  <CategoryTile icon="⭐"  label="Things To Do"       ink="#D6248C" />
</div>
```

```css
/* If the LAST tile lands alone in column 1 of a 2-col layout,
   stretch it to span the full row — a deliberate full-width solo,
   never a half-empty row. (Harmless when the count is even.) */
.tile-grid > :last-child:nth-child(2n - 1) {
  grid-column: 1 / -1;
}
```

**Result**
- **Default font:** 4 per row (compact, like today).
- **Enlarged font:** drops to **3 → 2 per row** (chunky pairs); labels wrap their last word to a 2nd line that eats the gap, so boxes stay tidy.
- **Odd tile out:** the last tile (e.g. Weather, or Things To Do — whichever is last in the markup) spans the **full width** instead of leaving a gap.
- **Even count (8 tiles as above):** clean pairs at every size, no solo needed.

**Knobs**
- `7.5em` min → bigger value reflows to fewer columns sooner. Try `7em`–`9em`.
- Want the full-width solo to always be a *specific* tile? Put that tile **last** in the markup.
- Prefer never to see a solo? Keep the tile count **even** (the 8 above) — the span rule then never triggers.

> Do NOT use `truncate`, `whitespace-nowrap`, a fixed `grid-cols-4`, `aspect-square`, or a fixed pixel height — those reintroduce clipping or break the full-width span. `line-clamp-2` + the flexible spacer handle the wrapping; the grid + orphan rule handle the balance.
