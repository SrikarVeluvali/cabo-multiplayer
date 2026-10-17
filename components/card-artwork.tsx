'use client';
import { memo } from 'react';
import Image from 'next/image';
import type { Rank, Suit } from '@/lib/types';
import { faceArtwork, getDeckTheme } from '@/lib/deck-themes';
import { useDeckTheme } from './deck-theme';

export default memo(function CardArtwork({
  rank,
  suit,
  themeId,
}: {
  rank?: Rank;
  suit?: Suit;
  themeId?: string;
}) {
  const { theme } = useDeckTheme();
  if (!rank || !suit) return null;
  const art = faceArtwork(rank, suit, themeId ? getDeckTheme(themeId) : theme);
  return art.type === 'atlas' ? (
    <span
      className="card-face-img card-atlas-face"
      aria-hidden="true"
      data-deck-art={themeId ?? theme.id}
      style={{
        backgroundImage: `url("${art.src}")`,
        backgroundColor: art.background,
        backgroundSize: art.size,
        backgroundPosition: art.position,
        imageRendering: art.pixelated ? 'pixelated' : 'auto',
      }}
    />
  ) : (
    <Image
      className="card-face-img"
      src={art.src}
      alt=""
      width={334}
      height={486}
      unoptimized
      draggable={false}
      loading="eager"
      style={{
        backgroundColor: art.background,
        imageRendering: art.pixelated ? 'pixelated' : 'auto',
      }}
    />
  );
});
