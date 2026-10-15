import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createRoom, player, tick, publicRoom, CARD_SETTLE_MS } from '../lib/game';
import type { Card } from '../lib/types';
function setup() {
  const room = createRoom('ABC234', 'Host', 'token');
  const guest = player('Guest');
  guest.ready = true;
  room.players.push(guest);
  const third = player('Third');
  third.ready = true;
  room.players.push(third);
  act(room, room.hostId, { type: 'start' });
  const now = room.deadline;
  tick(room, now);
  const top: Card = { id: 'discard-test', rank: '7', suit: 'clubs' };
  room.discard = [top];
  return { room, id: room.hostId, guest: guest.id, third: third.id, now, top };
}
test('buzzer belongs only to the first player and pauses ordinary play', () => {
  const { room, id, guest, now, top } = setup();
  const deadline = room.deadline;
  act(room, guest, { type: 'buzz', topId: top.id }, now);
  assert.equal(room.snap?.deadline, now + 8000);
  assert.throws(() => act(room, id, { type: 'buzz', topId: top.id }, now + 1), /won the buzzer/);
  assert.throws(() => act(room, id, { type: 'draw' }, now + 1), /won the buzzer/);
  tick(room, now + 7999);
  assert.equal(room.snap?.playerId, guest);
  assert.equal(room.deadline, deadline);
  const count = room.players[1].cards.length;
  tick(room, now + 8000);
  assert.equal(room.snap, null);
  assert.equal(room.players[1].cards.length, count + 1);
  assert.equal(room.deadline, deadline + 8000 + CARD_SETTLE_MS);
});
test('a successful opponent snap transfers a chosen hidden card into the original slot', () => {
  const { room, id, guest, now, top } = setup();
  room.players[1].cards[2] = { id: 'match', rank: '7', suit: 'hearts' };
  const given = room.players[0].cards[1],
    ownCount = room.players[0].cards.length;
  act(room, id, { type: 'buzz', topId: top.id }, now);
  act(room, id, { type: 'snap', target: { playerId: guest, cardId: 'match' } }, now + 100);
  assert.equal(room.snap?.stage, 'give');
  assert.equal(room.discard.at(-1)?.id, top.id);
  act(room, id, { type: 'give', cardId: given.id }, now + 200);
  assert.equal(room.players[0].cards.length, ownCount - 1);
  assert.equal(room.players[1].cards[2].id, given.id);
  assert.equal(room.discard.at(-1)?.id, 'match');
  assert.equal(room.snap, null);
  assert.equal(publicRoom(room, guest, now + 200).players[1].cards[2].rank, undefined);
});
test('wrong opponent snap reveals that card publicly for exactly five seconds and only snapper gets penalty', () => {
  const { room, id, guest, third, now, top } = setup();
  const deadline = room.deadline;
  room.players[1].cards[0] = { id: 'wrong', rank: '2', suit: 'spades' };
  const count = room.players[0].cards.length;
  act(room, id, { type: 'buzz', topId: top.id }, now);
  act(room, id, { type: 'snap', target: { playerId: guest, cardId: 'wrong' } }, now + 100);
  for (const viewer of [id, guest, third])
    assert.equal(publicRoom(room, viewer, now + 5099).players[1].cards[0].rank, '2');
  assert.equal(publicRoom(room, third, now + 5100).players[1].cards[0].rank, undefined);
  assert.equal(room.availableAt, now + 5100);
  assert.equal(room.deadline, deadline + 5100);
  assert.equal(room.players[1].cards.length, 4);
  assert.equal(room.players[0].cards.length, count + 1);
  assert.equal(publicRoom(room, id, now + 100).players[0].cards.at(-1)?.rank, undefined);
});
test('CABO hands cannot be swapped or participate in opponent-snap transfers', () => {
  const { room, id, guest, third, now, top } = setup();
  room.caboId = id;
  room.turnIndex = 1;
  room.stage = 'power-swap';
  room.power = { label: 'Swap', count: 0, scope: 'any', swap: true };
  const protectedCard = room.players[0].cards[0];
  assert.throws(
    () =>
      act(
        room,
        guest,
        {
          type: 'swap',
          targets: [
            { playerId: id, cardId: protectedCard.id },
            { playerId: third, cardId: room.players[2].cards[0].id },
          ],
        },
        now,
      ),
    /locked/,
  );
  act(room, guest, { type: 'buzz', topId: top.id }, now);
  assert.throws(
    () =>
      act(
        room,
        guest,
        { type: 'snap', target: { playerId: id, cardId: protectedCard.id } },
        now + 100,
      ),
    /locked/,
  );
});
test('caller may still snap their own matching card; looked-at cards return without enabling swaps', () => {
  const { room, id, now, top } = setup();
  room.caboId = id;
  room.players[0].cards[0] = { id: 'own-match', rank: '7', suit: 'diamonds' };
  act(room, id, { type: 'buzz', topId: top.id }, now);
  act(room, id, { type: 'snap', target: { playerId: id, cardId: 'own-match' } }, now + 100);
  assert.equal(room.players[0].cards.length, 3);
});
test('gift timeout completes a correct opponent snap with one random card, keeping every card unique', () => {
  const { room, id, guest, now, top } = setup();
  room.players[1].cards[0] = { id: 'match', rank: '7', suit: 'diamonds' };
  act(room, id, { type: 'buzz', topId: top.id }, now);
  act(room, id, { type: 'snap', target: { playerId: guest, cardId: 'match' } }, now + 100);
  tick(room, now + 8100);
  assert.equal(room.snap, null);
  assert.equal(room.players[0].cards.length, 3);
  assert.equal(room.players[1].cards.length, 4);
  assert.equal(room.discard.at(-1)?.id, 'match');
});
