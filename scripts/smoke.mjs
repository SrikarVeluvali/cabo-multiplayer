import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
async function request(body, token) {
  const response = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
async function read(code, token) {
  const r = await fetch(`${base}/api/rooms?code=${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(r.ok);
  return (await r.json()).room;
}
const host = await request({ type: 'create', name: 'QA Host' }),
  code = host.room.code;
assert.equal((await fetch(`${base}/api/rooms?code=${code}`)).status, 401);
const crossOrigin = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' },
  body: JSON.stringify({ type: 'create', name: 'Forbidden' }),
});
assert.equal(crossOrigin.status, 403);
const guest = await request({ type: 'join', name: 'QA Guest', code });
const tokens = { [host.room.you]: host.token, [guest.room.you]: guest.token };
const send = async (id, action) => (await request({ code, action }, tokens[id])).room;
await send(guest.room.you, { type: 'ready' });
let room = await send(host.room.you, { type: 'start' });
assert.equal(room.phase, 'peek');
assert.equal(room.players.length, 2);
await pause(Math.max(0, room.availableAt - Date.now() + 80));
room = await send(host.room.you, { type: 'initial-peek', cardId: room.players[0].cards[1].id });
room = await send(host.room.you, { type: 'initial-peek', cardId: room.players[0].cards[3].id });
assert.equal(room.players[0].cards.filter((c) => c.rank).length, 2);
const other = await read(code, guest.token);
assert.ok(other.players[0].cards.every((c) => !c.rank));
await pause(Math.max(0, room.deadline - Date.now() + 80));
room = await read(code, host.token);
assert.equal(room.phase, 'playing');
assert.ok(room.players.flatMap((p) => p.cards).every((c) => !c.rank));
// Race two independent seats: precisely one reservation must commit.
const contenders = [host.room.you, guest.room.you];
const race = await Promise.allSettled(
  contenders.map((id) => send(id, { type: 'buzz', topId: room.discard.id })),
);
assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
const winner = contenders[race.findIndex((r) => r.status === 'fulfilled')];
room = await read(code, tokens[winner]);
assert.equal(room.snap.playerId, winner);
assert.ok(room.snap.deadline - room.serverNow <= 8000);
const target = room.players.find((p) => p.id !== winner),
  before = room.players.find((p) => p.id === winner).cards.length;
const targetId = target.cards[0].id;
room = await send(winner, { type: 'snap', target: { playerId: target.id, cardId: targetId } });
if (room.snap?.stage === 'give') {
  const given = room.players.find((p) => p.id === winner).cards[0].id;
  room = await send(winner, { type: 'give', cardId: given });
  assert.equal(room.players.find((p) => p.id === target.id).cards[0].id, given);
  assert.equal(room.discard.id, targetId);
} else {
  assert.equal(room.players.find((p) => p.id === winner).cards.length, before + 1);
  assert.ok(room.players.find((p) => p.id === target.id).cards[0].rank);
  const spectator = await read(code, tokens[target.id]);
  assert.ok(spectator.players.find((p) => p.id === target.id).cards[0].rank);
}
await pause(Math.max(0, room.availableAt - Date.now() + 100));
room = await read(code, host.token);
assert.ok(room.players.flatMap((p) => p.cards).every((c) => !c.rank));
room = await send(host.room.you, { type: 'draw' });
assert.ok(room.drawn.rank);
assert.equal((await read(code, guest.token)).drawn.rank, undefined);
await pause(Math.max(0, room.availableAt - Date.now() + 80));
room = await send(host.room.you, { type: 'replace', cardId: room.players[0].cards[0].id });
assert.equal(room.stage, 'between');
await pause(Math.max(0, room.deadline - Date.now() + 80));
room = await read(code, guest.token);
assert.equal(room.players[room.turnIndex].id, guest.room.you);
room = await send(guest.room.you, { type: 'cabo' });
assert.equal(room.finalTurns.length, 1);
await pause(Math.max(0, room.deadline - Date.now() + 80));
room = await read(code, host.token);
room = await send(host.room.you, { type: 'draw' });
await pause(Math.max(0, room.availableAt - Date.now() + 80));
room = await send(host.room.you, { type: 'discard' });
await pause(Math.max(0, room.deadline - Date.now() + 80));
room = await read(code, host.token);
assert.equal(room.phase, 'results');
assert.ok(room.players.every((p) => p.cards.every((c) => c.rank)));
assert.ok(room.winners.length);
assert.equal('tokens' in room, false);
assert.equal('deck' in room, false);
await send(host.room.you, { type: 'lobby' });
await send(guest.room.you, { type: 'leave' });
await send(host.room.you, { type: 'leave' });
console.log(
  'PASS: two authenticated seats, private peeks, competing buzzers, opponent snap, private draws, replacement, final turns, reveal, and leave.',
);
