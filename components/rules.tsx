'use client';
import {
  X,
  ArrowRight,
  CaretLeft,
  ArrowClockwise,
  BellRinging,
  LockKey,
  Check,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { TableCard } from '@/lib/types';
import { checkMathbo } from '@/lib/mathbo';
import Card from './card';
type Lesson = { title: string; paragraphs: string[]; powers?: string[][]; note: string };
const lessons: Lesson[] = [
  {
    title: 'Four cards. Fifteen seconds.',
    paragraphs: [
      'Finish with the lowest sum. Each player gets four face-down cards. After the deal, choose any two of your own cards during the shared 15-second window.',
      'Your chosen cards travel to your private desk. Only you see their faces. They return to their original slots when time ends. Remember the numbered positions.',
    ],
    note: 'No later peeks without a card power.',
  },
  {
    title: 'Draw, then decide.',
    paragraphs: [
      'On your turn, draw privately from the deck. Discard it, use its power and discard it, or replace one of your face-down cards. The replaced card is discarded without a power.',
      'A = 1 · 2–10 = face value · J = 11 · Q = 12 · K♣ / K♠ = 13 · K♥ / K♦ = −1. King values follow their suit, including with custom artwork. An empty hand scores zero.',
    ],
    note: 'You cannot draw from the discard pile.',
  },
  {
    title: 'A little inside information.',
    powers: [
      ['7 / 8', 'Peek', 'Look at one of your own cards.'],
      ['9 / 10', 'Spy', 'Look at one card in another player’s hand.'],
    ],
    paragraphs: [
      'Power peeks travel to your desk for up to five seconds, then return to their original slots. Everyone else sees the backs.',
    ],
    note: 'Powers are optional. You may skip a look.',
  },
  {
    title: 'Change the table.',
    powers: [
      ['J', 'Blind swap', 'Swap any two different, unlocked cards.'],
      ['Q', 'Look & swap', 'Look at one card anywhere; optionally swap any two.'],
      ['K♣ / K♠', 'Double look & swap', 'Look at two cards anywhere; optionally swap any two.'],
    ],
    paragraphs: [],
    note: 'Looking and swapping are separate. You may skip either step. Kings of hearts or diamonds have no power.',
  },
  {
    title: 'Fast hands win the buzzer.',
    paragraphs: [
      'With Snap Rule set to Matching ranks, look for a matching rank on the discard and hit the snap buzzer. The first press accepted by the server reserves the table for that player.',
      'You get eight seconds to choose a card. A correct snap from your hand discards it. A miss keeps it in place, reveals it to everyone for five seconds, and gives you one hidden penalty card.',
    ],
    note: 'No choice in eight seconds also means a penalty. One buzzer attempt per player per top discard.',
  },
  {
    title: 'Snap someone else’s card.',
    paragraphs: [
      'After winning the buzzer, you may choose a card in an unlocked opponent hand. If it matches the top discard, choose one of your cards to give them, face down. Their matching card is discarded and your chosen card fills its slot.',
      'You get eight seconds to choose the gift; a random card is given if time expires. If the snap is wrong, their attempted card is publicly revealed for five seconds and you get a hidden penalty.',
    ],
    note: 'Matching ranks: all kings match. Mathbo replaces the rank check with an equation. CABO hands cannot take part in opponent-snap transfers.',
  },
  {
    title: 'Know when to call CABO.',
    paragraphs: [
      'Call CABO before drawing, using your turn. Your hand becomes locked against swaps and opponent snaps. You can still snap your own cards. Everyone else gets exactly one final turn.',
      'After the last snap window, all cards reveal. The caller wins only with a strictly lower sum. Otherwise, the other players sharing the actual lowest score win.',
    ],
    note: 'Turn clocks pause during buzzer reservations. Expired turns pass. If the deck runs out before CABO, resolve the last draw and reveal: the lowest score wins, with ties sharing the win.',
  },
];
const mathboLesson: Lesson = {
  title: 'Mathbo: make the match.',
  paragraphs: [
    'Set Snap Rule to Mathbo and choose an expression timer in the waiting room. Win the usual buzzer, then choose your own card or an unlocked opponent card. It is revealed to everyone while you build an expression equal to the top discard.',
    'Tap the operation boxes or type. Your card number must appear at least once. Both sides of every + or − must contain your card number, including inside nested expressions. Other operations can use extra numbers. Zero exponents are forbidden, including computed zeros. You cannot cancel your card into 1 and multiply or divide a free-number expression by it, or use it as an exponent of 1. Multiplication, division, powers, factorial, log₂, log₁₀, roots, absolute value, nCr, nPr, and parentheses are supported.',
    'Use Cabo scores: A=1, J=11, Q=12, black K=13, red K=−1. The card number alone is valid if it equals the discard. Submit a correct equation to snap; opponent snaps still need a hidden gift. A wrong submission or timeout adds one unseen penalty and keeps the selected card public for five seconds.',
  ],
  note: 'Selected 6 → discard 9: 6 + (6 ÷ 2) is valid; 6 + 3 is not. Both sides of + contain 6 in the valid expression. A matching card number alone is also valid.',
};
export default function Rules({
  onClose,
  mode = 'cabo',
}: {
  onClose: () => void;
  mode?: 'cabo' | 'mathbo';
}) {
  const activeLessons =
    mode === 'mathbo'
      ? [...lessons.slice(0, 4), mathboLesson, ...lessons.slice(4)]
      : [...lessons, mathboLesson];
  const ref = useRef<HTMLDialogElement>(null),
    [page, setPage] = useState(0);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const active = Math.min(page, activeLessons.length - 1),
    lesson = activeLessons[active];
  const nav = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    nav.current?.querySelector('[aria-current]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduce ? 'instant' : 'smooth',
    });
    content.current?.scrollTo({ top: 0 });
    content.current?.querySelector('.lesson-copy')?.scrollTo({ top: 0 });
  }, [active, reduce]);
  const kind = lesson === mathboLesson ? 7 : lessons.indexOf(lesson);
  const labels = [
    'Opening',
    'Your turn',
    'Peek & spy',
    'Swaps',
    'Your snap',
    'Opponent snap',
    'CABO',
    'Mathbo',
  ];
  return (
    <dialog
      ref={ref}
      className="rules-dialog rules-walkthrough"
      aria-labelledby="rules-title"
      onCancel={onClose}
    >
      <div className="dialog-heading">
        <div>
          <h2 id="rules-title">Learn the rules</h2>
          <p>Try a few cards. Get a feel for Cabo.</p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close rules">
          <X />
        </button>
      </div>
      <nav ref={nav} className="lesson-nav" aria-label="Rule lessons">
        {activeLessons.map((item, i) => (
          <button
            key={item.title}
            aria-current={i === active ? 'step' : undefined}
            onClick={() => setPage(i)}
          >
            <span>{i + 1}</span>
            {labels[item === mathboLesson ? 7 : lessons.indexOf(item)]}
          </button>
        ))}
      </nav>
      <div ref={content} className="lesson-content">
        <LessonDemo key={kind} kind={kind} />
        <div className="lesson-copy" tabIndex={0} aria-label="Lesson details">
          <span className="lesson-number">
            {String(active + 1).padStart(2, '0')} / {activeLessons.length}
          </span>
          <h3>{lesson.title}</h3>
          {lesson.powers?.map(([rank, name, text]) => (
            <div className="power-row" key={rank}>
              <span className="rank-label">{rank}</span>
              <div>
                <strong>{name}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
          {lesson.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {lesson.note && <p className="rule-callout">{lesson.note}</p>}
        </div>
      </div>
      <div className="dialog-footer">
        <button className="button secondary" disabled={!page} onClick={() => setPage(page - 1)}>
          <CaretLeft />
          Back
        </button>
        <span>
          {active + 1} of {activeLessons.length}
        </span>
        <button
          className="button primary"
          onClick={() => (active === activeLessons.length - 1 ? onClose() : setPage(active + 1))}
        >
          {active === activeLessons.length - 1 ? 'Let’s play' : 'Next'}
          <ArrowRight />
        </button>
      </div>
    </dialog>
  );
}

const sample = (rank: TableCard['rank'], suit: TableCard['suit'] = 'clubs'): TableCard => ({
  id: `lesson-${rank}-${suit}`,
  rank,
  suit,
});

function LessonDemo({ kind }: { kind: number }) {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0),
    [run, setRun] = useState(0);
  const [chosen, setChosen] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false),
    [spy, setSpy] = useState(false);
  const [expression, setExpression] = useState('6+(6/2)');
  const [tied, setTied] = useState(false);
  useEffect(() => {
    if (!run) return;
    setBeat(1);
    const times = [setTimeout(() => setBeat(2), 1000), setTimeout(() => setBeat(3), 2200)];
    return () => times.forEach(clearTimeout);
  }, [run]);
  function tile(
    id: string,
    card: TableCard,
    left: number,
    top: number,
    face: boolean,
    click?: () => void,
    selected = false,
  ) {
    return (
      <motion.div
        key={id}
        className="lesson-card"
        animate={{ left: `${left}%`, top, opacity: 1 }}
        initial={false}
        transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 0.7, 0.15, 1] }}
      >
        <Card
          card={card}
          visible={face}
          onClick={click}
          selected={selected}
          label={click ? `Practice card ${id}` : undefined}
        />
      </motion.div>
    );
  }
  const replay = (label = 'Watch it play') => (
    <button className="lesson-replay" onClick={() => setRun(run + 1)}>
      <ArrowClockwise />
      {run ? 'Replay' : label}
    </button>
  );
  let feedback = '',
    valid = false;
  if (kind === 7) {
    try {
      checkMathbo(expression, 6, 9);
      valid = true;
      feedback = 'Valid. Both sides of + use your 6, and the result is 9.';
    } catch (error) {
      feedback = error instanceof Error ? error.message : 'Try another expression.';
    }
  }
  return (
    <section className="lesson-demo" aria-label="Interactive card example">
      <div className="lesson-scene">
        {kind === 0 && (
          <>
            <span className="lesson-table-label">Your four cards · choose any two</span>
            {[sample('3'), sample('K', 'hearts'), sample('8'), sample('Q', 'spades')].map(
              (card, i) =>
                tile(
                  String(i + 1),
                  card,
                  18 + i * 21,
                  chosen.includes(i) ? 58 : 92,
                  chosen.includes(i),
                  () =>
                    setChosen((prev) =>
                      prev.includes(i) || prev.length === 2 ? prev : [...prev, i],
                    ),
                  chosen.includes(i),
                ),
            )}
            <span className="lesson-scene-caption">
              {chosen.length}/2 peeks chosen · only you see these faces
            </span>
          </>
        )}
        {kind === 1 && (
          <>
            <span className="lesson-table-label">Draw → decide → replace</span>
            {tile('deck', { id: 'lesson-deck' }, 18, 57, false)}
            {tile('old', sample('Q', 'spades'), beat >= 3 ? 82 : 45, 125, beat >= 3)}
            {tile(
              'new',
              sample('3', 'hearts'),
              beat >= 3 ? 45 : beat >= 1 ? 65 : 18,
              beat >= 3 ? 125 : 57,
              beat >= 1 && beat < 3,
            )}
            <span className="lesson-pile-label" style={{ left: '18%' }}>
              Deck
            </span>
            <span className="lesson-pile-label" style={{ left: '82%' }}>
              Discard
            </span>
            <span className="lesson-scene-caption">
              {beat >= 3
                ? '3 joins your hand. The old queen is discarded.'
                : beat
                  ? 'Only you see your draw. Choose a slot to replace.'
                  : 'A lower card can improve your hand.'}
            </span>
          </>
        )}
        {(kind === 2 || kind === 3) && (
          <>
            <span className="lesson-table-label">Opponent</span>
            {tile(
              'opponent',
              sample('K', 'spades'),
              kind === 3 && beat >= 2 ? 70 : 30,
              kind === 3 && beat >= 2 ? 139 : kind === 2 && spy && beat === 2 ? 95 : 43,
              kind === 2 && spy && beat === 2,
            )}
            {tile(
              'you',
              sample('4', 'diamonds'),
              kind === 3 && beat >= 2 ? 30 : 70,
              kind === 3 && beat >= 2 ? 43 : kind === 2 && !spy && beat === 2 ? 95 : 139,
              kind === 2 && !spy && beat === 2,
            )}
            <span className="lesson-seat-label">You</span>
            <span className="lesson-scene-caption">
              {kind === 3
                ? beat >= 2
                  ? 'Two cards trade places, face down.'
                  : 'Choose any two unlocked cards.'
                : beat === 2
                  ? 'A private look at your desk.'
                  : 'The card returns to the same slot.'}
            </span>
          </>
        )}
        {(kind === 4 || kind === 5) && (
          <>
            <span className={`lesson-buzzer ${beat === 1 ? 'is-held' : ''}`}>
              <BellRinging />
              {beat === 1
                ? 'Your buzzer · 8 seconds'
                : kind === 5
                  ? 'Opponent’s card → discard'
                  : 'Matching ranks'}
            </span>
            {tile('discard', sample('6', 'spades'), 78, 61, true)}
            {tile(
              'snap',
              sample(wrong ? 'Q' : '6', 'hearts'),
              beat >= 2 && !wrong ? 78 : 29,
              beat >= 2 && !wrong ? 61 : 123,
              beat >= 2,
            )}
            {kind === 5 && tile('gift', sample('9'), beat >= 3 && !wrong ? 29 : 51, 123, false)}
            {wrong && beat >= 3 && tile('penalty', { id: 'penalty' }, 51, 123, false)}
            <span className="lesson-scene-caption">
              {beat >= 2
                ? wrong
                  ? 'Wrong rank: reveal for 5 seconds + hidden penalty.'
                  : kind === 5
                    ? beat >= 3
                      ? 'Give one of your cards to fill their empty slot.'
                      : 'Their matching card leaves the table.'
                    : 'Correct! One fewer card in your hand.'
                : 'Win the buzzer, then choose your card.'}
            </span>
          </>
        )}
        {kind === 6 && (
          <>
            <span className="lesson-table-label">
              {beat ? 'CABO · your hand is locked' : 'Think you have the lowest total?'}
            </span>
            {tile('caller', sample('3', 'hearts'), 30, 86, beat >= 2)}
            {tile('other', sample(tied ? '3' : '8', 'spades'), 70, 86, beat >= 2)}
            {beat > 0 && <LockKey className="lesson-lock" />}
            <span className="lesson-scene-caption">
              {beat >= 2
                ? tied
                  ? '3 = 3. The caller loses the tie; the opponent wins.'
                  : '3 < 8. The caller wins outright.'
                : beat
                  ? 'Everyone else gets one final turn.'
                  : 'Call before drawing. Swaps cannot touch your hand.'}
            </span>
          </>
        )}
        {kind === 7 && (
          <>
            <span className="lesson-table-label">Snap Rule · Mathbo</span>
            {tile('source', sample('6', 'hearts'), 24, 62, true)}
            {tile('target', sample('9', 'clubs'), 76, 62, true)}
            <span className="lesson-equals">=</span>
            <span className="lesson-math-equation">
              {expression.replaceAll('*', ' × ').replaceAll('/', ' ÷ ')} = 9
            </span>
            <span className="lesson-scene-caption">
              Use the revealed 6 to make the discard’s 9.
            </span>
          </>
        )}
      </div>
      <div className="lesson-demo-controls">
        {kind === 0 ? (
          <button className="lesson-replay" onClick={() => setChosen([])}>
            <ArrowClockwise />
            Return cards & try again
          </button>
        ) : kind === 7 ? (
          <>
            <span className="lesson-try-label">Try an expression</span>
            <div className="lesson-expressions">
              {['6+(6/2)', '6+3', '(6/6)*9', '6^0*9'].map((text) => (
                <button
                  key={text}
                  aria-pressed={expression === text}
                  onClick={() => setExpression(text)}
                >
                  {text.replaceAll('*', '×').replaceAll('/', '÷')}
                </button>
              ))}
            </div>
            <p className={`lesson-feedback ${valid ? 'is-valid' : ''}`} role="status">
              {valid ? <Check /> : <X />}
              {feedback}
            </p>
          </>
        ) : (
          <>
            <div className="lesson-demo-buttons">
              {kind === 2 && (
                <button
                  className="lesson-replay"
                  onClick={() => {
                    setSpy(!spy);
                    setRun(run + 1);
                  }}
                >
                  {spy ? '9 / 10 · Spy' : '7 / 8 · Peek'}
                </button>
              )}
              {(kind === 4 || kind === 5) && (
                <button
                  className="lesson-replay"
                  aria-pressed={wrong}
                  onClick={() => {
                    setWrong(!wrong);
                    setRun(run + 1);
                  }}
                >
                  {wrong ? 'Try a correct snap' : 'Try a wrong snap'}
                </button>
              )}
              {kind === 6 && (
                <button
                  className="lesson-replay"
                  aria-pressed={tied}
                  onClick={() => {
                    setTied(!tied);
                    setRun(run + 1);
                  }}
                >
                  {tied ? 'Show a win' : 'What if scores tie?'}
                </button>
              )}
              {replay(kind === 6 ? 'Call CABO' : 'Watch it play')}
            </div>
            <p className="lesson-demo-hint">
              {reduce
                ? 'Reduced motion is on. Examples still show every step.'
                : 'Replay any example. These cards are just for practice.'}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
