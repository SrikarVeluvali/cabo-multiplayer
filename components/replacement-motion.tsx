'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { PublicRoom } from '@/lib/types';
import Card from './card';

// Explicit paths keep both halves of a replacement visible, even when polling
// skips the drawn-card snapshot or the destination is in another hand row.
export default function ReplacementMotion({
  replacement: r,
  now,
}: {
  replacement: NonNullable<PublicRoom['replacement']>;
  now: number;
}) {
  const started = useRef({ server: now, local: performance.now() });
  const [path, setPath] = useState<{
    hand: DOMRect;
    draw: DOMRect;
    discard: DOMRect;
    elapsed: number;
  } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const hand = document.querySelector(`[data-hand-slot="${r.playerId}-${r.index}"]`);
      const draw = document.querySelector('[data-drawn]');
      const discard = document.querySelector('[data-discard]');
      if (hand && draw && discard)
        setPath({
          hand: hand.getBoundingClientRect(),
          draw: draw.getBoundingClientRect(),
          discard: discard.getBoundingClientRect(),
          elapsed: Math.max(
            0,
            (started.current.server - r.at + performance.now() - started.current.local) / 1000,
          ),
        });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [r.at, r.playerId, r.index]);
  if (!path) return null;
  const point = (rect: DOMRect) => ({ x: rect.x + (rect.width - 52) / 2, y: rect.y });
  const hand = point(path.hand),
    draw = point(path.draw),
    discard = point(path.discard);
  return (
    <div className="replacement-flight" aria-label="Replacing a card" aria-live="polite">
      <motion.div
        className="flying-card"
        initial={{ x: hand.x, y: hand.y }}
        animate={{ x: [hand.x, discard.x, discard.x], y: [hand.y, discard.y, discard.y] }}
        transition={{ duration: 2.2, times: [0, 0.38, 1], ease: 'easeInOut', delay: -path.elapsed }}
      >
        <Card card={r.discarded} sharedLayout={false} label="Replaced card moves to discard" />
      </motion.div>
      <motion.div
        className="flying-card"
        initial={{ x: draw.x, y: draw.y }}
        animate={{ x: [draw.x, draw.x, hand.x, hand.x], y: [draw.y, draw.y, hand.y, hand.y] }}
        transition={{
          duration: 2.2,
          times: [0, 0.42, 0.84, 1],
          ease: 'easeInOut',
          delay: -path.elapsed,
        }}
      >
        <Card
          card={r.incoming}
          visible={now < r.at + 1550}
          sharedLayout={false}
          label="Drawn card moves into the chosen hand slot"
        />
      </motion.div>
    </div>
  );
}
