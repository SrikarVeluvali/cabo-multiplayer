import type { PublicRoom, TableCard } from './types';

export const VIEW_TRAVEL_MS = 700;
export const VIEW_RETURN_MS = 1000;
export type CardView = {
  id: string;
  scope: string;
  card: TableCard;
  ownerId: string;
  viewerId: string | null;
  until: number;
  startedAt: number;
  returningAt?: number;
};

// Keep one presentation identity across polling, opening-peek additions, and
// Mathbo's expression → gift transition. Cached faces came from this seat's
// authorized snapshot; a spectator's snapshot only ever supplies a card back.
export function cardViews(
  previous: CardView[],
  room: Pick<
    PublicRoom,
    | 'code'
    | 'round'
    | 'phase'
    | 'availableAt'
    | 'players'
    | 'looks'
    | 'publicReveals'
    | 'movement'
    | 'snap'
  >,
  now: number,
  reduced = false,
): CardView[] {
  if (!['peek', 'playing'].includes(room.phase)) return [];
  if (room.phase === 'peek' && now < room.availableAt) return [];
  const scope = `${room.code}:${room.round}`;
  const active = new Map<string, CardView>();
  const moving = new Set(
    room.movement && now < room.movement.until ? room.movement.flights.map((f) => f.card.id) : [],
  );
  function add(cardId: string, viewerId: string | null, until: number) {
    const awaitingSnap = viewerId === null && room.snap?.target?.cardId === cardId;
    if ((!awaitingSnap && now >= until) || moving.has(cardId)) return;
    const owner = room.players.find((p) => p.cards.some((c) => c.id === cardId));
    const card = owner?.cards.find((c) => c.id === cardId);
    if (!owner || !card) return;
    const id = `${scope}:${viewerId ?? 'public'}:${cardId}${viewerId ? `:${until}` : ''}`;
    const old = previous.find((view) => view.id === id);
    active.set(id, {
      id,
      scope,
      card: { ...(card.rank ? card : (old?.card ?? card)) },
      ownerId: owner.id,
      viewerId,
      until,
      startedAt: old?.startedAt ?? now,
    });
  }
  for (const look of room.looks ?? []) {
    for (const cardId of look.cardIds) {
      if (now >= (room.publicReveals[cardId] ?? 0)) add(cardId, look.playerId, look.until);
    }
  }
  for (const [cardId, until] of Object.entries(room.publicReveals)) add(cardId, null, until);
  if (!reduced) {
    for (const view of previous) {
      if (view.scope !== scope || active.has(view.id) || moving.has(view.card.id)) continue;
      if (view.viewerId && !room.players.some((p) => p.id === view.viewerId)) continue;
      // A card transferred to another hand or public reveal has another owner
      // for its animation. Never resurrect a return flight behind that move.
      if ([...active.values()].some((next) => next.card.id === view.card.id)) continue;
      const owner = room.players.find((p) => p.cards.some((c) => c.id === view.card.id));
      if (!owner || owner.id !== view.ownerId) continue;
      const returningAt = view.returningAt ?? now;
      if (now < returningAt + VIEW_RETURN_MS) active.set(view.id, { ...view, returningAt });
    }
  }
  return [...active.values()];
}
