import test from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  CARD_FLIGHT_MS,
  CARD_SETTLE_MS,
  createRoom,
  player,
  publicRoom,
  tick,
} from '../lib/game';

function setup() {
  const room = createRoom('ABC234', 'Host', 'host');
  const guest = player('Guest');
  guest.ready = true;
  room.players.push(guest);
  act(room, room.hostId, { type: 'start' });
  const now = room.deadline;
  tick(room, now);
  return { room, host: room.hostId, guest: guest.id, now };
}
test('discard flight includes its public face and reserves the table through recentering', () => {
  const { room, host, guest, now } = setup();
  act(room, host, { type: 'draw' }, now);
  const drawn = room.drawn!,
    previous = room.discard.at(-1)!;
  act(room, host, { type: 'discard' }, now + 800);
  const motion = publicRoom(room, guest, now + 800).movement!;
  assert.equal(motion.kind, 'discard');
  assert.deepEqual(motion.flights[0], {
    card: drawn,
    from: { zone: 'draw' },
    to: { zone: 'discard' },
    faceUp: true,
  });
  assert.equal(motion.discardUnder?.id, previous.id);
  assert.equal(room.availableAt, now + 800 + CARD_SETTLE_MS);
  assert.equal(publicRoom(room, guest, now + 800).events.at(-1)?.announcement, 'Card discarded');
  assert.throws(() => act(room, guest, { type: 'buzz', topId: drawn.id }, now + 900), /settle/);
  tick(room, now + 800 + CARD_FLIGHT_MS);
  assert.equal(room.movement, null);
});
test('swaps publish both paths and original slots without leaking faces', () => {
  const { room, host, guest, now } = setup();
  room.stage = 'power-swap';
  room.power = { label: 'Swap', count: 0, scope: 'any', swap: true };
  const a = room.players[0].cards[1],
    b = room.players[1].cards[3];
  act(
    room,
    host,
    {
      type: 'swap',
      targets: [
        { playerId: host, cardId: a.id },
        { playerId: guest, cardId: b.id },
      ],
    },
    now,
  );
  for (const viewer of [host, guest]) {
    const motion = publicRoom(room, viewer, now).movement!;
    assert.equal(motion.flights.length, 2);
    for (const f of motion.flights) assert.deepEqual(Object.keys(f.card), ['id']);
    assert.deepEqual(motion.flights[0].from, { zone: 'hand', playerId: host, index: 1 });
    assert.deepEqual(motion.flights[0].to, { zone: 'hand', playerId: guest, index: 3 });
    assert.equal(motion.hands[0].cardIds[1], a.id);
    assert.equal(motion.hands[1].cardIds[3], b.id);
  }
});
test('a buzzer snap retains its removed source slot for the drop before recentering', () => {
  const { room, host, now } = setup();
  const card = room.players[0].cards[2];
  room.discard.at(-1)!.rank = card.rank;
  const before = room.players[0].cards.map((c) => c.id);
  act(room, host, { type: 'buzz', topId: room.discard.at(-1)!.id }, now);
  act(room, host, { type: 'snap', target: { playerId: host, cardId: card.id } }, now + 100);
  assert.equal(room.snap, null);
  assert.equal(room.movement?.kind, 'snap');
  assert.deepEqual(room.movement?.hands[0].cardIds, before);
  assert.equal(room.movement?.flights[0].card.id, card.id);
  assert.equal(room.players[0].cards.length, 3);
});
test('opponent gifts stay hidden while the matched card travels publicly to discard', () => {
  const { room, host, guest, now } = setup();
  const match = room.players[1].cards[0];
  room.discard.at(-1)!.rank = match.rank;
  const given = room.players[0].cards[0];
  act(room, host, { type: 'buzz', topId: room.discard.at(-1)!.id }, now);
  act(room, host, { type: 'snap', target: { playerId: guest, cardId: match.id } }, now + 100);
  act(room, host, { type: 'give', cardId: given.id }, now + 200);
  const motion = publicRoom(room, guest, now + 200).movement!;
  assert.equal(motion.kind, 'gift');
  assert.equal(motion.flights[0].card.rank, match.rank);
  assert.deepEqual(motion.flights[1].card, { id: given.id });
  assert.deepEqual(motion.flights[1].to, { zone: 'hand', playerId: guest, index: 0 });
});
test('buzzer timeout animates an unseen penalty from the deck', () => {
  const { room, host, guest, now } = setup();
  act(room, host, { type: 'buzz', topId: room.discard.at(-1)!.id }, now);
  tick(room, now + 8000);
  const motion = publicRoom(room, guest, now + 8000).movement!;
  assert.equal(motion.kind, 'penalty');
  assert.deepEqual(Object.keys(motion.flights[0].card), ['id']);
  assert.deepEqual(motion.flights[0].from, { zone: 'deck' });
});

test('playing a power and skipping its swap publishes distinct notices to every seat', () => {
  const { room, host, guest, now } = setup();
  const jack = room.deck.findIndex((card) => card.rank === 'J');
  [room.deck[jack], room.deck[room.deck.length - 1]] = [room.deck.at(-1)!, room.deck[jack]];
  act(room, host, { type: 'draw' }, now);
  act(room, host, { type: 'power' }, now + 800);
  const power = publicRoom(room, guest, now + 800).events.at(-1)!;
  assert.equal(power.announcement, 'Power played');
  assert.equal(room.stage, 'power-swap');
  act(room, host, { type: 'skip-swap' }, now + 800 + CARD_SETTLE_MS);
  const skip = room.events.at(-1)!;
  assert.equal(skip.announcement, 'Swap skipped');
  assert.notEqual(skip.id, power.id);
  assert.equal(skip.at, now + 800 + CARD_SETTLE_MS);
  assert.deepEqual(
    publicRoom(room, host, skip.at).events.at(-1),
    publicRoom(room, guest, skip.at).events.at(-1),
  );
  assert.equal(room.stage, 'between');
});
