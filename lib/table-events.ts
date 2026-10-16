import type { PublicRoom } from './types';

export function tableActionEvent(
  room: Pick<PublicRoom, 'phase' | 'snap' | 'events'>,
  now: number,
  revealing = false,
) {
  const event = room.events.findLast((e) => e.announcement || e.equation);
  if (!event || room.phase !== 'playing') return;
  // An equation stays visible during an opponent's gift step and public reveal.
  // Ordinary notices must leave the buzzer and revealed cards unobstructed.
  if (room.snap && !(event.equation && room.snap.stage === 'give')) return;
  if (revealing && !event.equation) return;
  if (now >= event.at && now < event.at + (event.equation ? 1000 : 2800)) return event;
}
