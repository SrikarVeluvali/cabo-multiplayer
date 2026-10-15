import test from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  createRoom,
  current,
  finish,
  INITIAL_PEEK_MS,
  player,
  powerFor,
  publicRoom,
  tick,
  value,
} from '../lib/game';
import type { Card, Rank, Room, Suit } from '../lib/types';

let sequence = 0;
const card = (rank: Rank = '5', suit: Suit = 'clubs'): Card => ({
  id: `test-${++sequence}`,
  rank,
  suit,
});
function fixture(n = 2) {
  const room = createRoom('ABC234', 'Host', 'host-token');
  for (let i = 1; i < n; i++) {
    const p = player(`Guest ${i}`);
    p.ready = true;
    room.players.push(p);
    room.tokens[`guest-${i}`] = p.id;
  }
  const start = Date.now();
  act(room, room.hostId, { type: 'start' }, start);
  return { room, start, id: room.hostId, guest: room.players[1].id };
}
function playing(n = 2) {
  const f = fixture(n);
  const now = f.room.deadline;
  tick(f.room, now);
  return { ...f, now };
}
function held(room: Room, c: Card, now: number) {
  room.drawn = c;
  room.stage = 'choose';
  room.availableAt = now;
}

test('a single shuffled 52-card deck deals four per player with opaque unique IDs', () => {
  const { room } = fixture(6);
  assert.equal(room.deck.length, 27);
  assert.equal(room.discard.length, 1);
  const cards = [...room.deck, ...room.discard, ...room.players.flatMap((p) => p.cards)];
  assert.equal(new Set(cards.map((c) => c.id)).size, 52);
  assert.equal(new Set(cards.map((c) => `${c.rank}-${c.suit}`)).size, 52);
});
test('opening peek is exactly 15 seconds after dealing, limited to two chosen own cards', () => {
  const { room, start, id, guest } = fixture();
  const a = room.players[0].cards;
  assert.equal(room.deadline - room.availableAt, INITIAL_PEEK_MS);
  assert.throws(() => act(room, id, { type: 'initial-peek', cardId: a[0].id }, start), /deal/);
  act(room, id, { type: 'initial-peek', cardId: a[2].id }, start + 2000);
  act(room, id, { type: 'initial-peek', cardId: a[0].id }, start + 2000);
  assert.throws(
    () => act(room, id, { type: 'initial-peek', cardId: a[1].id }, start + 2001),
    /two/,
  );
  assert.throws(
    () => act(room, guest, { type: 'initial-peek', cardId: a[0].id }, start + 2001),
    /own/,
  );
  const snapshot = publicRoom(room, id, start + 2100);
  assert.deepEqual(
    snapshot.players[0].cards.map((c) => !!c.rank),
    [true, false, true, false],
  );
  assert.ok(publicRoom(room, guest, start + 2100).players[0].cards.every((c) => !c.rank));
  assert.ok(publicRoom(room, id, room.deadline).players[0].cards.every((c) => !c.rank));
  tick(room, room.deadline);
  assert.equal(room.phase, 'playing');
  assert.deepEqual(room.initialChoices, {});
});
test('public snapshots never expose tokens, deck, memory, opponent cards, or private draws', () => {
  const { room, id, guest, now } = playing();
  act(room, id, { type: 'draw' }, now);
  const own = publicRoom(room, id, now),
    other = publicRoom(room, guest, now);
  assert.ok(own.drawn?.rank);
  assert.equal(other.drawn?.rank, undefined);
  for (const forbidden of ['tokens', 'deck', 'initialChoices', 'snapAttempts', 'privatePeek'])
    assert.equal(forbidden in other, false);
  assert.equal('memory' in other.players[0], false);
  assert.ok(other.players.flatMap((p) => p.cards).every((c) => Object.keys(c).join(',') === 'id'));
});
test('only the active player can draw; server enforces movement pause', () => {
  const { room, id, guest, now } = playing();
  assert.throws(() => act(room, guest, { type: 'draw' }, now), /turn/);
  act(room, id, { type: 'draw' }, now);
  assert.throws(() => act(room, id, { type: 'discard' }, now), /settle/);
  act(room, id, { type: 'discard' }, now + 751);
  assert.equal(room.stage, 'between');
});
test('replacement retains hand position and discards old card without activating its power', () => {
  const { room, id, now } = playing();
  const old = card('Q');
  room.players[0].cards[2] = old;
  const fresh = card('2');
  held(room, fresh, now);
  act(room, id, { type: 'replace', cardId: old.id }, now);
  assert.equal(room.players[0].cards[2].id, fresh.id);
  assert.equal(room.discard.at(-1)?.id, old.id);
  assert.equal(room.power, null);
  assert.equal(room.stage, 'between');
  assert.equal(room.availableAt, now + 3000);
  assert.equal(publicRoom(room, id, now).replacement?.incoming.rank, fresh.rank);
  assert.equal(publicRoom(room, room.players[1].id, now).replacement?.incoming.rank, undefined);
  assert.equal(publicRoom(room, room.players[1].id, now).replacement?.discarded.id, old.id);
  assert.equal(publicRoom(room, id, now + 3000).replacement, null);
});
for (const rank of ['7', '8', '9', '10', 'J', 'Q', 'K'] as Rank[])
  test(`${rank} has the specified power`, () => {
    const p = powerFor(card(rank, 'spades'))!;
    assert.ok(p);
    assert.equal(p.count, rank === 'K' ? 2 : rank === 'J' ? 0 : 1);
    assert.equal(p.swap, ['J', 'Q', 'K'].includes(rank));
  });
test('red kings score -1 and cannot play a power; other face values are correct', () => {
  assert.equal(value(card('K', 'hearts')), -1);
  assert.equal(value(card('K', 'diamonds')), -1);
  assert.equal(powerFor(card('K', 'hearts')), null);
  assert.equal(value(card('K', 'spades')), 13);
  assert.equal(value(card('A')), 1);
  assert.equal(value(card('J')), 11);
  assert.equal(value(card('Q')), 12);
});
test('7/8 look at own card only; 9/10 spy on someone else only', () => {
  for (const rank of ['7', '8', '9', '10'] as Rank[]) {
    const { room, id, guest, now } = playing();
    held(room, card(rank), now);
    act(room, id, { type: 'power' }, now);
    const own = { playerId: id, cardId: room.players[0].cards[0].id },
      other = { playerId: guest, cardId: room.players[1].cards[0].id };
    const isOwn = ['7', '8'].includes(rank);
    assert.throws(
      () => act(room, id, { type: 'look', targets: [isOwn ? other : own] }, now + 2900),
      /allowed/,
    );
    act(room, id, { type: 'look', targets: [isOwn ? own : other] }, now + 2900);
    const targets = publicRoom(room, id, now + 3000)
      .players.flatMap((p) => p.cards)
      .filter((c) => c.rank);
    assert.equal(targets.length, 1);
    assert.ok(
      publicRoom(room, guest, now + 3000)
        .players.flatMap((p) => p.cards)
        .every((c) => !c.rank),
    );
    tick(room, now + 7900);
    assert.equal(room.stage, 'between');
  }
});
test('queen look and swap are independent; hide is enforced before swapping', () => {
  const { room, id, guest, now } = playing();
  held(room, card('Q'), now);
  act(room, id, { type: 'power' }, now);
  const a = { playerId: id, cardId: room.players[0].cards[1].id },
    b = { playerId: guest, cardId: room.players[1].cards[3].id };
  act(room, id, { type: 'look', targets: [a] }, now + 2900);
  assert.throws(() => act(room, id, { type: 'swap', targets: [a, b] }, now + 3000), /available/);
  act(room, id, { type: 'finish-look' }, now + 3100);
  assert.equal(room.stage, 'power-swap');
  assert.ok(
    publicRoom(room, id, now + 3100)
      .players.flatMap((p) => p.cards)
      .every((c) => !c.rank),
  );
  act(room, id, { type: 'skip-swap' }, now + 3200);
  assert.equal(room.stage, 'between');
});
test('black king looks at two distinct cards anywhere and may skip the look but swap', () => {
  const { room, id, guest, now } = playing();
  held(room, card('K', 'clubs'), now);
  act(room, id, { type: 'power' }, now);
  const a = { playerId: id, cardId: room.players[0].cards[0].id },
    b = { playerId: guest, cardId: room.players[1].cards[0].id };
  assert.throws(() => act(room, id, { type: 'look', targets: [a, a] }, now + 2900), /different/);
  act(room, id, { type: 'skip-look' }, now + 2900);
  act(room, id, { type: 'swap', targets: [a, b] }, now + 3000);
  assert.equal(room.players[0].cards[0].id, b.cardId);
  assert.equal(room.players[1].cards[0].id, a.cardId);
});
test('blind swaps support two different positions within the same hand', () => {
  const { room, id, now } = playing();
  held(room, card('J'), now);
  act(room, id, { type: 'power' }, now);
  const [a, b] = room.players[0].cards;
  act(
    room,
    id,
    {
      type: 'swap',
      targets: [
        { playerId: id, cardId: a.id },
        { playerId: id, cardId: b.id },
      ],
    },
    now + 2900,
  );
  assert.equal(room.players[0].cards[0].id, b.id);
  assert.equal(room.players[0].cards[1].id, a.id);
});
test('successful snaps work out of turn and match rank across suits', () => {
  const { room, guest, now } = playing();
  room.discard = [card('K', 'spades')];
  const match = card('K', 'hearts');
  room.players[1].cards = [match];
  act(room, guest, { type: 'buzz', topId: room.discard[0].id }, now);
  act(room, guest, { type: 'snap', target: { playerId: guest, cardId: match.id } }, now + 100);
  assert.equal(room.players[1].cards.length, 0);
  assert.equal(room.discard.at(-1)?.id, match.id);
  assert.equal(room.stage, 'draw');
});
test('incorrect snaps keep original card and deal exactly one hidden penalty; same-top retries rejected', () => {
  const { room, guest, now } = playing();
  room.discard = [card('8')];
  const wrong = card('2');
  room.players[1].cards = [wrong];
  const topId = room.discard[0].id;
  act(room, guest, { type: 'buzz', topId }, now);
  act(room, guest, { type: 'snap', target: { playerId: guest, cardId: wrong.id } }, now + 100);
  assert.equal(room.players[1].cards.length, 2);
  assert.equal(room.players[1].cards[0].id, wrong.id);
  assert.equal(publicRoom(room, guest, now + 100).players[1].cards[0].rank, wrong.rank);
  assert.equal(publicRoom(room, guest, now + 100).players[1].cards[1].rank, undefined);
  assert.ok(publicRoom(room, guest, now + 5100).players[1].cards.every((c) => !c.rank));
  assert.throws(() => act(room, guest, { type: 'buzz', topId }, now + 5200), /already/);
});
test('stale snap targets do not produce a penalty or remove a card', () => {
  const { room, guest, now } = playing();
  assert.throws(() => act(room, guest, { type: 'buzz', topId: 'old' }, now), /discard changed/);
  assert.equal(room.players[1].cards.length, 4);
});
test('CABO replaces the callers turn and gives exactly one turn to every other seat', () => {
  const { room, id, now } = playing(3);
  act(room, id, { type: 'cabo' }, now);
  assert.equal(room.finalTurns.length, 2);
  let time = room.deadline;
  tick(room, time);
  assert.equal(current(room).id, room.players[1].id);
  for (let i = 0; i < 2; i++) {
    time += 10;
    const turn = current(room).id;
    act(room, turn, { type: 'draw' }, time);
    act(room, turn, { type: 'discard' }, time + 800);
    time = room.deadline;
    tick(room, time);
  }
  assert.equal(room.phase, 'results');
  assert.equal(room.players[0].turns, 1);
  assert.equal(room.players[1].turns, 1);
  assert.equal(room.players[2].turns, 1);
});
test('caller loses ties; all other players with the lowest score share the win', () => {
  const { room, id } = playing(3);
  room.caboId = id;
  room.players.forEach((p) => (p.cards = [card('3')]));
  finish(room);
  assert.deepEqual(
    room.winners,
    room.players.slice(1).map((p) => p.id),
  );
  assert.equal(room.players[0].wins, 0);
  const other = playing(3).room;
  other.caboId = other.hostId;
  other.players[0].cards = [card('2')];
  other.players[1].cards = [card('4')];
  other.players[2].cards = [card('4')];
  finish(other);
  assert.deepEqual(other.winners, [other.hostId]);
});
test('when caller is beaten, only the actual lowest scores win', () => {
  const { room, id } = playing(3);
  room.caboId = id;
  room.players[0].cards = [card('7')];
  room.players[1].cards = [card('7')];
  room.players[2].cards = [card('2')];
  finish(room);
  assert.deepEqual(room.winners, [room.players[2].id]);
});
test('timeout discards a drawn card without power and advances play', () => {
  const { room, id, now } = playing();
  act(room, id, { type: 'draw' }, now);
  tick(room, room.deadline);
  assert.equal(room.stage, 'between');
  assert.equal(room.drawn, null);
  assert.equal(room.power, null);
  tick(room, room.deadline);
  assert.notEqual(current(room).id, id);
});
test('after CABO, recycling preserves top discard to finish the final turns', () => {
  const { room, id, now } = playing();
  room.caboId = room.players[1].id;
  room.deck = [];
  const old = card('2'),
    top = card('J');
  room.discard = [old, top];
  act(room, id, { type: 'draw' }, now);
  assert.equal(room.drawn?.id, old.id);
  assert.equal(room.discard[0].id, top.id);
});

test('without CABO an empty deck ends the round without recycling; lowest ties win', () => {
  const { room, id, now } = playing(3);
  room.deck = [];
  room.players[0].cards = [card('6')];
  room.players[1].cards = [card('2')];
  room.players[2].cards = [card('2')];
  const discard = room.discard.map((c) => c.id);
  act(room, id, { type: 'draw' }, now);
  assert.equal(room.phase, 'results');
  assert.equal(room.endReason, 'deck');
  assert.deepEqual(
    room.discard.map((c) => c.id),
    discard,
  );
  assert.deepEqual(
    room.winners,
    room.players.slice(1).map((p) => p.id),
  );
});

test('the last draw can replace a card, then scoring waits for its animation', () => {
  const { room, id, now } = playing();
  room.deck = [card('K', 'hearts')];
  room.players[0].cards = [card('9')];
  room.players[1].cards = [card('A')];
  act(room, id, { type: 'draw' }, now);
  assert.equal(room.phase, 'playing');
  act(room, id, { type: 'replace', cardId: room.players[0].cards[0].id }, now + 800);
  tick(room, now + 3799);
  assert.equal(room.phase, 'playing');
  tick(room, now + 3800);
  assert.equal(room.phase, 'results');
  assert.deepEqual(room.winners, [id]);
  assert.equal(room.players[0].cards[0].rank, 'K');
});

test('the final card power finishes before deck exhaustion reveals scores', () => {
  const { room, id, now } = playing();
  room.deck = [card('Q')];
  act(room, id, { type: 'draw' }, now);
  act(room, id, { type: 'power' }, now + 800);
  tick(room, now + 3700);
  assert.equal(room.phase, 'playing');
  act(room, id, { type: 'skip-look' }, now + 3700);
  act(room, id, { type: 'skip-swap' }, now + 3700);
  tick(room, now + 4700);
  assert.equal(room.phase, 'results');
  assert.equal(room.endReason, 'deck');
});
test('leaving from results keeps the selected seat index valid and transfers hosting', () => {
  const { room, id, guest } = playing(3);
  room.turnIndex = 2;
  finish(room);
  act(room, id, { type: 'leave' });
  assert.equal(room.hostId, guest);
  assert.ok(current(room));
  assert.equal(room.players.length, 2);
  assert.ok(room.winnerNames.length);
});
test('computer rounds finish and preserve all 52 physical cards through moves and swaps', () => {
  for (let run = 0; run < 5; run++) {
    const { room } = playing(4);
    room.players.forEach((p) => {
      p.bot = true;
      p.cards.slice(0, 2).forEach((c) => (p.memory[c.id] = value(c)));
    });
    let now = room.availableAt;
    for (let i = 0; i < 500 && room.phase !== 'results'; i++) {
      now += 2000;
      tick(room, now);
      const cards = [
        ...room.deck,
        ...room.discard,
        ...room.players.flatMap((p) => p.cards),
        ...(room.drawn ? [room.drawn] : []),
      ];
      assert.equal(cards.length, 52);
      assert.equal(new Set(cards.map((c) => c.id)).size, 52);
    }
    assert.equal(room.phase, 'results');
    assert.ok(room.winners.length);
  }
});
