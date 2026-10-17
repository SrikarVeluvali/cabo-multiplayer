import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import catalog from '../config/deck-themes.json';
import { cardArtwork } from '../lib/card-art';
import { checkDeckAssets } from '../lib/check-deck-assets';
import {
  deckThemes,
  defaultDeckTheme,
  getDeckTheme,
  faceArtwork,
  deckAssets,
  deckBack,
  ranks,
  suits,
  validateDeckThemes,
  type DeckTheme,
} from '../lib/deck-themes';

test('classic theme preserves all original card files, court variants, and sleeve', () => {
  const theme = getDeckTheme('classic');
  for (const rank of ranks)
    for (const suit of suits)
      assert.equal(faceArtwork(rank, suit, theme).src, cardArtwork(rank, suit));
  assert.equal(deckBack(theme), '/art/engraved-sleeve.webp');
  assert.equal(getDeckTheme('removed-theme').id, defaultDeckTheme);
  assert.equal(getDeckTheme(null).id, defaultDeckTheme);
});

test('8-bit theme maps every original numbered PNG without converting the supplied files', () => {
  const theme = getDeckTheme('8-bit');
  assert.equal(theme.name, '8-bit theme');
  assert.equal(theme.background, 'transparent');
  assert.equal(theme.preload, false);
  const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
  const suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'] as const;
  const files = new Set<string>();
  suitOrder.forEach((suit, row) =>
    order.forEach((rank, column) => {
      const art = faceArtwork(rank, suit, theme);
      assert.equal(art.type, 'file');
      assert.equal(art.src, `/cards/themes/8-bit/8BitDeck${row * 13 + column + 1}.png`);
      files.add(art.src);
    }),
  );
  assert.equal(files.size, 52);
  assert.equal(faceArtwork('K', 'hearts', theme).src, '/cards/themes/8-bit/8BitDeck12.png');
  assert.equal(faceArtwork('A', 'spades', theme).src, '/cards/themes/8-bit/8BitDeck52.png');
});

test('numbered decks reject incomplete rank orders and invalid starting indices', () => {
  const theme = getDeckTheme('8-bit');
  if (theme.face.type !== 'files') throw new Error('Expected files');
  for (const face of [
    { ...theme.face, rankOrder: ['2'] },
    { ...theme.face, startIndex: -1 },
    { ...theme.face, startIndex: 1.5 },
  ]) {
    assert.throws(
      () => validateDeckThemes({ defaultTheme: '8-bit', themes: [{ ...theme, face }] }),
      /Deck themes:/,
    );
  }
});

test('both Deltarune palettes map all 52 cards once, with Ace last and the supplied suit order', () => {
  for (const id of ['deltarune', 'deltarune-hc']) {
    const theme = getDeckTheme(id),
      positions = new Set<string>();
    for (const rank of ranks)
      for (const suit of suits) {
        const art = faceArtwork(rank, suit, theme);
        assert.equal(art.type, 'atlas');
        if (art.type !== 'atlas') throw new Error('Expected atlas');
        assert.equal(art.size, '1300% 400%');
        positions.add(art.position);
        assert.ok(art.pixelated);
      }
    assert.equal(positions.size, 52);
    const two = faceArtwork('2', 'hearts', theme);
    assert.equal(two.type === 'atlas' && two.position, '0% 0%');
    const ace = faceArtwork('A', 'spades', theme);
    assert.equal(ace.type === 'atlas' && ace.position, '100% 100%');
    assert.equal(
      deckAssets(theme).length,
      2,
      'one atlas plus the shared back, not 52 atlas downloads',
    );
  }
  assert.notEqual(
    faceArtwork('K', 'hearts', getDeckTheme('deltarune')).src,
    faceArtwork('K', 'hearts', getDeckTheme('deltarune-hc')).src,
  );
});

test('future JPEG atlases and partial court-card packs need only configuration', () => {
  const custom: DeckTheme = {
    id: 'future',
    name: 'Future',
    description: '',
    back: '/cards/themes/future/back.jpg',
    face: {
      type: 'atlas',
      image: '/cards/themes/future/faces.jpg',
      columns: ['J', 'Q', 'K'],
      rows: ['spades'],
    },
  };
  assert.doesNotThrow(() => validateDeckThemes({ defaultTheme: 'future', themes: [custom] }));
  const king = faceArtwork('K', 'spades', custom);
  assert.equal(king.type === 'atlas' && king.position, '100% 0%');
  assert.equal(king.type === 'atlas' && king.size, '300% 100%');
  assert.equal(faceArtwork('2', 'spades', custom).src, cardArtwork('2', 'spades'));
  assert.equal(faceArtwork('J', 'hearts', custom).src, cardArtwork('J', 'hearts'));
  assert.equal(deckBack(custom), custom.back);
});

test('invalid theme IDs, mappings, templates, and asset paths fail with actionable errors', () => {
  const atlas = getDeckTheme('deltarune');
  const invalid = [
    { defaultTheme: 'missing', themes: [atlas] },
    { defaultTheme: atlas.id, themes: [atlas, atlas] },
    {
      defaultTheme: atlas.id,
      themes: [{ ...atlas, face: { ...atlas.face, columns: ['J', 'J'] } }],
    },
    { defaultTheme: atlas.id, themes: [{ ...atlas, face: { ...atlas.face, rows: ['stars'] } }] },
    {
      defaultTheme: atlas.id,
      themes: [{ ...atlas, face: { ...atlas.face, image: 'https://example.com/cards.jpg' } }],
    },
    { defaultTheme: atlas.id, themes: [{ ...atlas, back: '/../outside.png' }] },
    { defaultTheme: atlas.id, themes: [{ ...atlas, background: 'linear-gradient(red,blue)' }] },
    {
      defaultTheme: atlas.id,
      themes: [{ ...atlas, face: { type: 'files', template: '/deck/{rank}.jpg' } }],
    },
  ];
  for (const value of invalid) assert.throws(() => validateDeckThemes(value), /Deck themes:/);
});

test('registered images exist and atlases have exact cell boundaries, including visible court artwork', async () => {
  assert.doesNotThrow(() => validateDeckThemes(catalog));
  const results = await checkDeckAssets(path.resolve('public'));
  assert.equal(results.length, deckThemes.length);
  assert.ok(results.includes('deltarune: 13×4 atlas, 142×190px per card'));
  // The last King frame must contain real source pixels, not an empty/cut-off tile.
  const atlas = await readFile('public/cards/themes/deltarune/2x/DeltaruneDeck.png');
  const { data } = await sharp(atlas)
    .extract({ left: 11 * 142, top: 3 * 190, width: 142, height: 190 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++;
  assert.ok(ink > 1000, 'King of spades artwork occupies its mapped cell');
});

test('build asset checks reject missing files and grids that cut through pixels', async () => {
  const atlas = getDeckTheme('deltarune');
  const face = atlas.face;
  if (face.type !== 'atlas') throw new Error('Expected atlas');
  await assert.rejects(
    () =>
      checkDeckAssets(path.resolve('public'), [
        { ...atlas, face: { ...face, image: '/not-a-card.png' } },
      ]),
    /Missing or unreadable/,
  );
  await assert.rejects(
    () =>
      checkDeckAssets(path.resolve('public'), [
        { ...atlas, face: { ...face, columns: ['2', '3', '4'] } },
      ]),
    /divide evenly/,
  );
});
