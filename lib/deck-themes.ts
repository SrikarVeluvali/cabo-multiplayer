import catalog from '../config/deck-themes.json';
import { cardArtwork } from './card-art';
import type { Rank, Suit } from './types';

export type DeckTheme = {
  id: string;
  name: string;
  description: string;
  credit?: string;
  back?: string;
  background?: string;
  pixelated?: boolean;
  preload?: boolean;
  face:
    | { type: 'atlas'; image: string; columns: Rank[]; rows: Suit[] }
    | {
        type: 'files';
        template: string;
        rankNames?: Partial<Record<Rank, string>>;
        courtSuffix?: string;
        rankOrder?: Rank[];
        suitOrder?: Suit[];
        startIndex?: number;
      };
};
export const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const suits: Suit[] = ['hearts', 'clubs', 'diamonds', 'spades'];

// Configuration is local, trusted project data, but fail clearly when a future
// theme has a typo rather than shipping a broken selector or cropped card.
export function validateDeckThemes(value: unknown): asserts value is {
  defaultTheme: string;
  themes: DeckTheme[];
} {
  const fail = (message: string): never => {
    throw new Error(`Deck themes: ${message}`);
  };
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const asset = (v: unknown) =>
    typeof v === 'string' && /^\/(?!\/)/.test(v) && !v.includes('..') && !/[?#{}]/.test(v);
  if (!object(value) || !Array.isArray(value.themes) || !value.themes.length)
    fail('themes must be a nonempty array.');
  const data = value as Record<string, unknown> & { themes: unknown[] };
  const ids = new Set<string>();
  for (const raw of data.themes) {
    if (!object(raw)) fail('each theme must be an object.');
    const theme = raw as Record<string, unknown>;
    if (
      typeof theme.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme.id) ||
      ids.has(theme.id)
    )
      fail('theme IDs must be unique lowercase slugs.');
    ids.add(theme.id as string);
    if (
      typeof theme.name !== 'string' ||
      !theme.name.trim() ||
      typeof theme.description !== 'string'
    )
      fail(`${theme.id}: supply a name and description.`);
    if (theme.credit !== undefined && typeof theme.credit !== 'string')
      fail(`${theme.id}: credit must be text.`);
    if (theme.back !== undefined && !asset(theme.back))
      fail(`${theme.id}: back must be a local public asset path.`);
    if (
      theme.background !== undefined &&
      (typeof theme.background !== 'string' ||
        (theme.background !== 'transparent' && !/^#[\da-f]{6}$/i.test(theme.background)))
    )
      fail(`${theme.id}: background must be transparent or a six-digit hex color.`);
    if (theme.pixelated !== undefined && typeof theme.pixelated !== 'boolean')
      fail(`${theme.id}: pixelated must be true or false.`);
    if (theme.preload !== undefined && typeof theme.preload !== 'boolean')
      fail(`${theme.id}: preload must be true or false.`);
    if (!object(theme.face)) fail(`${theme.id}: supply a face configuration.`);
    const face = theme.face as Record<string, unknown>;
    if (face.type === 'atlas') {
      if (!asset(face.image)) fail(`${theme.id}: image must be a local public asset path.`);
      for (const [key, allowed] of [
        ['columns', ranks],
        ['rows', suits],
      ] as const) {
        const order = face[key];
        if (
          !Array.isArray(order) ||
          !order.length ||
          order.some((v) => !(allowed as readonly unknown[]).includes(v)) ||
          new Set(order).size !== order.length
        )
          fail(`${theme.id}: ${key} must contain unique ${key === 'columns' ? 'ranks' : 'suits'}.`);
      }
    } else if (face.type === 'files') {
      if (
        typeof face.template !== 'string' ||
        !asset(face.template.replace(/\{(rank|suit|court|index)\}/g, 'x')) ||
        (!face.template.includes('{index}') &&
          (!face.template.includes('{rank}') || !face.template.includes('{suit}')))
      )
        fail(
          `${theme.id}: template must include {rank} and {suit}, or {index}, in a local asset path.`,
        );
      if (typeof face.template === 'string' && face.template.includes('{index}')) {
        for (const [key, allowed] of [
          ['rankOrder', ranks],
          ['suitOrder', suits],
        ] as const) {
          const order = face[key];
          if (
            !Array.isArray(order) ||
            order.length !== allowed.length ||
            new Set(order).size !== order.length ||
            order.some((v) => !(allowed as readonly unknown[]).includes(v))
          )
            fail(`${theme.id}: indexed files require a complete, unique ${key}.`);
        }
        if (
          face.startIndex !== undefined &&
          (!Number.isSafeInteger(face.startIndex) || (face.startIndex as number) < 0)
        )
          fail(`${theme.id}: startIndex must be a nonnegative whole number.`);
      }
      if (
        face.courtSuffix !== undefined &&
        (typeof face.courtSuffix !== 'string' || !/^[\w-]*$/.test(face.courtSuffix))
      )
        fail(`${theme.id}: invalid courtSuffix.`);
      if (
        face.rankNames !== undefined &&
        (!object(face.rankNames) ||
          Object.entries(face.rankNames).some(
            ([rank, name]) =>
              !ranks.includes(rank as Rank) || typeof name !== 'string' || !/^[\w-]+$/.test(name),
          ))
      )
        fail(`${theme.id}: invalid rankNames.`);
    } else fail(`${theme.id}: face type must be atlas or files.`);
  }
  if (typeof data.defaultTheme !== 'string' || !ids.has(data.defaultTheme))
    fail('defaultTheme must identify a registered theme.');
}
validateDeckThemes(catalog);
export const deckThemes: readonly DeckTheme[] = catalog.themes;
export const defaultDeckTheme = catalog.defaultTheme;
export const DECK_THEME_STORAGE_KEY = 'cabo-deck-theme';
export function getDeckTheme(id?: string | null): DeckTheme {
  return (
    deckThemes.find((theme) => theme.id === id) ??
    deckThemes.find((theme) => theme.id === defaultDeckTheme)!
  );
}
export function deckBack(theme: DeckTheme) {
  return theme.back ?? getDeckTheme().back ?? '/art/engraved-sleeve.webp';
}
export function faceArtwork(rank: Rank, suit: Suit, theme: DeckTheme) {
  const face = theme.face;
  if (face.type === 'atlas') {
    const column = face.columns.indexOf(rank),
      row = face.rows.indexOf(suit);
    // Face-only mod sheets are valid too; uncovered cards retain the classic art.
    if (column < 0 || row < 0)
      return {
        type: 'file' as const,
        src: cardArtwork(rank, suit),
        background: '#ffffff',
        pixelated: false,
      };
    return {
      type: 'atlas' as const,
      src: face.image,
      background: theme.background ?? '#ffffff',
      pixelated: !!theme.pixelated,
      size: `${face.columns.length * 100}% ${face.rows.length * 100}%`,
      position: `${face.columns.length === 1 ? 0 : (column * 100) / (face.columns.length - 1)}% ${face.rows.length === 1 ? 0 : (row * 100) / (face.rows.length - 1)}%`,
    };
  }
  return {
    type: 'file' as const,
    src: face.template.replace(/\{(rank|suit|court|index)\}/g, (_, key: string) =>
      key === 'index'
        ? String(
            face.suitOrder!.indexOf(suit) * face.rankOrder!.length +
              face.rankOrder!.indexOf(rank) +
              (face.startIndex ?? 1),
          )
        : key === 'rank'
          ? (face.rankNames?.[rank] ?? rank)
          : key === 'suit'
            ? suit
            : ['J', 'Q', 'K'].includes(rank)
              ? (face.courtSuffix ?? '')
              : '',
    ),
    background: theme.background ?? '#ffffff',
    pixelated: !!theme.pixelated,
  };
}
export function deckAssets(theme: DeckTheme) {
  return [
    ...new Set([
      deckBack(theme),
      ...ranks.flatMap((rank) => suits.map((suit) => faceArtwork(rank, suit, theme).src)),
    ]),
  ];
}
