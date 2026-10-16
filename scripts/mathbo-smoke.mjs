import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:3011';
function solution(source, target) {
  if (source === target) return String(source);
  // Every addition term uses the selected card. Do not use the old n*(target/n)
  // cancellation shortcut: the authoritative validator now rejects that padding.
  const unit = `(${source})/(${source})`;
  return target < 0 ? `-(${unit})` : Array.from({ length: target }, () => unit).join('+');
}
async function request(body, token) {
  const res = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
async function read(code, token) {
  const res = await fetch(`${base}/api/rooms?code=${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  assert.ok(res.ok, data.error);
  return data.room;
}
const host = await request({ type: 'create', name: 'Mathbo Host' }),
  code = host.room.code;
const guest = await request({ type: 'join', name: 'Mathbo Guest', code });
const tokens = { [host.room.you]: host.token, [guest.room.you]: guest.token };
const send = async (id, action) => (await request({ code, action }, tokens[id])).room;
let room = await send(host.room.you, {
  type: 'settings',
  settings: { turnSeconds: 60, pace: 'quick', mode: 'mathbo', mathSeconds: 5 },
});
assert.equal(room.settings.mode, 'mathbo');
await send(guest.room.you, { type: 'ready' });
room = await send(host.room.you, { type: 'start' });
await pause(Math.max(0, room.deadline - Date.now() + 100));
room = await read(code, host.token);
// The first player to buzz owns the card choice and expression stage.
const ids = [host.room.you, guest.room.you];
const race = await Promise.allSettled(
  ids.map((id) => send(id, { type: 'buzz', topId: room.discard.id })),
);
assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
const winner = ids[race.findIndex((r) => r.status === 'fulfilled')],
  loser = ids.find((id) => id !== winner);
room = await read(code, tokens[winner]);
const own = room.players.find((p) => p.id === winner),
  cardId = own.cards[0].id;
room = await send(winner, { type: 'snap', target: { playerId: winner, cardId } });
assert.equal(room.snap.stage, 'math');
assert.equal(room.players.flatMap((p) => p.cards).filter((c) => c.rank).length, 1);
const observer = await read(code, tokens[loser]);
assert.ok(observer.players.find((p) => p.id === winner).cards[0].rank);
const { source, target, id: challengeId } = room.snap.math;
room = await send(winner, {
  type: 'math-submit',
  challengeId,
  expression: solution(source, target),
});
assert.equal(room.snap, null);
assert.equal(room.discard.id, cardId);
assert.equal(room.players.find((p) => p.id === winner).cards.length, 3);
await pause(Math.max(0, room.availableAt - Date.now() + 100));
// An incorrect opponent equation only penalizes the snapper, not the owner.
room = await send(loser, { type: 'buzz', topId: room.discard.id });
const otherId = room.players.find((p) => p.id === winner).cards[0].id;
room = await send(loser, { type: 'snap', target: { playerId: winner, cardId: otherId } });
const before = room.players.find((p) => p.id === loser).cards.length;
room = await send(loser, {
  type: 'math-submit',
  challengeId: room.snap.math.id,
  expression: `(${room.snap.math.source})*0`,
});
assert.equal(room.snap, null);
assert.equal(room.players.find((p) => p.id === loser).cards.length, before + 1);
assert.equal(room.players.find((p) => p.id === winner).cards[0].id, otherId);
assert.ok(room.players.find((p) => p.id === winner).cards[0].rank);
assert.equal(room.players.find((p) => p.id === loser).cards.at(-1).rank, undefined);
await pause(Math.max(0, room.availableAt - Date.now() + 100));
room = await read(code, tokens[winner]);
assert.ok(room.players.flatMap((p) => p.cards).every((c) => !c.rank));
// The other player can still attempt this top discard and solve an opponent snap.
room = await send(winner, { type: 'buzz', topId: room.discard.id });
const attempted = room.players.find((p) => p.id === loser).cards[0].id;
room = await send(winner, { type: 'snap', target: { playerId: loser, cardId: attempted } });
const m = room.snap.math;
room = await send(winner, {
  type: 'math-submit',
  challengeId: m.id,
  expression: solution(m.source, m.target),
});
assert.equal(room.snap.stage, 'give');
const gift = room.players.find((p) => p.id === winner).cards[0].id;
room = await send(winner, { type: 'give', cardId: gift });
assert.equal(room.players.find((p) => p.id === loser).cards[0].id, gift);
assert.equal(room.discard.id, attempted);
await pause(Math.max(0, room.availableAt - Date.now() + 100));
// A new timed attempt must fail once, even when both clients poll it.
room = await send(loser, { type: 'buzz', topId: room.discard.id });
const timeoutCard = room.players.find((p) => p.id === loser).cards[0].id;
room = await send(loser, { type: 'snap', target: { playerId: loser, cardId: timeoutCard } });
const count = room.players.find((p) => p.id === loser).cards.length;
await pause(Math.max(0, room.snap.deadline - Date.now() + 100));
const polls = await Promise.all([read(code, tokens[winner]), read(code, tokens[loser])]);
for (const state of polls) {
  assert.equal(state.snap, null);
  assert.equal(state.players.find((p) => p.id === loser).cards.length, count + 1);
}
room = polls[0];
await pause(Math.max(0, room.availableAt - Date.now() + 100));
room = await read(code, host.token);
const caller = room.players[room.turnIndex].id;
room = await send(caller, { type: 'cabo' });
await pause(Math.max(0, room.deadline - Date.now() + 100));
room = await read(code, host.token);
const last = room.players[room.turnIndex].id;
room = await send(last, { type: 'draw' });
await pause(Math.max(0, room.availableAt - Date.now() + 100));
room = await send(last, { type: 'discard' });
await pause(Math.max(0, room.deadline - Date.now() + 100));
room = await read(code, host.token);
assert.equal(room.phase, 'results');
await send(host.room.you, { type: 'lobby' });
await send(guest.room.you, { type: 'leave' });
await send(host.room.you, { type: 'leave' });
console.log(
  'PASS: Mathbo buzzer race, public selected card, own equation, failed opponent equation, hidden gift, one timeout penalty, final turns, and cleanup.',
);
