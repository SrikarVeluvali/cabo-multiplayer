import test from 'node:test';
import assert from 'node:assert/strict';
import { tableActionEvent } from '../lib/table-events';
import type { PublicRoom } from '../lib/types';

function fixture(): Pick<PublicRoom, 'phase' | 'snap' | 'events'> {
  return {
    phase: 'playing',
    snap: null,
    events: [
      { id: 'old', kind: 'info', text: 'Power played', at: 500, announcement: 'Power played' },
      {
        id: 'equation',
        kind: 'snap',
        text: 'Player proved 4×2 = 8.',
        at: 1000,
        equation: '4×2 = 8',
      },
    ],
  };
}

test('the actual Mathbo equation appears for exactly one second without resurrecting an older notice', () => {
  const room = fixture();
  assert.equal(tableActionEvent(room, 999), undefined);
  assert.equal(tableActionEvent(room, 1000)?.equation, '4×2 = 8');
  assert.equal(tableActionEvent(room, 1999)?.equation, '4×2 = 8');
  assert.equal(tableActionEvent(room, 2000), undefined);
  assert.equal(tableActionEvent(room, 2500), undefined);
});

test('an opponent Mathbo equation shows during the public reveal and gift step', () => {
  const room = fixture();
  room.snap = { playerId: 'actor', stage: 'give', topId: 'top', pausedAt: 0, deadline: 9000 };
  assert.equal(tableActionEvent(room, 1500, true)?.equation, '4×2 = 8');
  assert.equal(tableActionEvent(room, 2000, true), undefined);
  room.snap.stage = 'math';
  assert.equal(tableActionEvent(room, 1500, true), undefined);
});

test('ordinary action notices retain their duration and yield to the buzzer, reveals, and results', () => {
  const room = fixture();
  room.events.pop();
  assert.equal(tableActionEvent(room, 3299)?.announcement, 'Power played');
  assert.equal(tableActionEvent(room, 3300), undefined);
  assert.equal(tableActionEvent(room, 1000, true), undefined);
  room.snap = { playerId: 'actor', stage: 'choose', topId: 'top', pausedAt: 0, deadline: 9000 };
  assert.equal(tableActionEvent(room, 1000), undefined);
  room.snap = null;
  room.phase = 'results';
  assert.equal(tableActionEvent(room, 1000), undefined);
});
