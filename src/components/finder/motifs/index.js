// The finder motifs and world icons, by name. JSX-free on purpose: this is the one module
// pages import to draw a world's motif or icon from its name in WORLD.
//
//   MOTIF[name]        the motif component for a name in WORLD (motif, plateMotif):
//                      MenuLeader, CupRing, Contours, Tile, SecurityTint, Guilloche, DayArc,
//                      ThumbIndex, Weave, AccessionTag, LitWindow, SwingTag. Every motif
//                      takes { world, variant: 'plate' | 'strip' | 'inline' | 'card' } and
//                      reads its colours from the world, so a colour change is a token edit.
//   plateMotifOf(w)    the component to draw on a world's plate (WORLD[key].plateMotif), or
//                      null where the plate carries none (Weather; Shopping, whose plate
//                      carries the SwingTag count instead). Render it with variant 'plate'.
//   WORLD_ICON[key]    the lucide icon for each finder world (crests, chips, tiles).
//   iconOf(w)          the same for a world row, a world key ('eat'), an old category key
//                      ('food') or a page key ('PlacesToEat'); null when unknown.
// Each motif is also exported by name, with the helpers the pages share
// (clockMinutes, minutesInZone, dayPhase from DayArc; leaderBackground; accessionLabel).
import {
  UtensilsCrossed,
  Coffee,
  Compass,
  Toilet,
  CreditCard,
  Banknote,
  CloudSun,
  Languages,
  Landmark,
  Store,
  ShoppingBag,
} from 'lucide-react';
import { WORLD, FINDER_ORDER, worldOf } from '@/components/redesign/constants';
import MenuLeader, { leaderBackground } from './MenuLeader';
import CupRing from './CupRing';
import Contours from './Contours';
import Tile from './Tile';
import SecurityTint from './SecurityTint';
import Guilloche from './Guilloche';
import DayArc, { clockMinutes, minutesInZone, dayPhase } from './DayArc';
import ThumbIndex from './ThumbIndex';
import Weave from './Weave';
import AccessionTag, { accessionLabel } from './AccessionTag';
import LitWindow from './LitWindow';
import SwingTag from './SwingTag';

export const MOTIF = Object.freeze({
  MenuLeader,
  CupRing,
  Contours,
  Tile,
  SecurityTint,
  Guilloche,
  DayArc,
  ThumbIndex,
  Weave,
  AccessionTag,
  LitWindow,
  SwingTag,
});

const has = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

// The icons WORLD names (constants.js META icon). Every one is in lucide-react 0.475.
const ICONS = { UtensilsCrossed, Coffee, Compass, Toilet, CreditCard, Banknote, CloudSun, Languages, Landmark, Store, ShoppingBag };

export const WORLD_ICON = Object.freeze(Object.fromEntries(FINDER_ORDER.map((key) => [key, ICONS[WORLD[key].icon]])));

/** The plate motif component for a world row, or null. */
export function plateMotifOf(world) {
  const name = world && typeof world === 'object' ? world.plateMotif : null;
  return has(MOTIF, name) ? MOTIF[name] : null;
}

/** The lucide icon for a world row or any key worldOf() reads, or null. */
export function iconOf(world) {
  const w = world && typeof world === 'object' ? world : worldOf(world);
  return w && has(WORLD_ICON, w.key) ? WORLD_ICON[w.key] : null;
}

export {
  MenuLeader,
  CupRing,
  Contours,
  Tile,
  SecurityTint,
  Guilloche,
  DayArc,
  ThumbIndex,
  Weave,
  AccessionTag,
  LitWindow,
  SwingTag,
  leaderBackground,
  clockMinutes,
  minutesInZone,
  dayPhase,
  accessionLabel,
};
