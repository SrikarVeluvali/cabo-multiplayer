import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMathbo, evaluateMathbo, simpleMathbo } from '../lib/mathbo';
import { act, createRoom, player, publicRoom, tick, CARD_SETTLE_MS } from '../lib/game';
import type { Card } from '../lib/types';

for (const [expression, source, target] of [
  ['4', 4, 4],
  ['4 × 2', 4, 8],
  ['4+4', 4, 8],
  ['4+(4*3)', 4, 16],
  ['4+(4/2)', 4, 6],
  ['6+(6/2)', 6, 9],
  ['(6*2)-(6/2)', 6, 9],
  ['(6+6)-(6/2)', 6, 9],
  ['6+(6+(6/2))', 6, 15],
  ['nCr(4,2)+sqrt(4)', 4, 8],
  ['6+-6', 6, 0],
  ['4!', 4, 24],
  ['log2(8)', 8, 3],
  ['log10(10)', 10, 1],
  ['nCr(4,2)', 4, 6],
  ['nPr(3,2)', 3, 6],
  ['sqrt(4)', 4, 2],
  ['abs(-1)', -1, 1],
  ['abs(-4)', 4, 4],
  ['--1', -1, 1],
  ['-4', 4, -4],
  ['-1', -1, -1],
  ['abs(-1)+abs(-1)', -1, 2],
  ['(-1)+(-1)', -1, -2],
  ['(-1)*(-13)', -1, 13],
  ['2^3^2', 3, 512],
  ['-2^2', 2, -4],
  ['4^(-1)', 4, 0.25],
  ['(4)/(4)', 4, 1],
  ['6*1.5', 6, 9],
  ['6*(6/6)*1.5', 6, 9],
  ['6+6/6', 6, 7],
  ['(6/6)*1', 6, 1],
  ['1*9', 1, 9],
  ['9/(-1)', -1, -9],
] as const) {
  test(`Mathbo accepts ${expression} = ${target} using ${source}`, () => {
    assert.equal(evaluateMathbo(expression, source), target);
    assert.equal(checkMathbo(expression, source, target), target);
  });
}
for (const expression of [
  '4*(2+3)',
  '(4*2)+1',
  '4-(2+3)',
  'abs(-1)+2',
  '4+2',
  '2+4',
  '4-2',
  '2-4',
  '4+(4+1)',
  '(4+1)+4',
  '4+(4-1)',
  '4^(2+2)',
  'nCr(4,2+1)',
  '(4/2)+2',
  '4+(8-4)',
  '4+(-2)',
  '(-1)+1',
  '1+(-1)',
]) {
  test(`Mathbo requires the card in both terms of every addition or subtraction: ${expression}`, () => {
    assert.throws(
      () => evaluateMathbo(expression, expression.includes('-1') ? -1 : 4),
      /Both sides/,
    );
  });
}

for (const [source, target, expression] of [
  [6, 9, '6+3'],
  [2, 3, '2+1'],
  [10, 13, '10+3'],
  [6, 7, '6+1'],
  [7, 8, '7+1'],
  [8, 9, '8+1'],
] as const) {
  test(`the server rejects the reported illegal snap ${expression} = ${target}`, () => {
    assert.throws(() => checkMathbo(expression, source, target), /Both sides/);
    const { room, host, now, select } = setup();
    room.players[0].cards[0].rank = source === 10 ? '10' : (String(source) as Card['rank']);
    room.discard[0].rank = target === 13 ? 'K' : (String(target) as Card['rank']);
    const challengeId = select();
    const count = room.players[0].cards.length;
    act(room, host, { type: 'math-submit', challengeId, expression }, now + 200);
    assert.equal(room.players[0].cards.length, count + 1);
    assert.equal(room.players[0].cards[0].id, 'own-four');
    assert.equal(room.discard.at(-1)?.id, 'top');
    assert.equal(room.events.at(-1)?.announcement, 'Mathbo missed');
    assert.equal(
      room.events.some((e) => e.equation === `${expression} = ${target}`),
      false,
    );
  });
}

test('bot addition and subtraction use card-derived terms on both sides', () => {
  assert.equal(simpleMathbo(6, 7), '6+6/6');
  assert.equal(simpleMathbo(6, 5), '6-6/6');
  for (const source of [-1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    for (const target of [-1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
      const expression = simpleMathbo(source, target);
      if (expression) assert.equal(checkMathbo(expression, source, target), target);
    }
});

for (const expression of [
  '4^0',
  '4^(-0)*8',
  '(4^0)*8',
  '8/(4^0)',
  '4^(4-4)*8',
  '4^(log2(1))*8',
  '4^sqrt(0)*8',
  '4^((4/4)-(4/4))*8',
]) {
  test(`zero-exponent padding is rejected even when the exponent is calculated: ${expression}`, () => {
    assert.throws(() => evaluateMathbo(expression, 4), /Zero exponents/);
  });
}

test('a zero-exponent snap gets a penalty instead of being accepted as use of the card', () => {
  const { room, host, now, select } = setup();
  const challengeId = select();
  const count = room.players[0].cards.length;
  act(room, host, { type: 'math-submit', challengeId, expression: '4^(4-4)*8' }, now + 200);
  assert.equal(room.players[0].cards.length, count + 1);
  assert.equal(room.discard.at(-1)?.id, 'top');
  assert.equal(room.events.at(-1)?.announcement, 'Mathbo missed');
  assert.match(room.events.at(-1)!.text, /Zero exponents/);
});

for (const [source, expression] of [
  [6, '(6/6)*9'],
  [6, '9*(6/6)'],
  [6, '9/(6/6)'],
  [6, '(6*9)/6'],
  [6, '6/(6/9)'],
  [6, '-(6/6)*(-9)'],
  [6, 'sqrt((6/6)*81)'],
  [6, '6+(6/6)*3'],
  [6, '((6*2)/(6*2))*9'],
  [6, 'nCr(6,0)*9'],
  [6, 'nPr(6,0)*9'],
  [6, 'sqrt(6/6)*9'],
  [6, '(6/6)^2*9'],
  [6, '9^(6/6)'],
  [6, '9/(6/6)^2'],
  [-1, '(-1)/(-1)*9'],
  [10, 'log10(10)*9'],
  [2, 'log2(2)*9'],
] as const) {
  test(`identity padding cannot supply a free-number answer: ${expression}`, () => {
    assert.throws(() => evaluateMathbo(expression, source), /cancel the card/);
  });
}

for (const other of [false, true]) {
  test(`a cancellation-padded ${other ? 'opponent' : 'own'} snap gets one hidden penalty`, () => {
    const { room, host, guest, now, select } = setup();
    const challengeId = select(other);
    const count = room.players[0].cards.length;
    act(room, host, { type: 'math-submit', challengeId, expression: '(4/4)*8' }, now + 200);
    assert.equal(room.players[0].cards.length, count + 1);
    assert.equal(room.players[1].cards.length, 4);
    assert.equal(room.discard.at(-1)?.id, 'top');
    assert.equal(room.snap, null);
    assert.equal(room.events.at(-1)?.announcement, 'Mathbo missed');
    assert.match(room.events.at(-1)!.text, /cancel the card/);
    assert.equal(publicRoom(room, guest, now + 201).players[0].cards.at(-1)?.rank, undefined);
    tick(room, now + 6000);
    assert.equal(room.players[0].cards.length, count + 1);
  });
}
test('a different number alone is not an expression using the selected card', () => {
  assert.throws(() => checkMathbo('8', 4, 8), /selected card/);
  assert.throws(() => checkMathbo('4*3', 4, 8), /not 8/);
});
for (const expression of [
  '4/0',
  'log2(-4)',
  'sqrt(-4)',
  '(-1)^0.5',
  'nCr(4,5)',
  'nPr(4,1.5)',
  '(-4)!',
  '4^9999',
  '4(2)',
  'process.exit()',
  '4.constructor',
  '4;alert(1)',
  'Math.log2(4)',
]) {
  test(`Mathbo rejects unsafe, undefined, or unsupported input: ${expression}`, () => {
    assert.throws(() => evaluateMathbo(expression, 4));
  });
}
test('Mathbo bounds expression length, nesting, and intermediate values', () => {
  assert.throws(() => evaluateMathbo('4'.repeat(161), 4), /160/);
  assert.throws(() => evaluateMathbo('('.repeat(30) + '4' + ')'.repeat(30), 4), /nested/);
  assert.throws(() => evaluateMathbo('999999999999*4', 4), /trillion/);
});

function setup(seconds = 10) {
  const room = createRoom('ABC234', 'Host', 'host');
  const guest = player('Guest');
  guest.ready = true;
  room.players.push(guest);
  act(room, room.hostId, {
    type: 'settings',
    settings: { turnSeconds: 45, pace: 'relaxed', mode: 'mathbo', mathSeconds: seconds },
  });
  act(room, room.hostId, { type: 'start' });
  const now = room.deadline;
  tick(room, now);
  room.discard = [{ id: 'top', rank: '8', suit: 'clubs' }];
  room.players[0].cards[0] = { id: 'own-four', rank: '4', suit: 'hearts' };
  room.players[1].cards[0] = { id: 'other-four', rank: '4', suit: 'spades' };
  function select(other = false) {
    act(room, room.hostId, { type: 'buzz', topId: 'top' }, now);
    act(
      room,
      room.hostId,
      {
        type: 'snap',
        target: {
          playerId: other ? guest.id : room.hostId,
          cardId: other ? 'other-four' : 'own-four',
        },
      },
      now + 100,
    );
    return room.snap!.math!.id;
  }
  return { room, host: room.hostId, guest: guest.id, now, select };
}
test('Mathbo reveals only the selected card to all seats and uses the host timer', () => {
  const { room, host, guest, now, select } = setup(20);
  const deadline = room.deadline;
  select();
  assert.equal(room.snap?.stage, 'math');
  assert.equal(room.snap?.deadline, now + 20100);
  assert.equal(room.deadline, deadline);
  for (const viewer of [host, guest]) {
    const snapshot = publicRoom(room, viewer, now + 101);
    assert.equal(snapshot.players[0].cards[0].rank, '4');
    assert.equal(snapshot.players.flatMap((p) => p.cards).filter((c) => c.rank).length, 1);
    assert.equal(snapshot.snap?.math?.source, 4);
    assert.equal(snapshot.snap?.math?.target, 8);
  }
  assert.throws(() => act(room, guest, { type: 'draw' }, now + 200), /won the buzzer/);
});
test('a solved own-card Mathbo snaps from the public reveal and pauses the turn correctly', () => {
  const { room, host, now, select } = setup();
  const deadline = room.deadline;
  const id = select();
  const count = room.players[0].cards.length;
  act(room, host, { type: 'math-submit', challengeId: id, expression: '4*2' }, now + 5100);
  assert.equal(room.snap, null);
  assert.equal(room.players[0].cards.length, count - 1);
  assert.equal(room.discard.at(-1)?.id, 'own-four');
  assert.deepEqual(room.movement?.flights[0].from, { zone: 'reveal' });
  assert.equal(room.publicReveals['own-four'], undefined);
  assert.equal(room.deadline, deadline + 5100 + CARD_SETTLE_MS);
  assert.equal(room.events.at(-1)?.equation, '4×2 = 8');
  assert.equal(publicRoom(room, room.players[1].id, now + 5100).events.at(-1)?.equation, '4×2 = 8');
});
test('Mathbo opponent snaps still require a hidden gift into the original slot', () => {
  const { room, host, guest, now, select } = setup();
  const id = select(true);
  const given = room.players[0].cards[1];
  act(room, host, { type: 'math-submit', challengeId: id, expression: '4+4' }, now + 1000);
  assert.equal(room.snap?.stage, 'give');
  assert.equal(room.snap?.deadline, now + 9000);
  assert.equal(room.discard.at(-1)?.id, 'top');
  assert.equal(room.events.at(-1)?.equation, '4+4 = 8');
  act(room, host, { type: 'give', cardId: given.id }, now + 1100);
  assert.equal(room.players[1].cards[0].id, given.id);
  assert.equal(room.players[0].cards.length, 3);
  assert.equal(room.discard.at(-1)?.id, 'other-four');
  assert.equal(publicRoom(room, guest, now + 1100).players[1].cards[0].rank, undefined);
});
for (const expression of ['4*3', '8', '4*(2+2)', 'bad syntax', '']) {
  test(`a failed Mathbo submission gives exactly one penalty: ${expression || '(forfeit)'}`, () => {
    const { room, host, guest, now, select } = setup();
    const deadline = room.deadline;
    const id = select(true);
    const ownCount = room.players[0].cards.length;
    act(room, host, { type: 'math-submit', challengeId: id, expression }, now + 5100);
    assert.equal(room.snap, null);
    assert.equal(room.players[0].cards.length, ownCount + 1);
    assert.equal(room.players[1].cards[0].id, 'other-four');
    assert.equal(room.publicReveals['other-four'], now + 10100);
    assert.equal(room.deadline, deadline + 5100 + 5000);
    assert.equal(publicRoom(room, guest, now + 10099).players[1].cards[0].rank, '4');
    assert.equal(publicRoom(room, guest, now + 10100).players[1].cards[0].rank, undefined);
    assert.equal(publicRoom(room, host, now + 5100).players[0].cards.at(-1)?.rank, undefined);
    assert.throws(() =>
      act(room, host, { type: 'math-submit', challengeId: id, expression: '4*2' }, now + 5200),
    );
    assert.equal(room.players[0].cards.length, ownCount + 1);
  });
}
test('an expired Mathbo challenge reveals the chosen card for five more seconds and penalizes once', () => {
  const { room, now, select } = setup(5);
  select();
  const deadline = room.snap!.deadline;
  tick(room, deadline - 1);
  assert.equal(room.snap?.stage, 'math');
  tick(room, deadline);
  assert.equal(room.snap, null);
  assert.equal(room.players[0].cards.length, 5);
  assert.equal(room.publicReveals['own-four'], deadline + 5000);
  tick(room, deadline + 1);
  assert.equal(room.players[0].cards.length, 5);
});
test('only the buzzer owner may submit, and stale challenge IDs cannot resolve a later challenge', () => {
  const { room, host, guest, now, select } = setup();
  const id = select();
  assert.throws(
    () => act(room, guest, { type: 'math-submit', challengeId: id, expression: '4*2' }, now + 200),
    /won the buzzer/,
  );
  assert.throws(
    () =>
      act(room, host, { type: 'math-submit', challengeId: 'old', expression: '4*2' }, now + 200),
    /current Mathbo/,
  );
  assert.equal(room.snap?.stage, 'math');
  assert.equal(room.players[0].cards.length, 4);
});
test('Mathbo accepts a card with no operation and uses red king score -1', () => {
  const { room, host, now, select } = setup();
  const redKing: Card = { id: 'red-king', rank: 'K', suit: 'hearts' };
  room.discard = [{ id: 'top', rank: 'K', suit: 'diamonds' }];
  room.players[0].cards[0] = redKing;
  act(room, host, { type: 'buzz', topId: 'top' }, now);
  act(room, host, { type: 'snap', target: { playerId: host, cardId: redKing.id } }, now + 100);
  assert.equal(room.snap?.math?.source, -1);
  assert.equal(room.snap?.math?.target, -1);
  act(
    room,
    host,
    { type: 'math-submit', challengeId: room.snap!.math!.id, expression: '-1' },
    now + 200,
  );
  assert.equal(room.discard.at(-1)?.id, redKing.id);
  assert.equal(room.players[0].cards.length, 3);
});
test('Mathbo keeps CABO hands locked against opponent transfers', () => {
  const { room, host, guest, now } = setup();
  room.caboId = guest;
  act(room, host, { type: 'buzz', topId: 'top' }, now);
  assert.throws(
    () =>
      act(
        room,
        host,
        { type: 'snap', target: { playerId: guest, cardId: 'other-four' } },
        now + 100,
      ),
    /locked/,
  );
  assert.equal(room.snap?.stage, 'choose');
});
test('only valid host-selected game modes and expression timers are accepted', () => {
  const room = createRoom('ABC234', 'Host', 'host');
  const guest = player('Guest');
  room.players.push(guest);
  assert.throws(() =>
    act(room, guest.id, {
      type: 'settings',
      settings: { turnSeconds: 45, pace: 'quick', mode: 'mathbo', mathSeconds: 10 },
    }),
  );
  assert.throws(
    () =>
      act(room, room.hostId, {
        type: 'settings',
        settings: { turnSeconds: 45, pace: 'quick', mode: 'mathbo', mathSeconds: 7 },
      }),
    /settings/,
  );
  act(room, room.hostId, {
    type: 'settings',
    settings: { turnSeconds: 45, pace: 'quick', mode: 'mathbo', mathSeconds: 60 },
  });
  assert.equal(room.settings.mathSeconds, 60);
});
test('a computer can select a remembered card and complete its Mathbo expression', () => {
  const { room, now } = setup();
  room.players[0].bot = true;
  room.players[0].memory = { 'own-four': 4 };
  tick(room, now + 2400);
  assert.equal(room.snap?.stage, 'choose');
  tick(room, now + 3600);
  assert.equal(room.snap?.stage, 'math');
  tick(room, now + 5400);
  assert.equal(room.snap, null);
  assert.equal(room.discard.at(-1)?.id, 'own-four');
  assert.equal(room.players[0].cards.length, 3);
});
test('an unavailable penalty card ends Mathbo cleanly without a phantom penalty or lingering reveal', () => {
  const { room, host, now, select } = setup();
  room.drawn = room.deck.pop()!;
  room.stage = 'choose';
  room.deck = [];
  const id = select();
  act(room, host, { type: 'math-submit', challengeId: id, expression: '4*3' }, now + 1000);
  assert.equal(room.phase, 'results');
  assert.equal(room.snap, null);
  assert.deepEqual(room.publicReveals, {});
  assert.equal(room.players[0].cards.length, 4);
});
