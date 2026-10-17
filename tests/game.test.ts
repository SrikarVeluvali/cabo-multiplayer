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
  assert.equal(room.availableAt, start + 18000);
  assert.throws(() => act(room, id, { type: 'draw' }, start + 17500), /settle/);
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
  assert.throws(() => act(room, id, { type: 'swap', targets: [a, b] }, now + 3200), /settle/);
  act(room, id, { type: 'skip-swap' }, now + 4100);
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
function assertCompleteDeck(room: Room) {
  const cards = [
    ...room.deck,
    ...room.discard,
    ...room.players.flatMap((p) => p.cards),
    ...(room.drawn ? [room.drawn] : []),
  ];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map((c) => c.id)).size, 52);
}

test('leaving during play returns the entire hand, revokes the seat, and transfers hosting', () => {
  const { room, id, guest, now } = playing(3);
  const returned = room.players[0].cards.map((c) => c.id);
  const deckCount = room.deck.length;
  room.players[1].memory[returned[0]] = 5;
  room.publicReveals[returned[0]] = now + 5000;
  act(room, id, { type: 'leave' }, now);
  assert.equal(room.phase, 'playing');
  assert.equal(room.hostId, guest);
  assert.equal(current(room).id, guest);
  assert.equal(room.stage, 'draw');
  assert.equal(room.deadline, now + room.settings.turnSeconds * 1000);
  assert.equal(room.tokens['host-token'], undefined);
  assert.equal(room.deck.length, deckCount + 4);
  assert.ok(returned.every((id) => room.deck.some((c) => c.id === id)));
  assert.equal(room.players[0].memory[returned[0]], undefined);
  assert.equal(room.publicReveals[returned[0]], undefined);
  assert.throws(() => act(room, id, { type: 'draw' }, now), /seat/);
  assert.ok(
    publicRoom(room, guest, now)
      .players.flatMap((p) => p.cards)
      .every((c) => !c.rank),
  );
  assertCompleteDeck(room);
});

test('leaving while holding a draw shuffles it back too, without changing the discard', () => {
  const { room, id, now } = playing(3);
  act(room, id, { type: 'draw' }, now);
  const drawnId = room.drawn!.id;
  const discard = room.discard.map((c) => c.id);
  act(room, id, { type: 'leave' }, now + 100);
  assert.equal(room.drawn, null);
  assert.equal(room.power, null);
  assert.ok(room.deck.some((c) => c.id === drawnId));
  assert.deepEqual(
    room.discard.map((c) => c.id),
    discard,
  );
  assertCompleteDeck(room);
});

test('seat removal preserves the active player or selects the correct clockwise successor', () => {
  for (let turn = 0; turn < 4; turn++) {
    for (let leaving = 0; leaving < 4; leaving++) {
      const { room, now } = playing(4);
      room.turnIndex = turn;
      const nextId = room.players[leaving === turn ? (turn + 1) % 4 : turn].id;
      const deadline = room.deadline;
      act(room, room.players[leaving].id, { type: 'leave' }, now + 100);
      assert.equal(current(room).id, nextId);
      if (turn !== leaving) assert.equal(room.deadline, deadline);
      assertCompleteDeck(room);
    }
  }
});

test('leaving during the opening peek preserves the other choices and opening timer', () => {
  const { room, start, id, guest } = fixture(3);
  const time = start + 2100;
  const choice = room.players[1].cards[0].id;
  act(room, guest, { type: 'initial-peek', cardId: choice }, time);
  const deadline = room.deadline;
  act(room, id, { type: 'leave' }, time);
  assert.equal(room.phase, 'peek');
  assert.equal(room.deadline, deadline);
  assert.deepEqual(room.initialChoices[guest], [choice]);
  tick(room, deadline);
  assert.equal(current(room).id, guest);
  assert.equal(room.phase, 'playing');
  assertCompleteDeck(room);
});

for (const phase of ['peek', 'playing'] as const)
  test(`leaving ${phase} ends a solo human game immediately instead of letting bots continue`, () => {
    const { room, id } = fixture(3);
    if (phase === 'playing') tick(room, room.deadline);
    room.players.slice(1).forEach((p) => (p.bot = true));
    const now = room.availableAt + 100;
    act(room, id, { type: 'leave' }, now);
    assert.equal(room.phase, 'results');
    assert.equal(room.endReason, 'players');
    assert.equal(room.deadline, 0);
    assert.equal(room.snap, null);
    assert.equal(room.privatePeek, null);
    assert.deepEqual(room.winners, []);
    assert.ok(room.players.every((p) => p.wins === 0));
    const events = room.events.length;
    tick(room, now + 100_000);
    assert.equal(room.events.length, events);
    assertCompleteDeck(room);
    assert.doesNotThrow(() => publicRoom(room, id, now));
  });

test('a remaining human and bots keep playing; the last remaining player wins', () => {
  const { room, id, guest, now } = playing(3);
  const botId = room.players[2].id;
  room.players[2].bot = true;
  act(room, id, { type: 'leave' }, now);
  assert.equal(room.phase, 'playing');
  assert.equal(room.hostId, guest);
  act(room, botId, { type: 'leave' }, now + 100);
  assert.equal(room.phase, 'results');
  assert.equal(room.endReason, 'players');
  assert.deepEqual(room.winners, [guest]);
  assertCompleteDeck(room);
});

test('a departing CABO caller cancels the final lap and unlocks normal play', () => {
  const { room, id, guest, now } = playing(3);
  act(room, id, { type: 'cabo' }, now);
  tick(room, room.deadline);
  act(room, id, { type: 'leave' }, room.availableAt + 100);
  assert.equal(room.caboId, null);
  assert.deepEqual(room.finalTurns, []);
  assert.equal(current(room).id, guest);
  assert.equal(room.phase, 'playing');
  assertCompleteDeck(room);
});

test('a departing final-turn player is removed from CABO and play finishes after the remaining turn', () => {
  const { room, id, guest, now } = playing(3);
  const lastId = room.players[2].id;
  act(room, id, { type: 'cabo' }, now);
  tick(room, room.deadline);
  let time = room.availableAt;
  act(room, guest, { type: 'leave' }, time);
  assert.deepEqual(room.finalTurns, [lastId]);
  assert.equal(current(room).id, lastId);
  act(room, lastId, { type: 'draw' }, time);
  act(room, lastId, { type: 'discard' }, time + 800);
  time = room.deadline;
  tick(room, time);
  assert.equal(room.phase, 'results');
  assert.equal(room.endReason, 'cabo');
  assertCompleteDeck(room);
});

for (const stage of ['choose', 'math', 'give'] as const)
  test(`a departing snapper releases the ${stage} buzzer without a penalty`, () => {
    const { room, guest, now } = playing(3);
    room.settings.mode = stage === 'math' ? 'mathbo' : 'cabo';
    if (stage === 'give') room.players[2].cards[0].rank = room.discard.at(-1)!.rank;
    act(room, guest, { type: 'buzz', topId: room.discard.at(-1)!.id }, now);
    if (stage !== 'choose')
      act(
        room,
        guest,
        {
          type: 'snap',
          target: { playerId: room.players[2].id, cardId: room.players[2].cards[0].id },
        },
        now + 10,
      );
    assert.equal(room.snap?.stage, stage);
    act(room, guest, { type: 'leave' }, now + 100);
    assert.equal(room.snap, null);
    assert.deepEqual(room.publicReveals, {});
    assert.ok(room.players.every((p) => p.cards.length === 4));
    assert.ok(!room.events.some((e) => e.kind === 'penalty'));
    assertCompleteDeck(room);
  });

test('a departing Mathbo target cancels the challenge and gives the paused turn its time back', () => {
  const { room, id, guest, now } = playing(4);
  room.settings.mode = 'mathbo';
  const target = { playerId: room.players[2].id, cardId: room.players[2].cards[0].id };
  const deadline = room.deadline;
  act(room, guest, { type: 'buzz', topId: room.discard.at(-1)!.id }, now);
  act(room, guest, { type: 'snap', target }, now + 10);
  act(room, target.playerId, { type: 'leave' }, now + 4000);
  assert.equal(room.snap, null);
  assert.equal(current(room).id, id);
  assert.equal(room.deadline, deadline + 4000);
  assert.equal(room.players.find((p) => p.id === guest)!.cards.length, 4);
  assertCompleteDeck(room);
});

test('an unrelated departure preserves another player’s buzzer and current draw', () => {
  const { room, id, guest, now } = playing(4);
  act(room, id, { type: 'draw' }, now);
  const drawnId = room.drawn!.id;
  act(room, guest, { type: 'buzz', topId: room.discard.at(-1)!.id }, now + 800);
  const snap = structuredClone(room.snap);
  act(room, room.players[2].id, { type: 'leave' }, now + 900);
  assert.deepEqual(room.snap, snap);
  assert.equal(room.drawn?.id, drawnId);
  assert.equal(current(room).id, id);
  assertCompleteDeck(room);
});

for (const rank of ['9', 'Q'] as const)
  test(`leaving a privately viewed hand finishes the ${rank} look without stalling`, () => {
    const { room, id, guest, now } = playing(3);
    const nine = room.deck.find((c) => c.rank === rank)!;
    room.deck.splice(room.deck.indexOf(nine), 1);
    held(room, nine, now);
    act(room, id, { type: 'power' }, now);
    act(
      room,
      id,
      { type: 'look', targets: [{ playerId: guest, cardId: room.players[1].cards[0].id }] },
      now + 2900,
    );
    act(room, guest, { type: 'leave' }, now + 3000);
    assert.equal(room.privatePeek, null);
    assert.equal(room.stage, rank === 'Q' ? 'power-swap' : 'between');
    if (rank === 'Q') act(room, id, { type: 'skip-swap' }, room.availableAt);
    tick(room, room.deadline);
    assert.notEqual(current(room).id, id);
    assert.equal(room.stage, 'draw');
    assertCompleteDeck(room);
  });

test('leaving during a replacement clears its stale animation payload', () => {
  const { room, id, now } = playing(3);
  act(room, id, { type: 'draw' }, now);
  act(room, id, { type: 'replace', cardId: room.players[0].cards[0].id }, now + 800);
  act(room, id, { type: 'leave' }, now + 900);
  assert.equal(room.replacement, null);
  assert.doesNotThrow(() => publicRoom(room, id, now + 900));
  assertCompleteDeck(room);
});

function botSwapFixture() {
  const f = playing();
  const bot = f.room.players[0];
  bot.bot = true;
  bot.cards = [card('Q'), card('2'), card('5'), card('6')];
  bot.memory = { [bot.cards[0].id]: 12, [bot.cards[1].id]: 2 };
  f.room.players[1].cards = [card('3'), card('4'), card('5'), card('6')];
  f.room.snapAttempts[bot.id] = f.room.discard.at(-1)!.id;
  f.room.stage = 'power-swap';
  f.room.power = powerFor(card('J'));
  return { ...f, bot };
}

test('bots blind-swap a remembered high card for an unknown opponent card', () => {
  const { room, bot, now } = botSwapFixture();
  const high = bot.cards[0];
  const other = room.players[1].cards[0];
  tick(room, now);
  assert.equal(bot.cards[0].id, other.id);
  assert.equal(room.players[1].cards[0].id, high.id);
  assert.equal(room.movement?.kind, 'swap');
});

test('bots can swap an unknown own card for a remembered low opponent card', () => {
  const { room, bot, now } = botSwapFixture();
  bot.memory[bot.cards[0].id] = 1;
  const own = bot.cards[2];
  const other = room.players[1].cards[2];
  bot.memory[other.id] = 3;
  tick(room, now);
  assert.equal(bot.cards[2].id, other.id);
  assert.equal(room.players[1].cards[2].id, own.id);
});

test('bots prefer the best remembered swap and never inspect hidden faces to decide', () => {
  for (const hiddenRank of ['A', 'K'] as const) {
    const { room, bot, now } = botSwapFixture();
    room.players[1].cards[0].rank = hiddenRank;
    const best = room.players[1].cards[2];
    bot.memory[best.id] = 2;
    bot.memory[room.players[1].cards[1].id] = 5;
    tick(room, now);
    assert.equal(bot.cards[0].id, best.id);
  }
});

test('bots skip unhelpful swaps and cannot trade with the CABO caller', () => {
  const { room, bot, now } = botSwapFixture();
  bot.cards.forEach((c) => (bot.memory[c.id] = 2));
  tick(room, now);
  assert.equal(room.events.at(-1)?.announcement, 'Swap skipped');
  const locked = botSwapFixture();
  locked.room.caboId = locked.guest;
  locked.bot.memory[locked.room.players[1].cards[0].id] = -1;
  tick(locked.room, locked.now);
  assert.equal(locked.room.events.at(-1)?.announcement, 'Swap skipped');
});

for (const rank of ['J', 'Q', 'K'] as const) {
  test(`a bot uses ${rank}'s swap power instead of a less valuable replacement`, () => {
    const { room, bot, now } = botSwapFixture();
    bot.cards[0].rank = 'K';
    bot.memory[bot.cards[0].id] = 13;
    held(room, card(rank, 'spades'), now);
    tick(room, now);
    assert.equal(room.events.at(-1)?.announcement, 'Power played');
    assert.equal(room.stage, rank === 'J' ? 'power-swap' : 'power-look');
    room.snapAttempts[bot.id] = room.discard.at(-1)!.id;
    let swapAt = room.availableAt;
    if (rank !== 'J') {
      tick(room, room.availableAt);
      assert.equal(room.privatePeek?.cardIds[0], room.players[1].cards[0].id);
      assert.equal(room.privatePeek?.cardIds.length, rank === 'K' ? 2 : 1);
      tick(room, room.privatePeek!.until);
      swapAt = room.availableAt;
    }
    tick(room, swapAt);
    assert.equal(room.events.at(-1)?.announcement, 'Cards swapped');
    assert.equal(room.movement?.kind, 'swap');
  });
}

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
