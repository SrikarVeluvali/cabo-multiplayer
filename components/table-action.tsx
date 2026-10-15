'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowsLeftRight, Crown, Eye, Hand, Spade } from '@phosphor-icons/react';
import type { PublicRoom } from '@/lib/types';

export default function TableAction({ room, now }: { room: PublicRoom; now: number }) {
  const reduce = useReducedMotion();
  const event =
    room.phase === 'playing' && !room.snap
      ? room.events.findLast((e) => e.announcement && now >= e.at && now < e.at + 2800)
      : undefined;
  const Icon =
    event?.kind === 'swap' || event?.announcement === 'Swap skipped'
      ? ArrowsLeftRight
      : event?.kind === 'snap' || event?.kind === 'penalty'
        ? Hand
        : event?.kind === 'cabo'
          ? Crown
          : event?.kind === 'info'
            ? Eye
            : Spade;
  return (
    <div className="table-action-slot" role="status" aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false}>
        {event && (
          <motion.div
            key={event.id}
            className="table-action-notice"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            <Icon weight="duotone" aria-hidden="true" />
            <div>
              <strong>{event.announcement}</strong>
              <p>{event.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
