'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
  Cards,
  Crown,
  Eye,
  GearSix,
  Copy,
  Question,
  SpeakerHigh,
  SpeakerSlash,
  Moon,
  Sun,
  DoorOpen,
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
import MathSnap from './math-snap';
import ViewMotion, { useCardViews } from './view-motion';
import { Avatar, type OnAction } from './cabo';
import { useViewport } from './use-viewport';

type Person = PublicRoom['players'][number];
export default function Table({
  room,
  busy,
  now,
  onAction,
  onRules,
  muted,
  onMute,
  light,
  onTheme,
  onDeck,
  onCopy,
  copied,
}: {
  room: PublicRoom;
  busy: boolean;
  now: number;
  onAction: OnAction;
  onRules: () => void;
  muted: boolean;
  onMute: () => void;
  light: boolean;
  onTheme: () => void;
  onDeck: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const [replace, setReplace] = useState(false),
    [selected, setSelected] = useState<Target[]>([]),
    [confirm, setConfirm] = useState(false);
  const [activity, setActivity] = useState(false),
    [seatPage, setSeatPage] = useState(0);
  const size = useViewport();
  const reduce = useReducedMotion();
  const views = useCardViews(room, now, !!reduce);
  const publicViews = views.filter((view) => view.viewerId === null);
  const returningViews = views.some((view) => view.returningAt !== undefined);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node))
        optionsRef.current.open = false;
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);
  const replacement =
    !reduce && room.replacement && now < room.replacement.until ? room.replacement : null;
  const movement = !reduce && room.movement && now < room.movement.until ? room.movement : null;
  const movingIds = new Set(movement?.flights.map((f) => f.card.id) || []);
  const movementOwner = movement?.hands.find((h) => h.playerId !== room.you)?.playerId;
  const focusOwner =
    replacement?.playerId ||
    room.snap?.playerId ||
    views.find((view) => view.viewerId === room.you)?.ownerId ||
    views[0]?.viewerId ||
    movementOwner;
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
          : size.width < 1500
            ? 3
            : 5;
  const current = room.players[room.turnIndex],
    me = room.players.find((p) => p.id === room.you)!;
  const peek = room.phase === 'peek',
    results = room.phase === 'results',
    myTurn = current.id === room.you;
  const snap = room.snap,
    ownSnap = snap?.playerId === room.you;
  const canAct = !busy && now >= room.availableAt && !returningViews;
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
  const cardScale =
    size.height < 500 || (size.width < 650 && size.height < 700)
      ? 'compact'
      : size.height >= 800 &&
          size.width >= 1366 &&
          shown.length <= 3 &&
          (size.height >= 1000 || (me.cards.length <= 8 && shown.every((p) => p.cards.length <= 4)))
        ? 'roomy'
        : size.height >= 740 &&
            size.width >= 1200 &&
            shown.length <= 3 &&
            (size.height >= 900 ||
              (me.cards.length <= 8 && shown.every((p) => p.cards.length <= 4)))
          ? 'large'
          : size.height >= 700 && size.width >= 1100 && shown.length <= 4
            ? 'laptop'
            : size.height >= 700 && size.width >= 950 && shown.length <= 4
              ? 'medium'
              : 'normal';
  const cardWidth =
    cardScale === 'compact'
      ? 36
      : cardScale === 'roomy'
        ? 88
        : cardScale === 'large'
          ? 80
          : cardScale === 'laptop'
            ? 68
            : cardScale === 'medium'
              ? 60
              : 52;
  const cardHeight =
    cardScale === 'compact'
      ? 52
      : cardScale === 'roomy'
        ? 128
        : cardScale === 'large'
          ? 116
          : cardScale === 'laptop'
            ? 99
            : cardScale === 'medium'
              ? 87
              : 74;
  const cardGap =
    cardScale === 'roomy'
      ? size.width < 1440
        ? 10
        : 16
      : cardScale === 'large'
        ? 12
        : ['laptop', 'medium'].includes(cardScale)
          ? 10
          : 8;
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
  const isPrivatelyLifted = (id: string) =>
    views.some((view) => view.viewerId !== null && view.card.id === id);
  const isLifted = (id: string) => views.some((view) => view.card.id === id);
  function selectable(owner: string, cardId: string) {
    if (!canAct || results) return false;
    if (peek) return owner === room.you && me.peekCount < 2 && !isLifted(cardId);
    if (snap) {
      if (!ownSnap) return false;
      if (snap.stage === 'math') return false;
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
        : room.endReason === 'players'
          ? 'The other players left. You are the last player at the table.'
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
      ? snap.stage === 'math'
        ? 'Make the Mathbo match.'
        : snap.stage === 'give'
          ? 'A match! Give one card.'
          : 'You won the buzzer.'
      : `${room.players.find((p) => p.id === snap.playerId)?.name} won the buzzer.`;
    help = ownSnap
      ? snap.stage === 'math'
        ? 'Build an expression equal to the discard. Your card is public.'
        : snap.stage === 'give'
          ? 'Choose your card to give. It stays hidden.'
          : 'Choose your card or a card in an unlocked opponent hand.'
      : snap.stage === 'math'
        ? `${room.players.find((p) => p.id === snap.playerId)?.name} is building an expression. Play is paused.`
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

  if (returningViews && !results) {
    title = 'Returning cards.';
    help = 'Cards are travelling back to their original slots.';
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
      (own || (shown.length === 1 && size.width < 650) || size.height < 500) &&
      cards.length <= (own && size.width >= 950 ? 8 : 6)
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
      rows > 1
        ? Math.max(0, (rows * (cardHeight + 15) + (rows - 1) * cardGap - maxHeight) / (rows - 1))
        : 0;
    const handStyle = {
      '--hand-columns': columns,
      '--hand-gap': `${cardGap}px`,
      '--row-overlap': `${overlap}px`,
      '--hand-step': `${Math.min(cardWidth, ((size.height < 500 ? (size.width - 100) / 3 : size.width - 64) - (columns - 1) * cardGap) / columns)}px`,
    } as CSSProperties;
    const lifted = views.filter((view) => view.viewerId === p.id);
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
        <div className="hand-cards" style={handStyle}>
          {cards.map((c, i) => {
            const face =
              results || (!!room.publicReveals?.[c.id] && now < room.publicReveals[c.id]);
            return (
              <motion.div
                layout={movingIds.has(c.id) ? false : 'position'}
                layoutDependency={`${p.id}-${cards.map((card) => card.id).join(',')}-${cardScale}`}
                transition={{ layout: { duration: reduce ? 0 : 0.7, ease: 'easeInOut' } }}
                key={c.id}
                className={`numbered-card ${replacement?.cardId === c.id || movingIds.has(c.id) ? 'replacement-hidden' : ''}`}
                data-hand-slot={`${p.id}-${i}`}
                data-card-id={c.id}
              >
                {isLifted(c.id) ? (
                  <div
                    className="card-placeholder"
                    aria-label={`${p.name}, card ${i + 1}, ${isPrivatelyLifted(c.id) ? 'being peeked' : 'revealed at the center'}`}
                  >
                    <Eye />
                  </div>
                ) : (
                  <Card
                    card={c}
                    visible={face}
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
        </div>
        {!!lifted.length && (
          <div className={`peek-desk ${own ? 'your-peek' : ''}`}>
            <div className="peek-desk-cards">
              {lifted.map((view) => (
                <div
                  key={view.id}
                  className="view-desk-placeholder"
                  data-view-desk={view.id}
                  aria-hidden="true"
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
      <div
        className="table-screen"
        data-capacity={capacity}
        data-card-scale={cardScale}
        data-cabo={!!room.caboId && !results}
        data-results={results}
      >
        <div className="table-topline">
          <div className="table-session">
            <button className="table-room" onClick={onCopy} title="Copy invite link">
              <Spade weight="fill" /> {room.code} {copied ? <Check /> : <Copy />}
            </button>
            <span className="table-phase">
              {peek
                ? 'Opening peek'
                : results
                  ? 'Round complete'
                  : room.caboId
                    ? 'Final lap'
                    : `Round ${room.round}`}
              <small>
                {room.settings.mode === 'mathbo' ? 'Mathbo' : 'Matching ranks'} ·{' '}
                {room.players.length} players
              </small>
            </span>
          </div>
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
            <details
              ref={optionsRef}
              className="table-options"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary aria-label="Table options" title="Table options">
                <GearSix />
              </summary>
              <div
                className="table-options-menu"
                onClick={() => {
                  if (optionsRef.current) optionsRef.current.open = false;
                }}
              >
                <button onClick={onMute} aria-label={muted ? 'Enable sounds' : 'Mute sounds'}>
                  {muted ? <SpeakerSlash /> : <SpeakerHigh />}
                  {muted ? 'Enable sounds' : 'Mute sounds'}
                </button>
                <button onClick={onTheme} aria-label={light ? 'Dark controls' : 'Light controls'}>
                  {light ? <Moon /> : <Sun />}
                  {light ? 'Dark controls' : 'Light controls'}
                </button>
                <button onClick={onDeck} aria-label="Customize deck">
                  <Cards />
                  Customize deck
                </button>
                <button onClick={onRules} aria-label="Learn the rules">
                  <Question />
                  Learn the rules
                </button>
                <button onClick={onCopy} aria-label={copied ? 'Invite copied' : 'Copy invite'}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Invite copied' : 'Copy invite'}
                </button>
                <button
                  className="leave-table-action"
                  disabled={busy}
                  onClick={() => onAction({ type: 'leave' })}
                >
                  <DoorOpen />
                  {results ? 'Leave table' : 'Leave game'}
                </button>
              </div>
            </details>
          </div>
        </div>
        {results ? (
          <RoundResult room={room} reduced={!!reduce} />
        ) : (
          <TableAction room={room} now={now} revealing={!!reveals.length} />
        )}
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
            {[
              ...new Set([
                ...(movement?.hands.map((h) => h.playerId) ?? []),
                ...views.map((view) => view.ownerId),
              ]),
            ]
              .filter((id) => id !== room.you && !shown.some((p) => p.id === id))
              .map((id, i) => (
                <div
                  className="motion-seat-anchor"
                  data-motion-anchor={id}
                  key={id}
                  style={{ right: i ? 'auto' : 18, left: i ? 18 : 'auto' }}
                >
                  {room.players.find((p) => p.id === id)?.name}
                </div>
              ))}
            {movement && (
              <CardMotion
                key={movement.id}
                movement={movement}
                now={now}
                width={cardWidth}
                height={cardHeight}
              />
            )}
            {replacement && (
              <ReplacementMotion
                key={replacement.at}
                replacement={replacement}
                now={now}
                width={cardWidth}
                height={cardHeight}
              />
            )}
            {!!publicViews.length && (
              <div className="public-reveal">
                <div className="peek-desk-cards">
                  {publicViews.map((view) => (
                    <div key={view.id} data-public-card={view.card.id}>
                      <div
                        className="view-desk-placeholder"
                        data-view-desk={view.id}
                        aria-hidden="true"
                      />
                      <span>
                        {room.players.find((p) => p.id === view.ownerId)?.name} · card{' '}
                        {(room.players
                          .find((p) => p.id === view.ownerId)
                          ?.cards.findIndex((c) => c.id === view.card.id) ?? 0) + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <p>
                  <Eye />
                  {snap?.stage === 'math'
                    ? `Mathbo · ${remaining}s to make the match`
                    : snap?.stage === 'give' && room.settings.mode === 'mathbo'
                      ? 'Mathbo solved · choosing a gift'
                      : room.events.at(-1)?.announcement === 'Mathbo missed'
                        ? 'Mathbo missed · one hidden penalty'
                        : 'Visible to everyone'}
                </p>
              </div>
            )}
            {views
              .filter(
                (view) =>
                  view.viewerId === null ||
                  view.viewerId === room.you ||
                  shown.some((p) => p.id === view.viewerId),
              )
              .map((view) => (
                <ViewMotion key={view.id} view={view} now={now} you={room.you} reduced={!!reduce} />
              ))}
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
                  ? snap.stage === 'math'
                    ? 'Solve the expression'
                    : snap.stage === 'give'
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
        {ownSnap && snap?.stage === 'math' && snap.math && (
          <MathSnap key={snap.math.id} room={room} now={now} busy={busy} onAction={onAction} />
        )}
      </div>
    </LayoutGroup>
  );
}
function RoundResult({ room, reduced }: { room: PublicRoom; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const names = room.winnerNames?.length
    ? room.winnerNames
    : room.players.filter((p) => room.winners.includes(p.id)).map((p) => p.name);
  const score = room.players.find((p) => room.winners.includes(p.id))?.score;
  const headline = names.length
    ? `${names.join(' & ')} ${names.length === 1 ? 'wins' : 'win'}!`
    : 'Round ended';
  useLayoutEffect(() => {
    const banner = ref.current;
    const table = banner?.parentElement;
    if (!banner || !table) return;
    // Reserve the real height, including wrapped names, before the cards paint.
    const measure = () => table.style.setProperty('--result-height', `${banner.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      table.style.removeProperty('--result-height');
    };
  }, []);
  return (
    <motion.section
      ref={ref}
      className="round-result"
      data-long={headline.length > 42}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : 0.55 }}
    >
      <div className="round-result-heading">
        {names.length > 0 && <Trophy weight="fill" aria-hidden="true" />}
        <h1>{headline}</h1>
      </div>
      <p>
        {score !== undefined
          ? `${score} ${score === 1 ? 'point' : 'points'} · ${names.length > 1 ? 'Shared victory' : 'Round winner'}`
          : names.length
            ? 'Round winner'
            : 'No human players remain.'}
      </p>
    </motion.section>
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
