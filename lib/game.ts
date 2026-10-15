import { randomInt, randomUUID } from 'node:crypto';
import type {
  Action,
  Card,
  CardFlight,
  CardMovement,
  Player,
  Power,
  PublicRoom,
  Rank,
  Room,
  Suit,
  Target,
} from './types';

export const INITIAL_PEEK_MS = 15_000;
export const POWER_PEEK_MS = 5_000;
export const SNAP_MS = 8_000;
export const CARD_FLIGHT_MS = 2100;
export const CARD_SETTLE_MS = 2800;
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export function value(card: Pick<Card, 'rank' | 'suit'>): number {
  if (card.rank === 'K' && (card.suit === 'hearts' || card.suit === 'diamonds')) return -1;
  return ranks.indexOf(card.rank) + 1;
}
export function powerFor(card: Card): Power | null {
  if (['7', '8'].includes(card.rank)) return { label: 'Peek', count: 1, scope: 'own', swap: false };
  if (['9', '10'].includes(card.rank))
    return { label: 'Spy', count: 1, scope: 'other', swap: false };
  if (card.rank === 'J') return { label: 'Blind swap', count: 0, scope: 'any', swap: true };
  if (card.rank === 'Q') return { label: 'Look & swap', count: 1, scope: 'any', swap: true };
  if (card.rank === 'K' && value(card) === 13)
    return { label: 'Double look & swap', count: 2, scope: 'any', swap: true };
  return null;
}
export function shuffle<T>(cards: T[]): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function player(name: string, bot = false): Player {
  return {
    id: randomUUID(),
    name: name.trim().slice(0, 20),
    cards: [],
    connected: Date.now(),
    bot,
    ready: bot,
    wins: 0,
    memory: {},
    turns: 0,
  };
}
export function addLog(
  room: Room,
  text: string,
  kind: Room['events'][number]['kind'] = 'info',
  now = Date.now(),
  announcement?: string,
) {
  room.events.push({
    id: randomUUID(),
    text,
    kind,
    at: now,
    ...(announcement ? { announcement } : {}),
  });
  room.events = room.events.slice(-500);
  room.updated = now;
}
export function createRoom(code: string, name: string, token: string): Room {
  const host = player(name);
  const room: Room = {
    code,
    version: 0,
    hostId: host.id,
    tokens: { [token]: host.id },
    players: [host],
    phase: 'lobby',
    stage: 'draw',
    settings: { turnSeconds: 45, pace: 'relaxed' },
    round: 0,
    deck: [],
    discard: [],
    drawn: null,
    power: null,
    turnIndex: 0,
    deadline: 0,
    availableAt: 0,
    updated: Date.now(),
    initialChoices: {},
    privatePeek: null,
    caboId: null,
    finalTurns: [],
    snapAttempts: {},
    snap: null,
    publicReveals: {},
    winners: [],
    winnerNames: [],
    events: [],
  };
  addLog(room, `${host.name} opened the table.`);
  return room;
}
export function current(room: Room) {
  return room.players[room.turnIndex];
}
function pace(room: Room) {
  return room.settings.pace === 'relaxed' ? 3000 : 1800;
}
function lock(room: Room, now: number, ms = 1000) {
  room.availableAt = now + ms;
}
function handSnapshot(...players: Player[]) {
  return players.map((p) => ({ playerId: p.id, cardIds: p.cards.map((c) => c.id) }));
}
function moveCards(
  room: Room,
  kind: CardMovement['kind'],
  flights: CardFlight[],
  hands: CardMovement['hands'],
  now: number,
) {
  room.movement = {
    id: randomUUID(),
    kind,
    at: now,
    until: now + CARD_FLIGHT_MS,
    // Store only the faces everyone is allowed to see. Blind swaps and gifts
    // never put hidden ranks in an animation payload.
    flights: flights.map((f) => ({ ...f, card: f.faceUp ? { ...f.card } : { id: f.card.id } })),
    hands,
    discardUnder: flights.some((f) => f.to.zone === 'discard') ? room.discard.at(-2) : undefined,
  };
  room.availableAt = Math.max(room.availableAt, now + CARD_SETTLE_MS);
  if (room.stage === 'between') room.deadline = room.availableAt + pace(room);
  else room.deadline += CARD_SETTLE_MS;
}
function beginTurn(room: Room, now: number) {
  room.stage = 'draw';
  room.drawn = null;
  room.power = null;
  room.privatePeek = null;
  room.deadline = now + room.settings.turnSeconds * 1000;
  room.availableAt = now;
}
export function finish(room: Room, now = Date.now()) {
  const scores = room.players.map((p) => p.cards.reduce((sum, c) => sum + value(c), 0));
  const min = Math.min(...scores);
  const lowest = room.players.filter((_, i) => scores[i] === min);
  room.winners = lowest.filter((p) => p.id !== room.caboId || lowest.length === 1).map((p) => p.id);
  room.winnerNames = room.players.filter((p) => room.winners.includes(p.id)).map((p) => p.name);
  for (const p of room.players) if (room.winners.includes(p.id)) p.wins++;
  room.phase = 'results';
  room.endReason = !room.caboId && !room.deck.length ? 'deck' : 'cabo';
  room.replacement = null;
  room.movement = null;
  room.snap = null;
  room.publicReveals = {};
  room.privatePeek = null;
  if (room.drawn) room.discard.push(room.drawn);
  room.drawn = null;
  room.deadline = 0;
  addLog(
    room,
    `${room.players
      .filter((p) => room.winners.includes(p.id))
      .map((p) => p.name)
      .join(' & ')} won with ${min} points.`,
    'info',
    now,
  );
}
function endTurn(room: Room, now: number) {
  const p = current(room);
  p.turns++;
  if (room.caboId) room.finalTurns = room.finalTurns.filter((id) => id !== p.id);
  room.stage = 'between';
  room.power = null;
  room.privatePeek = null;
  room.drawn = null;
  room.deadline = now + pace(room);
  lock(room, now);
}
function takeCard(room: Room): Card | undefined {
  if (!room.deck.length && room.caboId && room.discard.length > 1) {
    const top = room.discard.pop()!;
    room.deck = shuffle(room.discard);
    room.discard = [top];
  }
  return room.deck.pop();
}
function targetCard(room: Room, target: Target) {
  if (!target || typeof target.playerId !== 'string' || typeof target.cardId !== 'string')
    throw new Error('Choose a card on the table.');
  const owner = room.players.find((p) => p.id === target.playerId);
  const index = owner?.cards.findIndex((c) => c.id === target.cardId) ?? -1;
  if (!owner || index < 0) throw new Error('That card moved. Choose again.');
  return { owner, index, card: owner.cards[index] };
}
function validateTargets(room: Room, targets: Target[], count: number) {
  if (
    !Array.isArray(targets) ||
    targets.length !== count ||
    new Set(targets.map((t) => t?.cardId)).size !== count
  )
    throw new Error(`Choose ${count} different card${count === 1 ? '' : 's'}.`);
  return targets.map((t) => targetCard(room, t));
}
function discardDrawn(room: Room, now: number) {
  const card = room.drawn!;
  room.discard.push(card);
  room.drawn = null;
  addLog(room, `${current(room).name} discarded ${card.rank}.`, 'discard', now, 'Card discarded');
  moveCards(
    room,
    'discard',
    [{ card, from: { zone: 'draw' }, to: { zone: 'discard' }, faceUp: true }],
    [],
    now,
  );
}
function releaseBuzzer(room: Room, now: number) {
  if (room.snap) room.deadline += now - room.snap.pausedAt;
  room.snap = null;
  lock(room, now, 1200);
  if (room.stage === 'between') room.deadline = now + pace(room);
  room.updated = now;
}
function snapPenalty(room: Room, id: string, now: number) {
  const me = room.players.find((p) => p.id === id)!;
  const penalty = takeCard(room);
  if (!penalty) {
    finish(room, now);
    return;
  }
  me.cards.push(penalty);
  addLog(
    room,
    `${me.name} missed the snap. One hidden penalty card.`,
    'penalty',
    now,
    'Snap missed',
  );
  releaseBuzzer(room, now);
  moveCards(
    room,
    'penalty',
    [
      {
        card: penalty,
        from: { zone: 'deck' },
        to: { zone: 'hand', playerId: id, index: me.cards.length - 1 },
        faceUp: false,
      },
    ],
    [],
    now,
  );
}
function giveCard(room: Room, id: string, cardId: string, now: number) {
  const snap = room.snap;
  if (!snap?.target || snap.stage !== 'give') throw new Error('Choose a card to snap first.');
  const me = room.players.find((p) => p.id === id)!;
  const index = me.cards.findIndex((c) => c.id === cardId);
  if (index < 0) throw new Error('Choose one of your cards to give.');
  const target = targetCard(room, snap.target);
  const hands = handSnapshot(me, target.owner);
  const given = me.cards.splice(index, 1)[0];
  target.owner.cards[target.index] = given;
  room.discard.push(target.card);
  delete room.publicReveals[target.card.id];
  addLog(
    room,
    `${me.name} snapped ${target.owner.name}’s ${target.card.rank} and gave them card ${index + 1}.`,
    'snap',
    now,
    'Opponent card snapped',
  );
  releaseBuzzer(room, now);
  moveCards(
    room,
    'gift',
    [
      { card: target.card, from: { zone: 'reveal' }, to: { zone: 'discard' }, faceUp: true },
      {
        card: given,
        from: { zone: 'hand', playerId: id, index },
        to: { zone: 'hand', playerId: target.owner.id, index: target.index },
        faceUp: false,
      },
    ],
    hands,
    now,
  );
}
export function act(room: Room, id: string, action: Action, now = Date.now()) {
  const me = room.players.find((p) => p.id === id);
  if (!me) throw new Error('Your seat is no longer available.');
  const host = id === room.hostId;
  if (action.type === 'leave') {
    if (!['lobby', 'results'].includes(room.phase))
      throw new Error(
        'Finish the round before leaving. Closing the tab will let the turn timer play for you.',
      );
    room.players = room.players.filter((p) => p.id !== id);
    room.turnIndex %= Math.max(1, room.players.length);
    for (const [token, pid] of Object.entries(room.tokens))
      if (pid === id) delete room.tokens[token];
    if (host) room.hostId = room.players.find((p) => !p.bot)?.id || '';
    addLog(room, `${me.name} left the table.`, 'info', now);
    return;
  }
  if (action.type === 'lobby') {
    if (!host || room.phase !== 'results')
      throw new Error('The host can return to the lobby after the round.');
    room.phase = 'lobby';
    room.players.forEach((p) => {
      p.cards = [];
      p.ready = p.bot;
    });
    room.drawn = null;
    room.discard = [];
    room.winners = [];
    room.winnerNames = [];
    room.caboId = null;
    room.finalTurns = [];
    addLog(room, 'Back in the lounge.', 'info', now);
    return;
  }
  if (room.phase === 'lobby' || room.phase === 'results') {
    if (action.type === 'ready' && room.phase === 'lobby') {
      me.ready = !me.ready;
      room.updated = now;
      return;
    }
    if (action.type === 'settings' && host && room.phase === 'lobby') {
      const s = action.settings;
      if (!s || ![30, 45, 60, 90].includes(s.turnSeconds) || !['relaxed', 'quick'].includes(s.pace))
        throw new Error('Choose valid table settings.');
      room.settings = { turnSeconds: s.turnSeconds, pace: s.pace };
      room.updated = now;
      return;
    }
    if (action.type === 'bots' && host && room.phase === 'lobby') {
      if (!Number.isInteger(action.count) || action.count < 0 || action.count > 3)
        throw new Error('Choose 0–3 computer players.');
      const humans = room.players.filter((p) => !p.bot);
      if (humans.length + action.count > 6) throw new Error('There are only six seats.');
      room.players = [
        ...humans,
        ...Array.from({ length: action.count }, (_, i) =>
          player(['Jules', 'Mika', 'Theo'][i], true),
        ),
      ];
      addLog(room, 'The host updated computer seats.', 'info', now);
      return;
    }
    if (action.type === 'start' && host) {
      if (room.players.length < 2) throw new Error('Invite a friend or add a computer player.');
      if (room.phase === 'lobby' && room.players.some((p) => p.id !== id && !p.ready))
        throw new Error('Wait for everyone to be ready.');
      room.deck = shuffle(
        suits.flatMap((suit) => ranks.map((rank) => ({ id: randomUUID(), rank, suit }))),
      );
      room.discard = [];
      room.drawn = null;
      room.initialChoices = {};
      room.replacement = null;
      room.movement = null;
      room.endReason = null;
      room.snapAttempts = {};
      room.snap = null;
      room.publicReveals = {};
      room.power = null;
      room.caboId = null;
      room.finalTurns = [];
      room.winners = [];
      room.winnerNames = [];
      room.privatePeek = null;
      room.round++;
      for (const p of room.players) {
        p.cards = [];
        p.memory = {};
        p.turns = 0;
      }
      for (let i = 0; i < 4; i++) for (const p of room.players) p.cards.push(room.deck.pop()!);
      room.discard.push(room.deck.pop()!);
      room.turnIndex = (room.round - 1) % room.players.length;
      room.phase = 'peek';
      room.stage = 'draw';
      room.availableAt = now + 2000;
      room.deadline = now + 2000 + INITIAL_PEEK_MS;
      for (const p of room.players.filter((p) => p.bot)) {
        room.initialChoices[p.id] = p.cards.slice(0, 2).map((c) => c.id);
        for (const c of p.cards.slice(0, 2)) p.memory[c.id] = value(c);
      }
      addLog(room, `Round ${room.round}. Choose two cards to remember.`, 'info', now);
      return;
    }
    throw new Error('That action is not available in the lounge.');
  }
  if (room.phase === 'peek') {
    if (action.type !== 'initial-peek' || now < room.availableAt || now >= room.deadline)
      throw new Error('Wait for the deal, then choose two cards.');
    const choices = (room.initialChoices[id] ??= []);
    if (choices.length >= 2 || choices.includes(action.cardId))
      throw new Error('You can look at two different cards only.');
    if (!me.cards.some((c) => c.id === action.cardId))
      throw new Error('Choose one of your own cards.');
    choices.push(action.cardId);
    room.updated = now;
    return;
  }
  if (now < room.availableAt) throw new Error('Let the cards settle, then make your move.');
  if (room.snap) {
    const snap = room.snap;
    if (snap.playerId !== id) throw new Error('Someone else won the buzzer. Wait for their snap.');
    if (now >= snap.deadline) throw new Error('Your snap window has ended.');
    if (action.type === 'give' && snap.stage === 'give') {
      giveCard(room, id, action.cardId, now);
      return;
    }
    if (action.type !== 'snap' || snap.stage !== 'choose')
      throw new Error('Choose your snap card before play continues.');
    const target = targetCard(room, action.target);
    const other = target.owner.id !== id;
    if (other && (target.owner.id === room.caboId || id === room.caboId))
      throw new Error('CABO hands are locked against card transfers.');
    if (other && !me.cards.length)
      throw new Error('You need a card to give when snapping another hand.');
    const top = room.discard.at(-1)!;
    if (top.id !== snap.topId) throw new Error('The discard changed.');
    if (target.card.rank !== top.rank) {
      room.publicReveals[target.card.id] = now + 5000;
      room.players
        .filter((p) => p.bot)
        .forEach((p) => {
          p.memory[target.card.id] = value(target.card);
        });
      snapPenalty(room, id, now);
      room.availableAt = now + 5000;
      room.deadline += 5000 - CARD_SETTLE_MS;
      addLog(
        room,
        `${target.owner.name}’s card ${target.index + 1} is revealed to everyone for five seconds.`,
        'penalty',
        now,
      );
      return;
    }
    if (other) {
      snap.stage = 'give';
      snap.target = action.target;
      snap.deadline = now + SNAP_MS;
      room.publicReveals[target.card.id] = snap.deadline;
      addLog(
        room,
        `${me.name} found a match in ${target.owner.name}’s hand. Choose a card to give.`,
        'snap',
        now,
      );
    } else {
      const hands = handSnapshot(target.owner);
      room.discard.push(target.owner.cards.splice(target.index, 1)[0]);
      addLog(room, `${me.name} snapped a ${top.rank}!`, 'snap', now, 'Card snapped');
      releaseBuzzer(room, now);
      moveCards(
        room,
        'snap',
        [
          {
            card: target.card,
            from: { zone: 'hand', playerId: id, index: target.index },
            to: { zone: 'discard' },
            faceUp: true,
          },
        ],
        hands,
        now,
      );
    }
    return;
  }
  if (action.type === 'buzz') {
    const top = room.discard.at(-1);
    if (!top || top.id !== action.topId)
      throw new Error('The discard changed. Try again on the new top card.');
    if (room.snapAttempts[id] === top.id)
      throw new Error('You already tried snapping on this discard.');
    if (!me.cards.length) throw new Error('Your hand is empty. There is nothing to snap or give.');
    room.snapAttempts[id] = top.id;
    room.snap = {
      playerId: id,
      topId: top.id,
      deadline: now + SNAP_MS,
      pausedAt: now,
      stage: 'choose',
    };
    addLog(room, `${me.name} won the snap buzzer. Eight seconds to choose.`, 'snap', now);
    return;
  }
  if (current(room).id !== id)
    throw new Error('Wait for your turn. You can still snap a matching card.');
  if (action.type === 'cabo' && room.stage === 'draw') {
    if (room.caboId) throw new Error('CABO has already been called.');
    room.caboId = id;
    room.finalTurns = room.players.filter((p) => p.id !== id).map((p) => p.id);
    addLog(
      room,
      `${me.name} called CABO. Everyone else gets one final turn.`,
      'cabo',
      now,
      'CABO called',
    );
    endTurn(room, now);
    return;
  }
  if (action.type === 'draw' && room.stage === 'draw') {
    room.drawn = takeCard(room) ?? null;
    if (!room.drawn) {
      finish(room, now);
      return;
    }
    room.stage = 'choose';
    me.memory[room.drawn.id] = value(room.drawn);
    lock(room, now, 750);
    addLog(room, `${me.name} drew a card.`, 'draw', now);
    return;
  }
  if (room.stage === 'choose' && room.drawn) {
    if (action.type === 'discard') {
      discardDrawn(room, now);
      endTurn(room, now);
      room.availableAt = now + CARD_SETTLE_MS;
      room.deadline = room.availableAt + pace(room);
      return;
    }
    if (action.type === 'replace') {
      const index = me.cards.findIndex((c) => c.id === action.cardId);
      if (index < 0) throw new Error('Choose a card from your own hand.');
      const old = me.cards[index];
      room.replacement = {
        playerId: id,
        index,
        cardId: room.drawn.id,
        discarded: old,
        at: now,
        until: now + 3000,
      };
      me.cards[index] = room.drawn;
      room.drawn = null;
      room.discard.push(old);
      addLog(
        room,
        `${me.name} replaced card ${index + 1}, discarding ${old.rank}.`,
        'discard',
        now,
        'Card replaced',
      );
      endTurn(room, now);
      lock(room, now, 3000);
      room.deadline = room.availableAt + pace(room);
      return;
    }
    if (action.type === 'power') {
      const power = powerFor(room.drawn);
      if (!power) throw new Error('This card has no power. Keep it or discard it.');
      discardDrawn(room, now);
      room.power = power;
      room.stage = power.count ? 'power-look' : 'power-swap';
      lock(room, now, CARD_SETTLE_MS);
      addLog(room, `${me.name} played ${power.label.toLowerCase()}.`, 'info', now, 'Power played');
      return;
    }
  }
  if (room.stage === 'power-look' && room.power) {
    if (action.type === 'skip-look') {
      if (room.power.swap) room.stage = 'power-swap';
      else endTurn(room, now);
      addLog(room, `${me.name} skipped looking at cards.`, 'info', now, 'Look skipped');
      return;
    }
    if (action.type === 'look') {
      const targets = validateTargets(room, action.targets, room.power.count);
      if (
        targets.some((t) =>
          room.power!.scope === 'own'
            ? t.owner.id !== id
            : room.power!.scope === 'other'
              ? t.owner.id === id
              : false,
        )
      )
        throw new Error('Choose cards allowed by this power.');
      room.privatePeek = {
        playerId: id,
        cardIds: targets.map((t) => t.card.id),
        until: now + POWER_PEEK_MS,
      };
      for (const t of targets) me.memory[t.card.id] = value(t.card);
      room.stage = 'power-view';
      room.updated = now;
      return;
    }
  }
  if (room.stage === 'power-view' && action.type === 'finish-look') {
    room.privatePeek = null;
    if (room.power?.swap) room.stage = 'power-swap';
    else endTurn(room, now);
    room.updated = now;
    return;
  }
  if (room.stage === 'power-swap') {
    if (action.type === 'skip-swap') {
      endTurn(room, now);
      addLog(room, `${me.name} left every card in place.`, 'info', now, 'Swap skipped');
      return;
    }
    if (action.type === 'swap') {
      const [a, b] = validateTargets(room, action.targets, 2);
      if (a.owner.id === room.caboId || b.owner.id === room.caboId)
        throw new Error('The CABO caller’s cards are locked. Choose other cards.');
      const hands = handSnapshot(...new Set([a.owner, b.owner]));
      [a.owner.cards[a.index], b.owner.cards[b.index]] = [b.card, a.card];
      addLog(
        room,
        `${me.name} swapped ${a.owner.name}’s card ${a.index + 1} with ${b.owner.name}’s card ${b.index + 1}.`,
        'swap',
        now,
        'Cards swapped',
      );
      endTurn(room, now);
      moveCards(
        room,
        'swap',
        [
          {
            card: a.card,
            from: { zone: 'hand', playerId: a.owner.id, index: a.index },
            to: { zone: 'hand', playerId: b.owner.id, index: b.index },
            faceUp: false,
          },
          {
            card: b.card,
            from: { zone: 'hand', playerId: b.owner.id, index: b.index },
            to: { zone: 'hand', playerId: a.owner.id, index: a.index },
            faceUp: false,
          },
        ],
        hands,
        now,
      );
      return;
    }
  }
  throw new Error('That move is not available right now.');
}

function botAction(room: Room, now: number) {
  const p = current(room);
  // Computers remember only their opening peeks, draws, and power peeks.
  const known = p.cards.filter((c) => p.memory[c.id] !== undefined);
  const worst = [...known].sort((a, b) => p.memory[b.id] - p.memory[a.id])[0];
  const unknown = p.cards.filter((c) => p.memory[c.id] === undefined);
  const ownTarget = unknown[0] || worst || p.cards[0];
  if (room.stage === 'draw') {
    const estimate = p.cards.reduce((s, c) => s + (p.memory[c.id] ?? 7), 0);
    act(
      room,
      p.id,
      { type: !room.caboId && (estimate <= 8 || p.turns >= 10) ? 'cabo' : 'draw' },
      now,
    );
  } else if (room.stage === 'choose' && room.drawn) {
    const high = worst ? p.memory[worst.id] : 6;
    if (p.cards.length && value(room.drawn) < high)
      act(room, p.id, { type: 'replace', cardId: (worst || ownTarget).id }, now);
    else if (powerFor(room.drawn)) act(room, p.id, { type: 'power' }, now);
    else act(room, p.id, { type: 'discard' }, now);
  } else if (room.stage === 'power-look' && room.power) {
    const options = room.players
      .flatMap((owner) => owner.cards.map((card) => ({ playerId: owner.id, cardId: card.id })))
      .filter((t) =>
        room.power!.scope === 'own'
          ? t.playerId === p.id
          : room.power!.scope === 'other'
            ? t.playerId !== p.id
            : true,
      )
      .sort(
        (a, b) =>
          Number(p.memory[a.cardId] !== undefined) - Number(p.memory[b.cardId] !== undefined),
      );
    if (options.length >= room.power.count)
      act(room, p.id, { type: 'look', targets: options.slice(0, room.power.count) }, now);
    else act(room, p.id, { type: 'skip-look' }, now);
  } else if (room.stage === 'power-view') act(room, p.id, { type: 'finish-look' }, now);
  else if (room.stage === 'power-swap') {
    const other = room.players
      .filter((o) => o.id !== p.id && o.id !== room.caboId)
      .flatMap((o) => o.cards.map((c) => ({ playerId: o.id, cardId: c.id })))
      .find(
        (t) => p.memory[t.cardId] !== undefined && worst && p.memory[t.cardId] < p.memory[worst.id],
      );
    if (other && worst)
      act(
        room,
        p.id,
        { type: 'swap', targets: [{ playerId: p.id, cardId: worst.id }, other] },
        now,
      );
    else act(room, p.id, { type: 'skip-swap' }, now);
  }
  // Make bot actions readable; every action has a visible beat.
  room.availableAt = Math.max(room.availableAt, now + 1800);
}

export function tick(room: Room, now = Date.now()) {
  if (room.movement && now >= room.movement.until) room.movement = null;
  if (room.replacement && now >= room.replacement.until) room.replacement = null;
  for (const [id, until] of Object.entries(room.publicReveals || {}))
    if (now >= until) delete room.publicReveals[id];
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && now - host.connected > 60_000) {
    const next = room.players.find((p) => !p.bot && now - p.connected < 30_000);
    if (next && next.id !== host.id) {
      room.hostId = next.id;
      addLog(room, `${next.name} is now the host.`, 'info', now);
    }
  }
  if (room.phase === 'peek' && now >= room.deadline) {
    room.phase = 'playing';
    room.initialChoices = {};
    beginTurn(room, now);
    addLog(room, `${current(room).name} goes first.`, 'info', now);
    return;
  }
  if (room.phase !== 'playing' || now < room.availableAt) return;
  // Resolve the last draw/power and finish its movement before revealing scores.
  if (!room.deck.length && !room.caboId && !room.drawn && !room.power && !room.snap) {
    finish(room, now);
    return;
  }
  if (room.snap) {
    const snap = room.snap;
    if (now >= snap.deadline) {
      const owner = room.players.find((p) => p.id === snap.playerId)!;
      if (snap.stage === 'give' && owner.cards.length)
        giveCard(room, owner.id, owner.cards[randomInt(owner.cards.length)].id, now);
      else snapPenalty(room, owner.id, now);
    } else {
      const owner = room.players.find((p) => p.id === snap.playerId)!;
      if (owner.bot && now >= snap.pausedAt + 1200 && snap.stage === 'choose') {
        const match = owner.cards.find(
          (c) => owner.memory[c.id] !== undefined && c.rank === room.discard.at(-1)!.rank,
        );
        if (match)
          act(
            room,
            owner.id,
            { type: 'snap', target: { playerId: owner.id, cardId: match.id } },
            now,
          );
      }
    }
    return;
  }
  if (room.stage === 'between') {
    if (now < room.deadline) return;
    if (room.caboId && !room.finalTurns.length) {
      finish(room, now);
      return;
    }
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    beginTurn(room, now);
    room.updated = now;
    return;
  }
  if (room.stage === 'power-view' && room.privatePeek && now >= room.privatePeek.until) {
    act(room, current(room).id, { type: 'finish-look' }, now);
    return;
  }
  if (now >= room.deadline) {
    const hadDraw = !!room.drawn;
    if (hadDraw) discardDrawn(room, now);
    addLog(room, `${current(room).name} ran out of time. Turn passed.`, 'info', now);
    endTurn(room, now);
    if (hadDraw) {
      room.availableAt = now + CARD_SETTLE_MS;
      room.deadline = room.availableAt + pace(room);
    }
    return;
  }
  const top = room.discard.at(-1);
  const lastMove = [...room.events]
    .reverse()
    .find((e) => ['discard', 'snap', 'penalty', 'info'].includes(e.kind));
  if (top && now - (lastMove?.at || 0) >= 2400) {
    const snapper = room.players.find(
      (p) =>
        p.bot &&
        room.snapAttempts[p.id] !== top.id &&
        p.cards.some((c) => p.memory[c.id] !== undefined && c.rank === top.rank),
    );
    if (snapper) {
      act(room, snapper.id, { type: 'buzz', topId: top.id }, now);
      return;
    }
  }
  if (current(room).bot) botAction(room, now);
}

export function publicRoom(room: Room, you: string, now = Date.now()): PublicRoom {
  const {
    tokens: _tokens,
    deck,
    discard,
    players,
    drawn,
    privatePeek,
    initialChoices,
    snapAttempts: _attempts,
    replacement,
    ...safe
  } = room;
  const visible = new Set<string>();
  if (room.phase === 'peek' && now < room.deadline)
    for (const id of initialChoices[you] || []) visible.add(id);
  if (privatePeek?.playerId === you && now < privatePeek.until)
    for (const id of privatePeek.cardIds) visible.add(id);
  for (const [id, until] of Object.entries(room.publicReveals || {}))
    if (now < until) visible.add(id);
  return {
    ...safe,
    you,
    serverNow: now,
    deckCount: deck.length,
    discard: discard.at(-1) || null,
    drawn: drawn ? (current(room).id === you ? { ...drawn } : { id: drawn.id }) : null,
    replacement:
      replacement && now < replacement.until
        ? {
            ...replacement,
            incoming:
              replacement.playerId === you
                ? { ...players.find((p) => p.id === you)!.cards[replacement.index] }
                : { id: replacement.cardId },
          }
        : null,
    peekUntil:
      room.phase === 'peek'
        ? room.deadline
        : privatePeek?.playerId === you
          ? privatePeek.until
          : null,
    looks:
      room.phase === 'peek' && now < room.deadline
        ? Object.entries(initialChoices)
            .filter(([, ids]) => ids.length)
            .map(([playerId, cardIds]) => ({ playerId, cardIds, until: room.deadline }))
        : privatePeek && now < privatePeek.until
          ? [
              {
                playerId: privatePeek.playerId,
                cardIds: privatePeek.cardIds,
                until: privatePeek.until,
              },
            ]
          : [],
    players: players.map(({ cards, memory: _memory, ...p }) => ({
      ...p,
      cards: cards.map((c) =>
        room.phase === 'results' || visible.has(c.id) ? { ...c } : { id: c.id },
      ),
      peekCount: room.phase === 'peek' ? initialChoices[p.id]?.length || 0 : 0,
      ...(room.phase === 'results' ? { score: cards.reduce((s, c) => s + value(c), 0) } : {}),
    })),
  };
}
