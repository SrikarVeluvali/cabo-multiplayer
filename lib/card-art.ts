import type { Rank, Suit } from './types';

const names: Partial<Record<Rank, string>> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
export function cardArtwork(rank: Rank, suit: Suit) {
  return `/cards/optimized/${names[rank] ?? rank}_of_${suit}${['J', 'Q', 'K'].includes(rank) ? '2' : ''}.webp`;
}
export const deckArtwork = (
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as Rank[]
).flatMap((rank) =>
  (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).map((suit) => cardArtwork(rank, suit)),
);
