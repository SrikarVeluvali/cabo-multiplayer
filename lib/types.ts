export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Card = { id: string; rank: Rank; suit: Suit };
export type TableCard = { id: string; rank?: Rank; suit?: Suit };
export type Target = { playerId: string; cardId: string };
export type Settings = {
  turnSeconds: number;
  pace: 'relaxed' | 'quick';
  mode?: 'cabo' | 'mathbo';
  mathSeconds?: number;
};
export type Player = {
  id: string;
  name: string;
  cards: Card[];
  connected: number;
  bot: boolean;
  ready: boolean;
  wins: number;
  memory: Record<string, number>;
  turns: number;
};
export type Stage = 'draw' | 'choose' | 'power-look' | 'power-view' | 'power-swap' | 'between';
export type Power = { label: string; count: number; scope: 'own' | 'other' | 'any'; swap: boolean };
export type Snap = {
  playerId: string;
  topId: string;
  deadline: number;
  pausedAt: number;
  stage: 'choose' | 'math' | 'give';
  target?: Target;
  math?: { id: string; source: number; target: number; startedAt: number };
};
export type GameEvent = {
  id: string;
  text: string;
  at: number;
  kind: 'info' | 'draw' | 'discard' | 'swap' | 'snap' | 'penalty' | 'cabo';
  announcement?: string;
  equation?: string;
};
export type Replacement = {
  playerId: string;
  index: number;
  cardId: string;
  discarded: Card;
  at: number;
  until: number;
};
export type CardLocation =
  | { zone: 'hand'; playerId: string; index: number }
  | { zone: 'draw' | 'discard' | 'deck' | 'reveal' };
export type CardFlight = {
  card: TableCard;
  from: CardLocation;
  to: CardLocation;
  faceUp: boolean;
};
export type CardMovement = {
  id: string;
  kind: 'discard' | 'swap' | 'snap' | 'gift' | 'penalty';
  at: number;
  until: number;
  flights: CardFlight[];
  hands: { playerId: string; cardIds: string[] }[];
  discardUnder?: Card;
};
export type Room = {
  code: string;
  version: number;
  hostId: string;
  tokens: Record<string, string>;
  players: Player[];
  phase: 'lobby' | 'peek' | 'playing' | 'results';
  stage: Stage;
  settings: Settings;
  round: number;
  deck: Card[];
  discard: Card[];
  drawn: Card | null;
  power: Power | null;
  turnIndex: number;
  deadline: number;
  availableAt: number;
  updated: number;
  initialChoices: Record<string, string[]>;
  privatePeek: { playerId: string; cardIds: string[]; until: number } | null;
  caboId: string | null;
  finalTurns: string[];
  snapAttempts: Record<string, string>;
  snap: Snap | null;
  publicReveals: Record<string, number>;
  winners: string[];
  winnerNames: string[];
  events: GameEvent[];
  replacement?: Replacement | null;
  endReason?: 'cabo' | 'deck' | 'players' | null;
  movement?: CardMovement | null;
};
export type PublicRoom = Omit<
  Room,
  | 'tokens'
  | 'deck'
  | 'discard'
  | 'players'
  | 'drawn'
  | 'privatePeek'
  | 'initialChoices'
  | 'snapAttempts'
  | 'replacement'
> & {
  you: string;
  serverNow: number;
  deckCount: number;
  discard: Card | null;
  players: (Omit<Player, 'cards' | 'memory'> & {
    cards: TableCard[];
    score?: number;
    peekCount: number;
  })[];
  drawn: TableCard | null;
  peekUntil: number | null;
  looks: { playerId: string; cardIds: string[]; until: number }[];
  replacement: (Replacement & { incoming: TableCard }) | null;
};
export type Action =
  | { type: 'ready' }
  | { type: 'settings'; settings: Settings }
  | { type: 'bots'; count: number }
  | {
      type:
        | 'start'
        | 'lobby'
        | 'leave'
        | 'draw'
        | 'discard'
        | 'power'
        | 'skip-look'
        | 'finish-look'
        | 'skip-swap'
        | 'cabo';
    }
  | { type: 'initial-peek'; cardId: string }
  | { type: 'replace'; cardId: string }
  | { type: 'look'; targets: Target[] }
  | { type: 'swap'; targets: Target[] }
  | { type: 'buzz'; topId: string }
  | { type: 'snap'; target: Target }
  | { type: 'give'; cardId: string }
  | { type: 'math-submit'; challengeId: string; expression: string };
