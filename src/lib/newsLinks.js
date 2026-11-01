// newsLinks — where a Friends' news line opens (ActivityList's onOpen destinations), as a URL,
// shared by the Profile's news card and the Friends' news page (navigation redesign, 2026-10-31;
// the Mailbox's openFrom before that). A message opens in the Mailbox on its tab, a board line
// opens the board on the item it names, a stamp or photo opens that page of the book, a City Card
// its card; anything else, the followers list.
import { createPageUrl } from '@/utils';
import { cityBoardUrl, cityBoardsUrl } from '@/lib/boardLinks';

export function newsDestination(to, a = null) {
  const s = String(to || '');
  const [k, id, extra] = s.split(':');
  if (k === 'tg' || k === 'pc') return `${createPageUrl('Mailbox')}?${k}=${encodeURIComponent(id || '')}`;
  if (s === 'sent') return `${createPageUrl('Mailbox')}?tab=sent`;
  if (s === 'boards') return cityBoardsUrl();
  if (k === 'board' && a?.board_at?.city) return `${cityBoardUrl(a.board_at.city, a.board_at.country, a.board_at.region)}&open=${encodeURIComponent(a.target || '')}`;
  if (k === 'stamp') return `${createPageUrl('Passport')}?stamp=${id}`;
  if (k === 'photo') return `${createPageUrl('Passport')}?stamp=${id}&photo=${extra}`;
  if (k === 'card') return `${createPageUrl('Passport')}?tab=cards&card=${id}`;   // City Cards live on the Passport
  if (s === 'passport') return createPageUrl('Passport');
  return `${createPageUrl('Circle')}?tab=followers`;
}

// Several "city board now shows…" lines fold into one (founder, 2026-10-19: "quite a scroll");
// the Find people heads-up and a single board line stay as they are.
export function foldBoards(items) {
  const boards = items.filter((a) => a?.type === 'board' && a.board_kind !== 'find' && a.board_kind !== 'many');
  if (boards.length < 2) return items;
  const first = items.findIndex((a) => a?.type === 'board' && a.board_kind !== 'find');
  const folded = { type: 'board', board_kind: 'many', boards: boards.map((b) => b.board_name).filter(Boolean), photos: boards.reduce((n, b) => n + (b.photos || 0), 0),
    at: boards.map((b) => b.at).sort().pop(), unread: boards.some((b) => b.unread) };
  const rest = items.filter((a) => !(a?.type === 'board' && a.board_kind !== 'find'));
  const at = Math.min(Math.max(first, 0), rest.length);
  return [...rest.slice(0, at), folded, ...rest.slice(at)];
}

// The news lines: what happened on the passport and in the circle — never the mail itself
// (postcards and telegrams are the Mailbox's).
export const passportNewsOf = (activity) => (activity || []).filter((a) => a && a.type !== 'postcard' && a.type !== 'telegram');
