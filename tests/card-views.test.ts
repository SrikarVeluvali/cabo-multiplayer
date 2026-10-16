import test from 'node:test';
import assert from 'node:assert/strict';
import { cardViews, VIEW_RETURN_MS } from '../lib/card-views';
import { createRoom, player, act, publicRoom } from '../lib/game';

function setup() {
  const game = createRoom('ABC234', 'Host', 'host');
  const guest = player('Guest');
  guest.ready = true;
  game.players.push(guest);
  act(game, game.hostId, { type: 'start' }, 0);
  game.initialChoices[game.hostId] = [game.players[0].cards[0].id];
  return { game, host: game.hostId, guest: guest.id, at: 2100 };
}

test('opening views wait for the deal and cannot interrupt or replay distribution', () => {
  const { game, host } = setup();
  assert.deepEqual(cardViews([], publicRoom(game, host, 1000), 1000), []);
  assert.equal(cardViews([], publicRoom(game, host, 2000), 2000).length, 1);
});
test('polls and a second opening choice do not restart the first outward flight', () => {
  const { game, host, at } = setup();
  const first = cardViews([], publicRoom(game, host, at), at);
  game.initialChoices[host].push(game.players[0].cards[1].id);
  const next = cardViews(first, publicRoom(game, host, at + 500), at + 500);
  assert.equal(next.length, 2);
  assert.equal(next[0].id, first[0].id);
  assert.equal(next[0].startedAt, at);
  assert.equal(next[1].startedAt, at + 500);
});
test('private views animate backs for observers and receive faces only for the authorized seat', () => {
  const { game, host, guest, at } = setup();
  const viewer = cardViews([], publicRoom(game, host, at), at);
  const observer = cardViews([], publicRoom(game, guest, at), at);
  assert.ok(viewer[0].card.rank);
  assert.equal(observer[0].card.rank, undefined);
  assert.equal(observer[0].viewerId, host);
});
test('an expired or early-finished look persists for one return trip then releases the slot', () => {
  const { game, host, at } = setup();
  const visible = cardViews([], publicRoom(game, host, at), at);
  game.initialChoices = {};
  const snapshot = publicRoom(game, host, at + 500);
  const returning = cardViews(visible, snapshot, at + 500);
  assert.equal(returning[0].returningAt, at + 500);
  assert.equal(returning[0].card.id, visible[0].card.id);
  const halfway = cardViews(returning, snapshot, at + 900);
  assert.equal(halfway[0].returningAt, at + 500);
  assert.deepEqual(cardViews(halfway, snapshot, at + 500 + VIEW_RETURN_MS), []);
});
test('opening timeout retains the return even before the next server poll changes phase', () => {
  const { game, host, at } = setup();
  const visible = cardViews([], publicRoom(game, host, at), at);
  const returning = cardViews(visible, publicRoom(game, host, game.deadline), game.deadline);
  assert.equal(returning[0].returningAt, game.deadline);
});
test('Mathbo expression-to-gift deadline changes keep the same public reveal mounted', () => {
  const { game, host, at } = setup();
  game.phase = 'playing';
  game.initialChoices = {};
  const card = game.players[1].cards[0];
  game.publicReveals[card.id] = at + 60000;
  const visible = cardViews([], publicRoom(game, host, at), at);
  game.publicReveals[card.id] = at + 8000;
  const next = cardViews(visible, publicRoom(game, host, at + 1000), at + 1000);
  assert.equal(next[0].id, visible[0].id);
  assert.equal(next[0].startedAt, visible[0].startedAt);
  assert.equal(next[0].until, at + 8000);
});
test('a public snap reveal waits for the server outcome instead of bouncing at timeout', () => {
  const { game, host, at } = setup();
  game.phase = 'playing';
  game.initialChoices = {};
  const card = game.players[1].cards[0];
  game.publicReveals[card.id] = at + 5000;
  game.snap = {
    playerId: host,
    topId: game.discard[0].id,
    stage: 'give',
    target: { playerId: game.players[1].id, cardId: card.id },
    pausedAt: at,
    deadline: at + 5000,
  };
  const visible = cardViews([], publicRoom(game, host, at), at);
  const pending = cardViews(visible, publicRoom(game, host, at + 5100), at + 5100);
  // publicRoom may remove expired faces while the presentation keeps the back
  // mounted until a subsequent authoritative mutation resolves the snap.
  assert.equal(pending[0].returningAt, undefined);
  assert.equal(pending[0].id, visible[0].id);
  assert.equal(pending[0].card.rank, visible[0].card.rank);
});
test('an explicit snap/discard flight takes ownership without a duplicate return', () => {
  const { game, host, at } = setup();
  const visible = cardViews([], publicRoom(game, host, at), at);
  const card = game.players[0].cards[0];
  game.initialChoices = {};
  game.movement = {
    id: 'snap-flight',
    kind: 'snap',
    at: at + 500,
    until: at + 2600,
    hands: [],
    flights: [{ card, faceUp: true, from: { zone: 'reveal' }, to: { zone: 'discard' } }],
  };
  assert.deepEqual(cardViews(visible, publicRoom(game, host, at + 500), at + 500), []);
});
test('a new round, results, or a transferred card cannot resurrect an old peek', () => {
  const { game, host, at } = setup();
  const visible = cardViews([], publicRoom(game, host, at), at);
  game.initialChoices = {};
  const card = game.players[0].cards.shift()!;
  game.players[1].cards.push(card);
  assert.deepEqual(cardViews(visible, publicRoom(game, host, at + 500), at + 500), []);
  game.round++;
  assert.deepEqual(cardViews(visible, publicRoom(game, host, at + 500), at + 500), []);
  game.phase = 'results';
  assert.deepEqual(cardViews(visible, publicRoom(game, host, at + 500), at + 500), []);
});
test('reduced motion shows active desks directly without retaining departing cards', () => {
  const { game, host, at } = setup();
  const visible = cardViews([], publicRoom(game, host, at), at, true);
  assert.equal(visible.length, 1);
  game.initialChoices = {};
  assert.deepEqual(cardViews(visible, publicRoom(game, host, at + 500), at + 500, true), []);
});
