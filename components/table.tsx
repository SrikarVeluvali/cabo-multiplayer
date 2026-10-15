'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowRight,
  ArrowsLeftRight,
  BellRinging,
  CaretLeft,
  CaretRight,
  Check,
  Crown,
  Eye,
  Hand,
  List,
  LockKey,
  Spade,
  Trophy,
  X,
} from '@phosphor-icons/react';
import type { PublicRoom, Target } from '@/lib/types';
import Card from './card';
import ReplacementMotion from './replacement-motion';
import CardMotion from './card-motion';
import TableAction from './table-action';
import { Avatar, type OnAction } from './cabo';
import { useViewport } from './use-viewport';

type Person = PublicRoom['players'][number];
export default function Table({
  room,
  busy,
  now,
  onAction,
  onRules,
}: {
  room: PublicRoom;
  busy: boolean;
  now: number;
  onAction: OnAction;
  onRules: () => void;
}) {
  const [replace, setReplace] = useState(false),
    [selected, setSelected] = useState<Target[]>([]),
    [confirm, setConfirm] = useState(false);
  const [activity, setActivity] = useState(false),
    [seatPage, setSeatPage] = useState(0);
  const size = useViewport();
  const reduce = useReducedMotion();
  const replacement =
    !reduce && room.replacement && now < room.replacement.until ? room.replacement : null;
  const movement = !reduce && room.movement && now < room.movement.until ? room.movement : null;
  const movingIds = new Set(movement?.flights.map((f) => f.card.id) || []);
  const movementOwner = movement?.hands.find((h) => h.playerId !== room.you)?.playerId;
  const focusOwner = replacement?.playerId || room.snap?.playerId || movementOwner;
  const capacity =
    size.height < 500
      ? 1
      : size.width < 650
        ? size.height <
          (room.players.some((p) => p.cards.length > 4) ? 900 : room.caboId ? 860 : 820)
          ? 1
          : 2
        : size.width < 850
          ? 2
          : size.width < 1320
            ? 3
            : 5;
  const current = room.players[room.turnIndex],
    me = room.players.find((p) => p.id === room.you)!;
  const peek = room.phase === 'peek',
    results = room.phase === 'results',
    myTurn = current.id === room.you;
  const snap = room.snap,
    ownSnap = snap?.playerId === room.you;
  const canAct = !busy && now >= room.availableAt;
  const ordinary = canAct && !snap;
  const powerSelection =
    myTurn &&
    !peek &&
    !results &&
    !snap &&
    (room.stage === 'power-look' || room.stage === 'power-swap');
  const needed = room.stage === 'power-look' ? room.power?.count || 1 : 2;
  const ordered = [
    ...room.players.slice(room.players.findIndex((p) => p.id === room.you) + 1),
    ...room.players.slice(
      0,
      room.players.findIndex((p) => p.id === room.you),
    ),
  ];
  const seatPages = Math.ceil(ordered.length / capacity),
    page =
      focusOwner && focusOwner !== room.you
        ? Math.floor(ordered.findIndex((p) => p.id === focusOwner) / capacity)
        : Math.min(seatPage, seatPages - 1);
  const shown = ordered.slice(page * capacity, (page + 1) * capacity);
  // A peek temporarily unmounts its hand card. Remember the first deal across
  // those remounts, including the beat before polling ends the opening phase.
  const knownIds = useRef(
    new Set(
      peek && now < room.availableAt ? [] : room.players.flatMap((p) => p.cards.map((c) => c.id)),
    ),
  );
  useEffect(() => {
    room.players.forEach((p) => p.cards.forEach((c) => knownIds.current.add(c.id)));
    if (room.drawn) knownIds.current.add(room.drawn.id);
  }, [room]);
  useEffect(() => {
    setReplace(false);
    setSelected([]);
    setConfirm(false);
  }, [room.stage, room.turnIndex, room.phase, snap?.playerId, snap?.stage]);
  useEffect(() => {
    if (!snap && !powerSelection && !replace && current.id !== room.you) {
      const i = ordered.findIndex((p) => p.id === current.id);
      if (i >= 0) setSeatPage(Math.floor(i / capacity));
    }
  }, [room.turnIndex, capacity]);
  useEffect(() => {
    setSelected((prev) =>
      prev.filter((t) =>
        room.players.some((p) => p.id === t.playerId && p.cards.some((c) => c.id === t.cardId)),
      ),
    );
  }, [room.players]);
  const reveals = room.players.flatMap((owner) =>
    owner.cards
      .filter((card) => now < (room.publicReveals?.[card.id] || 0))
      .map((card) => ({ owner, card, index: owner.cards.findIndex((c) => c.id === card.id) })),
  );
  const clockEnd =
    snap?.deadline ||
    (reveals.length ? Math.max(...reveals.map((r) => room.publicReveals[r.card.id])) : 0) ||
    (room.stage === 'power-view' && room.peekUntil ? room.peekUntil : room.deadline);
  const remaining = Math.max(0, Math.ceil((clockEnd - now) / 1000));
  const looks = (room.looks || []).filter((l) => now < l.until);
  const isPrivatelyLifted = (id: string) => looks.some((l) => l.cardIds.includes(id));
  const isLifted = (id: string) => isPrivatelyLifted(id) || reveals.some((r) => r.card.id === id);
  function selectable(owner: string, cardId: string) {
    if (!canAct || results) return false;
    if (peek) return owner === room.you && me.peekCount < 2 && !isLifted(cardId);
    if (snap) {
      if (!ownSnap) return false;
      if (snap.stage === 'give') return owner === room.you;
      return (
        !isPrivatelyLifted(cardId) &&
        (owner === room.you ||
          (owner !== room.caboId && room.you !== room.caboId && !!me.cards.length))
      );
    }
    if (replace) return myTurn && owner === room.you;
    if (powerSelection) {
      if (room.stage === 'power-swap') return owner !== room.caboId;
      return (
        room.power?.scope === 'any' ||
        (room.power?.scope === 'own' ? owner === room.you : owner !== room.you)
      );
    }
    return false;
  }
  function choose(target: Target) {
    if (peek) {
      onAction({ type: 'initial-peek', cardId: target.cardId });
      return;
    }
    if (ownSnap) {
      onAction(
        snap!.stage === 'give' ? { type: 'give', cardId: target.cardId } : { type: 'snap', target },
      );
      return;
    }
    if (replace) {
      setReplace(false);
      onAction({ type: 'replace', cardId: target.cardId });
      return;
    }
    setSelected((prev) =>
      prev.some((t) => t.cardId === target.cardId)
        ? prev.filter((t) => t.cardId !== target.cardId)
        : prev.length < needed
          ? [...prev, target]
          : [...prev.slice(1), target],
    );
  }
  let title = 'Your move.',
    help = 'Draw a card, or call CABO before drawing.';
  if (results) {
    title = 'The cards are on the table.';
    help =
      room.endReason === 'deck'
        ? 'The draw deck is empty. Lowest total wins.'
        : 'Lowest total wins. The caller must beat everyone outright.';
  } else if (peek) {
    title = 'Two cards to remember.';
    help =
      now < room.availableAt
        ? 'Dealing…'
        : me.peekCount < 2
          ? `Choose ${2 - me.peekCount} of your cards.`
          : 'Remember them before they return to their slots.';
  } else if (snap) {
    title = ownSnap
      ? snap.stage === 'give'
        ? 'A match! Give one card.'
        : 'You won the buzzer.'
      : `${room.players.find((p) => p.id === snap.playerId)?.name} won the buzzer.`;
    help = ownSnap
      ? snap.stage === 'give'
        ? 'Choose your card to give. It stays hidden.'
        : 'Choose your card or a card in an unlocked opponent hand.'
      : snap.stage === 'give'
        ? 'Choosing a hidden card to give. Play is paused.'
        : 'Eight seconds to choose. Play is paused.';
  } else if (reveals.length) {
    title = 'A card for everyone to see.';
    help = `${reveals[0].owner.name}’s card ${reveals[0].index + 1} returns to its slot after five seconds.`;
  } else if (!myTurn) {
    title = `${current.name}’s move.`;
    help =
      room.stage === 'between'
        ? 'Snap buzzer is open before the next turn.'
        : room.stage === 'power-view'
          ? 'Looking at cards at their desk.'
          : room.stage === 'choose'
            ? 'Deciding what to do with their draw.'
            : 'You can still hit the snap buzzer.';
  } else if (replace) {
    title = 'Choose a replacement.';
    help = 'Choose the card in your hand to discard.';
  } else if (room.stage === 'choose') {
    title = 'Make it count.';
    help = 'Replace a card, discard, or use the drawn card’s power.';
  } else if (room.stage === 'power-look') {
    title = room.power?.label || 'Choose cards to look at.';
    help = `Choose ${needed} ${room.power?.scope === 'own' ? 'of your cards' : room.power?.scope === 'other' ? 'card in another hand' : 'card' + (needed === 2 ? 's' : '') + ' anywhere'}.`;
  } else if (room.stage === 'power-view') {
    title = 'For your eyes only.';
    help = 'Your peek is at your desk. The cards will go back to their original slots.';
  } else if (room.stage === 'power-swap') {
    title = 'Swap, or leave them be.';
    help = 'Choose any two unlocked cards. Looking and swapping are separate.';
  } else if (room.stage === 'between') {
    title = 'Cards down. Eyes open.';
    help = 'A moment to hit the snap buzzer.';
  }

  function hand(p: Person, own = false) {
    // Swaps keep the same slots. Install their final occupants while the
    // explicit flight hides them, so landing doesn't trigger another swap.
    const before =
      movement?.kind === 'swap' ? undefined : movement?.hands.find((h) => h.playerId === p.id);
    const cards: Person['cards'] = before
      ? before.cardIds.map((id) => p.cards.find((c) => c.id === id) || { id })
      : p.cards;
    const columns =
      (own || (shown.length === 1 && size.width < 650) || size.height < 500) && cards.length <= 6
        ? Math.max(4, cards.length)
        : size.height < 500
          ? 4
          : !own && size.width < 650 && shown.length > 1
            ? 2
            : 4;
    const rows = Math.max(1, Math.ceil(cards.length / columns));
    const maxHeight =
      size.height < 500
        ? Math.max(95, size.height - 190)
        : size.height < 700
          ? 186
          : size.height < 860
            ? 185
            : 230;
    const overlap =
      rows > 1 ? Math.max(0, (rows * 89 + (rows - 1) * 8 - maxHeight) / (rows - 1)) : 0;
    const handStyle = {
      '--hand-columns': columns,
      '--row-overlap': `${overlap}px`,
      '--hand-step': `${Math.min(52, ((size.height < 500 ? (size.width - 100) / 3 : !own && size.width < 650 && size.height < 640 ? (size.width - 80) / 2 : size.width - 64) - (columns - 1) * 8) / columns)}px`,
    } as CSSProperties;
    const looking = looks.find((l) => l.playerId === p.id);
    const lifted =
      looking?.cardIds
        .flatMap((id) => room.players.flatMap((owner) => owner.cards).filter((c) => c.id === id))
        .filter((c) => !reveals.some((r) => r.card.id === c.id)) || [];
    return (
      <section
        key={p.id}
        className={`player-seat ${own ? 'own-seat' : ''} ${current.id === p.id && !peek && !results ? 'has-turn' : ''} ${snap?.playerId === p.id ? 'buzzer-holder' : ''}`}
        data-player-id={p.id}
        aria-label={`${p.name}’s hand`}
      >
        <div className="nameplate">
          <Avatar name={p.name} index={room.players.findIndex((x) => x.id === p.id)} bot={p.bot} />
          <div>
            <strong>
              {p.name}
              {own && <small> you</small>}
            </strong>
            <span>
              {snap?.playerId === p.id
                ? `Snap buzzer · ${remaining}s`
                : results
                  ? `${p.cards.length} cards`
                  : room.caboId === p.id
                    ? 'CABO · swaps locked'
                    : room.finalTurns.includes(p.id)
                      ? 'Final turn'
                      : peek
                        ? `${p.peekCount} / 2 chosen`
                        : `${p.cards.length} cards`}
            </span>
          </div>
          {room.caboId === p.id && <LockKey className="lock-icon" />}
          {results && (
            <b className={`score ${room.winners.includes(p.id) ? 'winning-score' : ''}`}>
              {p.score}
              <small>pts</small>
            </b>
          )}
          {results && room.winners.includes(p.id) && (
            <Trophy className="winner-icon" weight="fill" />
          )}
        </div>
        <motion.div layout={!movement} className="hand-cards" style={handStyle}>
          {cards.map((c, i) => {
            const face =
              results || (!!room.publicReveals?.[c.id] && now < room.publicReveals[c.id]);
            return (
              <motion.div
                layout="position"
                transition={{ layout: { duration: reduce ? 0 : 0.7, ease: 'easeInOut' } }}
                key={c.id}
                className={`numbered-card ${replacement?.cardId === c.id || movingIds.has(c.id) ? 'replacement-hidden' : ''}`}
                data-hand-slot={`${p.id}-${i}`}
              >
                {isLifted(c.id) ? (
                  <div
                    className="card-placeholder"
                    aria-label={`${p.name}, card ${i + 1}, being peeked`}
                  >
                    <Eye />
                  </div>
                ) : (
                  <Card
                    card={c}
                    visible={face}
                    sharedLayout={!movingIds.has(c.id) && replacement?.cardId !== c.id}
                    layoutScope={p.id}
                    dealIndex={
                      !movingIds.has(c.id) &&
                      replacement?.cardId !== c.id &&
                      !knownIds.current.has(c.id)
                        ? peek
                          ? now < room.availableAt
                            ? i * room.players.length + room.players.findIndex((x) => x.id === p.id)
                            : undefined
                          : 0
                        : undefined
                    }
                    onClick={
                      selectable(p.id, c.id)
                        ? () => choose({ playerId: p.id, cardId: c.id })
                        : undefined
                    }
                    selected={
                      selected.some((t) => t.cardId === c.id) || snap?.target?.cardId === c.id
                    }
                    label={`${p.name}, card ${i + 1}${face && c.rank ? `, ${c.rank} of ${c.suit}` : ', face down'}`}
                  />
                )}
                <span className="card-number">{i + 1}</span>
              </motion.div>
            );
          })}
          {!p.cards.length && (
            <div className="empty-hand">
              <Check />
              No cards
            </div>
          )}
        </motion.div>
        {!!lifted.length && (
          <div className={`peek-desk ${own ? 'your-peek' : ''}`}>
            <div className="peek-desk-cards">
              {lifted.map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  visible={own && !!c.rank}
                  sharedLayout
                  layoutScope={
                    room.players.find((owner) => owner.cards.some((card) => card.id === c.id))?.id
                  }
                  label={
                    own && c.rank
                      ? `Private peek, ${c.rank} of ${c.suit}`
                      : `${p.name} is privately peeking`
                  }
                />
              ))}
            </div>
            <span>
              <Eye />
              {own ? 'Your private peek' : `${p.name} is looking`}
            </span>
          </div>
        )}
      </section>
    );
  }
  return (
    <LayoutGroup id={`${room.code}-${room.round}`}>
      <div className="table-screen" data-capacity={capacity}>
        <div className="table-topline">
          <span className="table-phase">
            <span className="live-dot" />
            {peek
              ? 'Opening peek'
              : results
                ? 'Round complete'
                : room.caboId
                  ? 'Final lap'
                  : 'At the table'}
            <small>{room.players.length} players</small>
          </span>
          <div className="table-top-actions">
            {seatPages > 1 && (
              <div className="seat-pager">
                <button
                  disabled={!page}
                  aria-label="Previous players"
                  onClick={() => setSeatPage(page - 1)}
                >
                  <CaretLeft />
                </button>
                <span>
                  {page * capacity + 1}–{Math.min((page + 1) * capacity, ordered.length)} /{' '}
                  {ordered.length}
                </span>
                <button
                  disabled={page >= seatPages - 1}
                  aria-label="Next players"
                  onClick={() => setSeatPage(page + 1)}
                >
                  <CaretRight />
                </button>
              </div>
            )}
            <button
              className="icon-button"
              onClick={() => setActivity(true)}
              aria-label="Table activity"
            >
              <List />
            </button>
          </div>
        </div>
        {room.caboId && !results && (
          <div className="cabo-banner">
            <LockKey />
            <span>
              <b>{room.players.find((p) => p.id === room.caboId)?.name} called CABO.</b>{' '}
              {room.finalTurns.length} final turn{room.finalTurns.length === 1 ? '' : 's'} left.
              Caller’s cards are locked.
            </span>
          </div>
        )}
        <div className="table-layout">
          <div className="felt-table">
            <div className="opponents" data-count={shown.length}>
              {shown.map((p) => hand(p))}
            </div>
            <div className="table-middle">
              <div className="felt-mark">
                <Spade weight="fill" />
                <strong>cabo.</strong>
                <small>Trust your memory</small>
              </div>
              <div className="piles">
                <div className="pile">
                  <div className="deck-stack" data-deck>
                    <Card
                      card={{ id: 'deck' }}
                      onClick={
                        ordinary && myTurn && room.stage === 'draw' && !peek && !results
                          ? () => onAction({ type: 'draw' })
                          : undefined
                      }
                      label={`Draw from deck, ${room.deckCount} cards left`}
                    />
                  </div>
                  <span>
                    Draw <b>{room.deckCount}</b>
                  </span>
                </div>
                <div className="pile">
                  <div data-discard className={replacement ? 'replacement-hidden' : undefined}>
                    {room.discard ? (
                      <Card
                        card={
                          movement?.flights.some((f) => f.to.zone === 'discard')
                            ? movement.discardUnder || { id: 'discard-under' }
                            : room.discard
                        }
                      />
                    ) : (
                      <div className="card-placeholder" />
                    )}
                  </div>
                  <span>Discard</span>
                </div>
              </div>
              <div className="drawn-area">
                {room.drawn ||
                replacement ||
                movement?.flights.some((f) => f.from.zone === 'draw' || f.to.zone === 'draw') ? (
                  <div className="drawn-card">
                    <div
                      data-drawn
                      className={
                        replacement ||
                        (room.drawn && movingIds.has(room.drawn.id)) ||
                        movement?.flights.some((f) => f.from.zone === 'draw')
                          ? 'replacement-hidden'
                          : undefined
                      }
                    >
                      {room.drawn ? (
                        <Card key={room.drawn.id} card={room.drawn} dealIndex={0} />
                      ) : (
                        <div className="card-placeholder" />
                      )}
                    </div>
                    <span>{myTurn ? 'Your private draw' : `${current.name}’s draw`}</span>
                  </div>
                ) : (
                  <span className="table-whisper">
                    {peek
                      ? 'Choose two. Remember them.'
                      : results
                        ? 'Memory meets reality.'
                        : 'Keep a little something to yourself.'}
                  </span>
                )}
              </div>
            </div>
            {hand(me, true)}
            <div className="motion-reveal-anchor" data-reveal aria-hidden="true" />
            {movement?.hands
              .filter((h) => h.playerId !== room.you && !shown.some((p) => p.id === h.playerId))
              .map((h, i) => (
                <div
                  className="motion-seat-anchor"
                  data-motion-anchor={h.playerId}
                  key={h.playerId}
                  style={{ right: i ? 'auto' : 18, left: i ? 18 : 'auto' }}
                >
                  {room.players.find((p) => p.id === h.playerId)?.name}
                </div>
              ))}
            {!reveals.length && <TableAction room={room} now={now} />}
            {movement && <CardMotion key={movement.id} movement={movement} now={now} />}
            {replacement && (
              <ReplacementMotion key={replacement.at} replacement={replacement} now={now} />
            )}
            {!!reveals.length && (
              <div className="public-reveal">
                <div className="peek-desk-cards">
                  {reveals.map((r) => (
                    <div key={r.card.id} data-public-card={r.card.id}>
                      <Card
                        card={r.card}
                        sharedLayout
                        layoutScope={r.owner.id}
                        onClick={
                          selectable(r.owner.id, r.card.id)
                            ? () => choose({ playerId: r.owner.id, cardId: r.card.id })
                            : undefined
                        }
                      />
                      <span>
                        {r.owner.name} · card {r.index + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <p>
                  <Eye />
                  Visible to everyone
                </p>
              </div>
            )}
          </div>
        </div>
        <div className={`action-dock ${snap ? 'snap-active' : ''}`}>
          <div className="dock-description">
            <div className="timer-disc">
              {results ? (
                <Trophy />
              ) : snap ? (
                <>
                  <BellRinging />
                  <b>{remaining}</b>
                </>
              ) : (
                <b>{peek && now < room.availableAt ? '…' : remaining}</b>
              )}
            </div>
            <div>
              <h2>{title}</h2>
              <p aria-live="polite">{help}</p>
            </div>
          </div>
          <div className="dock-actions">
            {results ? (
              <>
                <span className="result-summary">
                  <Trophy weight="fill" />
                  {room.winners.includes(room.you)
                    ? 'You won!'
                    : `${(room.winnerNames || room.players.filter((p) => room.winners.includes(p.id)).map((p) => p.name)).join(' & ')} won`}
                </span>
                {room.hostId === room.you ? (
                  <>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => onAction({ type: 'lobby' })}
                    >
                      Lounge
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => onAction({ type: 'start' })}
                    >
                      <ArrowClockwise />
                      Play again
                    </button>
                  </>
                ) : (
                  <span className="waiting-copy">Waiting for the host.</span>
                )}
              </>
            ) : peek ? (
              <span className="peek-status">
                <Eye />
                {me.peekCount} / 2 chosen
              </span>
            ) : snap ? (
              <span className="buzzer-owner">
                <BellRinging />
                {ownSnap
                  ? snap.stage === 'give'
                    ? 'Choose your gift card'
                    : 'Choose a card on the table'
                  : 'Buzzer reserved'}
                <b>{remaining}s</b>
              </span>
            ) : replace ? (
              <button className="button secondary" onClick={() => setReplace(false)}>
                <X />
                Cancel replacement
              </button>
            ) : (
              <>
                {myTurn && room.stage === 'draw' && (
                  <>
                    <button
                      className="button secondary"
                      disabled={!ordinary || !!room.caboId}
                      onClick={() => setConfirm(true)}
                    >
                      <Crown />
                      Call CABO
                    </button>
                    <button
                      className="button primary"
                      disabled={!ordinary}
                      onClick={() => onAction({ type: 'draw' })}
                    >
                      <ArrowDown />
                      Draw
                    </button>
                  </>
                )}
                {myTurn && room.stage === 'choose' && (
                  <>
                    <button
                      className="button secondary"
                      disabled={!ordinary}
                      onClick={() => onAction({ type: 'discard' })}
                    >
                      Discard
                    </button>
                    {room.drawn?.rank &&
                      ['7', '8', '9', '10', 'J', 'Q', 'K'].includes(room.drawn.rank) &&
                      !(
                        room.drawn.rank === 'K' && ['hearts', 'diamonds'].includes(room.drawn.suit!)
                      ) && (
                        <button
                          className="button secondary"
                          disabled={!ordinary}
                          onClick={() => onAction({ type: 'power' })}
                        >
                          <Eye />
                          Power
                        </button>
                      )}
                    <button
                      className="button primary"
                      disabled={!ordinary || !me.cards.length}
                      onClick={() => setReplace(true)}
                    >
                      <ArrowsLeftRight />
                      Replace
                    </button>
                  </>
                )}
                {powerSelection && (
                  <>
                    <button
                      className="button secondary"
                      disabled={!ordinary}
                      onClick={() =>
                        onAction({ type: room.stage === 'power-look' ? 'skip-look' : 'skip-swap' })
                      }
                    >
                      Skip {room.stage === 'power-look' ? 'look' : 'swap'}
                    </button>
                    <button
                      className="button primary"
                      disabled={!ordinary || selected.length !== needed}
                      onClick={() => {
                        onAction({
                          type: room.stage === 'power-look' ? 'look' : 'swap',
                          targets: selected,
                        });
                        setSelected([]);
                      }}
                    >
                      {room.stage === 'power-look' ? <Eye /> : <ArrowsLeftRight />}
                      {room.stage === 'power-look' ? 'Look' : 'Swap'} {selected.length}/{needed}
                    </button>
                  </>
                )}
                {myTurn && room.stage === 'power-view' && (
                  <button
                    className="button primary"
                    disabled={!ordinary}
                    onClick={() => onAction({ type: 'finish-look' })}
                  >
                    Return cards
                    <ArrowRight />
                  </button>
                )}
                {(!myTurn || room.stage === 'between') && (
                  <span className="waiting-copy">
                    {canAct ? 'See a match? Hit the buzzer.' : 'Cards settling…'}
                  </span>
                )}
                <button
                  className="button snap-button"
                  aria-label="Snap buzzer"
                  title="Hit the snap buzzer"
                  disabled={!ordinary || !me.cards.length || !room.discard}
                  onClick={() => onAction({ type: 'buzz', topId: room.discard!.id })}
                >
                  <BellRinging weight="duotone" />
                  <span>Snap buzzer</span>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="table-bottom">
          <span aria-live="polite">{room.events.at(-1)?.text}</span>
          <button className="text-button" onClick={onRules}>
            Powers & rules
          </button>
        </div>
        {confirm && (
          <ConfirmCall
            disabled={!ordinary}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              onAction({ type: 'cabo' });
            }}
          />
        )}
        {activity && <Activity room={room} onClose={() => setActivity(false)} />}
      </div>
    </LayoutGroup>
  );
}
function ConfirmCall({
  disabled,
  onCancel,
  onConfirm,
}: {
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="confirm-title"
      className="confirm-cabo"
      onCancel={onCancel}
    >
      <Crown weight="duotone" />
      <h2 id="confirm-title">Ready to call CABO?</h2>
      <p>
        Everyone else gets one final turn. Your hand is locked against swaps and opponent snaps. You
        need a strictly lower score to win.
      </p>
      <div>
        <button className="button secondary" autoFocus onClick={onCancel}>
          Keep playing
        </button>
        <button className="button primary" disabled={disabled} onClick={onConfirm}>
          Call CABO
        </button>
      </div>
    </dialog>
  );
}
function Activity({ room, onClose }: { room: PublicRoom; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const events = [...room.events].reverse();
  return (
    <dialog ref={ref} className="activity-dialog" onCancel={onClose}>
      <div className="dialog-heading">
        <h2>Table activity</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close activity">
          <X />
        </button>
      </div>
      <ol tabIndex={0} aria-label="Game activity, newest first">
        {events.map((e) => (
          <li key={e.id}>
            <span>{e.kind === 'snap' ? <Hand /> : <Spade />}</span>
            {e.text}
          </li>
        ))}
      </ol>
    </dialog>
  );
}
