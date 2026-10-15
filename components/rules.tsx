'use client';
import { X, ArrowRight, CaretLeft } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useViewport } from './use-viewport';
const lessons = [
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
      'A = 1 · 2–10 = face value · J = 11 · Q = 12 · Black K = 13 · Red K = −1. An empty hand scores zero.',
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
      ['Black K', 'Double look & swap', 'Look at two cards anywhere; optionally swap any two.'],
    ],
    paragraphs: [],
    note: 'Looking and swapping are separate. You may skip either step. Red K has no power.',
  },
  {
    title: 'Fast hands win the buzzer.',
    paragraphs: [
      'See a matching rank on the discard? Hit the snap buzzer. The first press accepted by the server reserves the table for that player.',
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
    note: 'Ranks must match. All kings match. CABO hands cannot take part in opponent-snap transfers.',
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
export default function Rules({ onClose }: { onClose: () => void }) {
  const size = useViewport();
  const pages =
    size.height < 500
      ? lessons.flatMap((l) => [
          ...l.paragraphs.map((p) => ({
            title: l.title,
            paragraphs: [p],
            powers: undefined as string[][] | undefined,
            note: '',
          })),
          ...(l.powers || []).map((p) => ({
            title: l.title,
            paragraphs: [] as string[],
            powers: [p],
            note: '',
          })),
          {
            title: l.title,
            paragraphs: [] as string[],
            powers: undefined as string[][] | undefined,
            note: l.note,
          },
        ])
      : lessons;
  const ref = useRef<HTMLDialogElement>(null),
    [page, setPage] = useState(0);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const active = Math.min(page, pages.length - 1),
    lesson = pages[active];
  return (
    <dialog ref={ref} className="rules-dialog" onCancel={onClose}>
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">A little memory. A little nerve.</span>
          <h2>How to play Cabo</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close rules">
          <X />
        </button>
      </div>
      <div className="rules-body">
        <div className="rule-page-indicator">
          {active + 1} / {pages.length}
        </div>
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
      <div className="dialog-footer">
        <button className="button secondary" disabled={!page} onClick={() => setPage(page - 1)}>
          <CaretLeft />
          Back
        </button>
        <span>
          {active + 1} of {pages.length}
        </span>
        <button
          className="button primary"
          onClick={() => (active === pages.length - 1 ? onClose() : setPage(active + 1))}
        >
          {active === pages.length - 1 ? 'Let’s play' : 'Next'}
          <ArrowRight />
        </button>
      </div>
    </dialog>
  );
}
