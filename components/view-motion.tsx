'use client';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { PublicRoom } from '@/lib/types';
import { cardViews, VIEW_RETURN_MS, VIEW_TRAVEL_MS, type CardView } from '@/lib/card-views';
import Card from './card';

export function useCardViews(room: PublicRoom, now: number, reduced: boolean) {
  const [retained, setRetained] = useState<CardView[]>([]);
  const views = cardViews(retained, room, now, reduced);
  const signature = JSON.stringify(views);
  // Retain the departing card before paint, so its original slot cannot flash
  // back for one frame when the server removes the look from its next snapshot.
  useLayoutEffect(() => {
    setRetained(views);
  }, [signature]);
  return views;
}

type Rect = { x: number; y: number; width: number; height: number };
function ViewMotion({
  view,
  now,
  you,
  reduced,
}: {
  view: CardView;
  now: number;
  you: string;
  reduced: boolean;
}) {
  const [path, setPath] = useState<{ source: Rect; desk: Rect } | null>(null);
  const source = useRef<Rect | null>(null);
  const flight = useRef<HTMLDivElement>(null);
  const returning = view.returningAt !== undefined;
  useLayoutEffect(() => {
    function rememberReveal(rect: Rect) {
      if (view.viewerId !== null) return;
      const anchor = document.querySelector<HTMLElement>('[data-reveal]');
      if (anchor)
        Object.assign(anchor.style, {
          position: 'fixed',
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
    }
    function measure() {
      const slot = document.querySelector(
        `[data-player-id="${view.ownerId}"] [data-card-id="${view.card.id}"]`,
      );
      const hand = slot?.querySelector('.card-placeholder, .card-slot');
      const fallback = document.querySelector(`[data-motion-anchor="${view.ownerId}"]`);
      const desk = document.querySelector(`[data-view-desk="${view.id}"]`);
      const origin = hand || fallback;
      if (!origin || !desk) return;
      const rect = origin.getBoundingClientRect();
      const target = desk.getBoundingClientRect();
      rememberReveal(target);
      source.current = {
        x: rect.x,
        y: rect.y,
        width: hand ? rect.width : target.width,
        height: hand ? rect.height : target.height,
      };
      setPath({
        source: source.current,
        desk: { x: target.x, y: target.y, width: target.width, height: target.height },
      });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => {
      // An immediate gift/submission may interrupt the outward reveal. Continue
      // its next flight from the actual on-screen position, including mid-trip.
      const last = flight.current?.getBoundingClientRect();
      if (last) rememberReveal(last);
      window.removeEventListener('resize', measure);
    };
  }, [view.id, view.ownerId, returning]);
  if (!path) return null;
  const target = returning ? path.source : path.desk;
  const face =
    !returning &&
    (view.viewerId === null || view.viewerId === you) &&
    (reduced || now >= view.startedAt + 250);
  return (
    <div
      className="view-flight-layer"
      aria-label={
        returning ? 'Card returning to its original slot' : 'Card travelling to viewing desk'
      }
    >
      <motion.div
        ref={flight}
        className="flying-card view-flight"
        data-view-id={view.id}
        data-view-phase={returning ? 'returning' : 'viewing'}
        data-view-public={view.viewerId === null}
        style={{ width: path.source.width, height: path.source.height, transformOrigin: '0 0' }}
        initial={reduced ? false : { x: path.source.x, y: path.source.y, scaleX: 1, scaleY: 1 }}
        animate={{
          x: target.x,
          y: target.y,
          scaleX: target.width / path.source.width,
          scaleY: target.height / path.source.height,
        }}
        transition={{
          duration: reduced ? 0 : returning ? (VIEW_RETURN_MS - 180) / 1000 : VIEW_TRAVEL_MS / 1000,
          delay: returning && !reduced ? 0.12 : 0,
          ease: [0.22, 0.7, 0.15, 1],
        }}
      >
        <Card
          card={view.card}
          visible={face}
          label={
            view.viewerId === null
              ? `Public reveal, ${view.card.rank} of ${view.card.suit}`
              : view.viewerId === you
                ? `Private peek, ${view.card.rank} of ${view.card.suit}`
                : 'Another player is privately peeking, face down'
          }
        />
      </motion.div>
    </div>
  );
}

export default memo(
  ViewMotion,
  (a, b) =>
    a.view.id === b.view.id &&
    a.view.returningAt === b.view.returningAt &&
    a.view.card.rank === b.view.card.rank &&
    a.view.ownerId === b.view.ownerId &&
    a.reduced === b.reduced &&
    a.you === b.you &&
    a.now >= a.view.startedAt + 250 === b.now >= b.view.startedAt + 250,
);
