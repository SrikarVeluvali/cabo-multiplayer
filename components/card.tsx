'use client';
import { useLayoutEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import type { TableCard } from '@/lib/types';
import { deckBack } from '@/lib/deck-themes';
import CardArtwork from './card-artwork';
import { useDeckTheme } from './deck-theme';

export const suitSymbol = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
export default function Card({
  card,
  visible = true,
  dealIndex,
  onClick,
  disabled,
  label,
  selected = false,
  small = false,
}: {
  card: TableCard;
  visible?: boolean;
  dealIndex?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  small?: boolean;
}) {
  const { theme } = useDeckTheme();
  const face = visible && !!card.rank && !!card.suit;
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const ref = useRef<HTMLDivElement>(null);
  const initialDealIndex = useRef(dealIndex);
  const x = useMotionValue(0),
    y = useMotionValue(0),
    opacity = useMotionValue(dealIndex === undefined ? 1 : 0);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const deal = initialDealIndex.current;
    if (deal === undefined || !ref.current) return;
    const deck = document.querySelector('[data-deck]')?.getBoundingClientRect();
    const target = ref.current.getBoundingClientRect();
    if (!deck || reduce) {
      opacity.set(1);
      return;
    }
    x.set(deck.x + deck.width / 2 - target.x - target.width / 2);
    y.set(deck.y + deck.height / 2 - target.y - target.height / 2);
    const opts = { duration: 0.65, delay: deal * 0.055, ease: 'easeInOut' as const };
    const animations = [
      animate(x, 0, opts),
      animate(y, 0, opts),
      animate(opacity, 1, { duration: 0.12, delay: deal * 0.055 }),
    ];
    return () => animations.forEach((a) => a.stop());
  }, [reduce, x, y, opacity]);
  return (
    <button
      type="button"
      className={`card-slot ${small ? 'small' : ''} ${selected ? 'card-selected' : ''} ${onClick && !disabled ? 'selectable' : ''}`}
      disabled={disabled || !onClick}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      aria-label={label || (face ? `${card.rank} of ${card.suit}` : 'Face-down card')}
    >
      <motion.div
        ref={ref}
        className="card-travel"
        data-deal-index={initialDealIndex.current}
        style={{ x, y, opacity }}
      >
        <motion.div
          className="card-flipper"
          initial={false}
          animate={{ rotateY: face ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.45 }}
        >
          <div className="card-back card-side">
            <Image
              className="card-sleeve-img"
              src={deckBack(theme)}
              alt=""
              width={320}
              height={480}
              unoptimized
              draggable={false}
              loading="eager"
            />
          </div>
          <div
            className={`card-front card-side ${red ? 'red' : 'black'}`}
            style={{ backgroundColor: theme.background ?? '#ffffff' }}
          >
            <CardArtwork rank={card.rank} suit={card.suit} />
          </div>
        </motion.div>
      </motion.div>
    </button>
  );
}
