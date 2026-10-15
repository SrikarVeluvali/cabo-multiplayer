'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  DoorOpen,
  GearSix,
  Moon,
  Plus,
  Question,
  Robot,
  Spade,
  SpeakerHigh,
  SpeakerSlash,
  Sun,
  Users,
  X,
} from '@phosphor-icons/react';
import { useCabo } from './use-cabo';
import { useTableSounds } from './use-table-sounds';
import Card from './card';
import Rules from './rules';
import Table from './table';
import type { Action, PublicRoom } from '@/lib/types';

export type OnAction = (action: Action) => Promise<void>;
export function Avatar({
  name,
  index = 0,
  bot = false,
}: {
  name: string;
  index?: number;
  bot?: boolean;
}) {
  return (
    <span className={`avatar avatar-${index % 6}`}>
      {bot ? <Robot weight="duotone" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Cabo() {
  const game = useCabo();
  const sound = useTableSounds(game.room);
  const [rules, setRules] = useState(false),
    [light, setLight] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setLight(localStorage.getItem('cabo-theme') === 'light');
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [game.room?.phase]);
  const copy = async () => {
    if (!game.room) return;
    const url = `${window.location.origin}/?room=${game.room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      game.setError(`Invite your friends with room code ${game.room.code}.`);
    }
  };
  const changeTheme = () => {
    localStorage.setItem('cabo-theme', light ? 'dark' : 'light');
    setLight(!light);
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="cabo-app" data-theme={light ? 'light' : 'dark'}>
        <header className="game-header">
          <div className="brand">
            <span className="brand-emblem">
              <Spade weight="fill" />
            </span>
            <div>
              <strong>
                cabo<span>.</span>
              </strong>
              <small>BY SRIKAR VELUVALI</small>
            </div>
          </div>
          <div className="header-center">
            {game.room ? (
              <>
                <span className="live-dot" />
                <span>
                  {game.room.phase === 'lobby' ? 'Private lounge' : `Round ${game.room.round}`}
                </span>
                <button className="room-code" onClick={copy} title="Copy invite link">
                  {game.room.code}
                  {copied ? <Check /> : <Copy />}
                </button>
              </>
            ) : (
              <span className="header-tagline">Cards, memory & a little nerve.</span>
            )}
          </div>
          <div className="header-tools">
            <button
              className="icon-button"
              onClick={sound.toggle}
              aria-label={sound.muted ? 'Enable sound effects' : 'Mute sound effects'}
              aria-pressed={!sound.muted}
              title={sound.muted ? 'Sound effects off' : 'Sound effects on'}
            >
              {sound.muted ? <SpeakerSlash /> : <SpeakerHigh />}
            </button>
            <button className="text-button rules-button" onClick={() => setRules(true)}>
              <Question />
              How to play
            </button>
            <button
              className="icon-button"
              onClick={changeTheme}
              aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              {light ? <Moon /> : <Sun />}
            </button>
            {game.room && game.room.phase === 'results' && (
              <button
                className="icon-button"
                onClick={() => game.action({ type: 'leave' })}
                disabled={game.busy}
                aria-label="Leave table"
              >
                <DoorOpen />
              </button>
            )}
          </div>
        </header>
        {game.offline && (
          <div className="connection-banner" role="status">
            Connection interrupted. Reconnecting to your seat…
          </div>
        )}
        <main>
          {game.restoring ? (
            <div className="loading-state">
              <Spade weight="fill" />
              <h2>Finding your seat…</h2>
            </div>
          ) : !game.room ? (
            <Welcome busy={game.busy} enter={game.enter} onRules={() => setRules(true)} />
          ) : game.room.phase === 'lobby' ? (
            <Lobby
              room={game.room}
              busy={game.busy}
              onAction={game.action}
              onCopy={copy}
              copied={copied}
            />
          ) : (
            <Table
              room={game.room}
              busy={game.busy || game.offline}
              now={game.now}
              onAction={game.action}
              onRules={() => setRules(true)}
            />
          )}
        </main>
        <AnimatePresence>
          {game.error && (
            <motion.div
              role="alert"
              className="toast"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span>{game.error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => game.setError('')}
              >
                <X />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {rules && <Rules onClose={() => setRules(false)} />}
      </div>
    </MotionConfig>
  );
}

function Welcome({
  busy,
  enter,
  onRules,
}: {
  busy: boolean;
  enter: (
    type: 'create' | 'join',
    name: string,
    code?: string,
    practice?: boolean,
  ) => Promise<void>;
  onRules: () => void;
}) {
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [join, setJoin] = useState(false);
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get('room');
    if (invite) {
      setCode(invite.toUpperCase().slice(0, 6));
      setJoin(true);
    }
    setName(localStorage.getItem('cabo-name') || '');
  }, []);
  const play = (practice = false) => {
    localStorage.setItem('cabo-name', name.trim());
    enter(join && !practice ? 'join' : 'create', name.trim(), code, practice);
  };
  return (
    <div className="welcome-screen">
      <section className="welcome-copy">
        <span className="eyebrow">Your people. Your table.</span>
        <h1>
          Keep your cards close.
          <br />
          Your memory closer.
        </h1>
        <p>
          Four face-down cards. A few well-timed powers.
          <br className="desktop-break" /> And the nerve to call it before anyone else.
        </p>
        <div className="welcome-art" aria-hidden="true">
          <span className="art-ring" />
          <div className="art-card art-one">
            <Card card={{ id: 'welcome-back' }} />
          </div>
          <div className="art-card art-two">
            <Card card={{ id: 'welcome-queen', rank: 'Q', suit: 'clubs' }} />
          </div>
          <div className="art-card art-three">
            <Card card={{ id: 'welcome-king', rank: 'K', suit: 'hearts' }} />
          </div>
          <span className="art-caption">A good hand is a well-remembered one.</span>
        </div>
        <div className="welcome-foot">
          <span>
            <Users />
            2–6 players
          </span>
          <span>
            <Spade />
            One deck. Endless second guesses.
          </span>
        </div>
      </section>
      <section className="entry-panel">
        <div className="entry-top">
          <Spade weight="fill" />
          <span>Make yourself at home.</span>
        </div>
        <h2>Pull up a chair.</h2>
        <p>Start a private table or find your friends.</p>
        <div className="segmented">
          <button className={!join ? 'selected' : ''} onClick={() => setJoin(false)}>
            Create a table
          </button>
          <button className={join ? 'selected' : ''} onClick={() => setJoin(true)}>
            Join friends
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            play();
          }}
        >
          <label htmlFor="display-name">What should we call you?</label>
          <input
            id="display-name"
            placeholder="Your name"
            value={name}
            maxLength={20}
            required
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
          {join && (
            <>
              <label htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                className="code-input"
                placeholder="ABC234"
                value={code}
                required
                minLength={6}
                maxLength={6}
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
              />
            </>
          )}
          <button
            className="button primary start-button"
            disabled={busy || !name.trim() || (join && code.length !== 6)}
            type="submit"
          >
            {busy ? 'Finding a table…' : join ? 'Take your seat' : 'Create private table'}
            <ArrowRight />
          </button>
        </form>
        <div className="entry-divider">
          <span>Just getting a feel for it?</span>
        </div>
        <button
          className="button secondary wide"
          disabled={busy || !name.trim()}
          onClick={() => play(true)}
        >
          <Robot />
          Practice with computers
        </button>
        <button className="text-button entry-rules" onClick={onRules}>
          New to Cabo? Learn the rules
          <ArrowRight />
        </button>
        <p className="entry-note">No accounts. No downloads. Just a room code.</p>
      </section>
    </div>
  );
}

function Lobby({
  room,
  busy,
  onAction,
  onCopy,
  copied,
}: {
  room: PublicRoom;
  busy: boolean;
  onAction: OnAction;
  onCopy: () => void;
  copied: boolean;
}) {
  const host = room.hostId === room.you,
    me = room.players.find((p) => p.id === room.you)!;
  const waiting = room.players.some((p) => p.id !== room.hostId && !p.ready);
  const [panel, setPanel] = useState<'players' | 'settings'>('players');
  return (
    <div className="lobby-screen blackjack-lobby" data-panel={panel}>
      <div className="waiting-heading">
        <div>
          <h1>Your private table</h1>
          <p>Send the invite. Save a seat for your people.</p>
        </div>
        <span className="badge">
          <Spade weight="fill" />
          Cabo · 2–6 players
        </span>
      </div>
      <div className="lobby-tabs segmented">
        <button
          className={panel === 'players' ? 'selected' : ''}
          onClick={() => setPanel('players')}
        >
          <Users />
          Players <span>{room.players.length}</span>
        </button>
        <button
          className={panel === 'settings' ? 'selected' : ''}
          onClick={() => setPanel('settings')}
        >
          <GearSix />
          Table settings
        </button>
      </div>
      <div className="lobby-columns">
        <section className="guest-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">The guest list</span>
              <h2>Save a seat for your people.</h2>
            </div>
            <span className="badge">
              <Users />
              {room.players.length} / 6
            </span>
          </div>
          <div className="guest-grid">
            <AnimatePresence initial={false}>
              {room.players.map((p, i) => (
                <motion.div
                  layout
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="guest-seat"
                  key={p.id}
                >
                  <span className={`guest-status ${p.id === room.hostId ? 'gold' : ''}`}>
                    {p.id === room.hostId ? (
                      <>
                        <Crown weight="fill" />
                        Host
                      </>
                    ) : p.bot ? (
                      <>
                        <Robot />
                        Computer
                      </>
                    ) : p.ready ? (
                      <>
                        <Check />
                        Ready
                      </>
                    ) : (
                      'Getting settled'
                    )}
                  </span>
                  <Avatar name={p.name} index={i} bot={p.bot} />
                  <strong>
                    {p.name}
                    {p.id === room.you && <small> (you)</small>}
                  </strong>
                  <span className="seat-subtitle">
                    {p.wins
                      ? `${p.wins} round${p.wins === 1 ? '' : 's'} won`
                      : p.bot
                        ? 'Here for a practice round'
                        : 'Here for a good hand'}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {Array.from({ length: 6 - room.players.length }, (_, i) => (
              <button className="guest-seat empty-seat" key={i} onClick={onCopy}>
                <span className="empty-avatar">
                  <Plus />
                </span>
                <strong>Open seat</strong>
                <span>Invite a friend</span>
              </button>
            ))}
          </div>
          <div className="guest-invite">
            <span>
              <Spade weight="fill" />
              Private table. Good company.
            </span>
            <button className="button secondary" onClick={onCopy}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Invite copied' : 'Copy invite'}
            </button>
          </div>
        </section>
        <section className="settings-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Your house rules</span>
              <h2>Set the table.</h2>
            </div>
            <GearSix />
          </div>
          <p className="panel-description">A little breathing room between every move.</p>
          <fieldset disabled={!host || busy}>
            <label>
              Computer players
              <select
                value={room.players.filter((p) => p.bot).length}
                onChange={(e) => onAction({ type: 'bots', count: Number(e.target.value) })}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option
                    key={n}
                    value={n}
                    disabled={n + room.players.filter((p) => !p.bot).length > 6}
                  >
                    {n === 0 ? 'Just friends' : `${n} computer${n === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time per turn
              <select
                value={room.settings.turnSeconds}
                onChange={(e) =>
                  onAction({
                    type: 'settings',
                    settings: { ...room.settings, turnSeconds: Number(e.target.value) },
                  })
                }
              >
                {[30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Table pace
              <select
                value={room.settings.pace}
                onChange={(e) =>
                  onAction({
                    type: 'settings',
                    settings: { ...room.settings, pace: e.target.value as 'relaxed' | 'quick' },
                  })
                }
              >
                <option value="relaxed">Relaxed · 3-second snap windows</option>
                <option value="quick">Quick · 1.8-second snap windows</option>
              </select>
            </label>
          </fieldset>
          <div className="settings-note">
            <EyeNote />
            <p>Opening peeks always last 15 seconds. Each player chooses their own two cards.</p>
          </div>
        </section>
      </div>
      <div className="lobby-dock">
        <button
          className="button danger waiting-leave"
          disabled={busy}
          onClick={() => onAction({ type: 'leave' })}
        >
          <DoorOpen />
          Leave table
        </button>
        <p className="lobby-ready">
          <span className="live-dot" />
          {host
            ? waiting
              ? 'Waiting for everyone to be ready.'
              : room.players.length < 2
                ? 'Invite a friend or add a computer.'
                : 'The table is yours.'
            : 'The host will deal when everyone is ready.'}
        </p>
        {host ? (
          <button
            className="button primary start-button"
            disabled={busy || room.players.length < 2 || waiting}
            onClick={() => onAction({ type: 'start' })}
          >
            Start game
            <ArrowRight />
          </button>
        ) : (
          <button
            className={`button ${me.ready ? 'secondary' : 'primary'} start-button`}
            disabled={busy}
            onClick={() => onAction({ type: 'ready' })}
          >
            {me.ready ? (
              <>
                <Check />
                Ready. Waiting for the host.
              </>
            ) : (
              'I’m ready'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
function EyeNote() {
  return (
    <span className="note-card">
      2<span>/ 4</span>
    </span>
  );
}
