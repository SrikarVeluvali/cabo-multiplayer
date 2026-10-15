'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { CardLocation, CardMovement } from '@/lib/types';
import Card from './card';

type Point = { x: number; y: number };
export default function CardMotion({ movement, now }: { movement: CardMovement; now: number }) {
  const [paths, setPaths] = useState<{ from: Point; to: Point; elapsed: number }[]>([]);
  const started = useRef({ server: now, local: performance.now() });
  useLayoutEffect(() => {
    function point(location: CardLocation): Point {
      const selector =
        location.zone === 'hand'
          ? `[data-hand-slot="${location.playerId}-${location.index}"]`
          : `[data-${location.zone === 'draw' ? 'drawn' : location.zone}]`;
      let element = document.querySelector(selector);
      if (!element && location.zone === 'hand')
        element = document.querySelector(`[data-motion-anchor="${location.playerId}"]`);
      const rect = (element || document.querySelector('.opponents'))!.getBoundingClientRect();
      return {
        x: rect.x + (rect.width - 52) / 2,
        y:
          location.zone === 'hand' && element?.hasAttribute('data-hand-slot')
            ? rect.y
            : rect.y + (rect.height - 74) / 2,
      };
    }
    const measure = () =>
      setPaths(
        movement.flights.map((f) => ({
          from: point(f.from),
          to: point(f.to),
          elapsed: Math.max(
            0,
            (started.current.server - movement.at + performance.now() - started.current.local) /
              1000,
          ),
        })),
      );
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [movement.id]);
  return (
    <div className="card-flight-layer" aria-label={`${movement.kind} card animation`}>
      {paths.map(({ from, to, elapsed }, i) => {
        const flight = movement.flights[i];
        const swap = movement.kind === 'swap';
        const delayed = movement.kind === 'gift' && i === 1;
        const lift = swap ? (i === 0 ? -48 : 36) : -32;
        return (
          <motion.div
            key={flight.card.id}
            className="flying-card"
            initial={{ x: from.x, y: from.y, rotate: 0, scale: 1 }}
            animate={{
              x: [from.x, from.x, (from.x + to.x) / 2, to.x, to.x],
              y: [from.y, from.y - 12, (from.y + to.y) / 2 + lift, to.y, to.y],
              rotate: [0, 0, i % 2 ? 9 : -9, 0, 0],
              scale: [1, 1.06, 1.06, 1, 1],
            }}
            transition={{
              duration: delayed ? 0.85 : 1.35,
              times: [0, 0.12, 0.5, 0.88, 1],
              delay: (delayed ? 0.55 : 0) - elapsed,
              ease: 'easeInOut',
            }}
          >
            <Card card={flight.card} visible={flight.faceUp} sharedLayout={false} />
          </motion.div>
        );
      })}
    </div>
  );
}
