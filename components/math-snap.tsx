'use client';
import { useEffect, useRef, useState } from 'react';
import { Backspace, Calculator, Check } from '@phosphor-icons/react';
import { evaluateMathbo } from '@/lib/mathbo';
import type { PublicRoom } from '@/lib/types';
import type { OnAction } from './cabo';

const keys = [
  '7',
  '8',
  '9',
  '÷',
  '(',
  ')',
  '4',
  '5',
  '6',
  '×',
  '^',
  '!',
  '1',
  '2',
  '3',
  '+',
  '−',
  '.',
  '0',
  ',',
  'log2',
  'log10',
  'nCr',
  'nPr',
  'card',
  'sqrt',
  'abs',
  'clear',
  'back',
];
const operationHelp: Record<string, string> = {
  '^': 'Raise the expression to a nonzero power',
  '!': 'Factorial of the expression',
  log2: 'Logarithm, base 2',
  log10: 'Logarithm, base 10',
  nCr: 'Combinations: choose r items from n',
  nPr: 'Permutations: arrange r items from n',
  sqrt: 'Square root',
  abs: 'Absolute value',
};
export default function MathSnap({
  room,
  now,
  busy,
  onAction,
}: {
  room: PublicRoom;
  now: number;
  busy: boolean;
  onAction: OnAction;
}) {
  const snap = room.snap!;
  const challenge = snap.math!;
  const [expression, setExpression] = useState(String(challenge.source));
  const ref = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    input.current?.setSelectionRange(
      String(challenge.source).length,
      String(challenge.source).length,
    );
    // Keep the phone's numeric/scientific keypad visible without opening its keyboard.
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus();
    return () => dialog?.close();
  }, []);
  const seconds = Math.max(0, Math.ceil((snap.deadline - now) / 1000));
  const expired = seconds === 0;
  let result: number | undefined,
    error = '';
  try {
    result = evaluateMathbo(expression, challenge.source);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Complete your expression.';
  }
  const matches =
    result !== undefined &&
    Math.abs(result - challenge.target) <= 1e-9 * Math.max(1, Math.abs(challenge.target));
  const owner = room.players.find((p) => p.id === snap.target?.playerId)!;
  const slot = owner.cards.findIndex((c) => c.id === snap.target?.cardId) + 1;
  function edit(key: string) {
    const start = input.current?.selectionStart ?? expression.length;
    const end = input.current?.selectionEnd ?? expression.length;
    let text = key === 'card' ? String(challenge.source) : key;
    if (key === 'clear') {
      setExpression('');
      return;
    }
    let before = expression.slice(0, start),
      after = expression.slice(end);
    let cursor: number | undefined;
    if (['log2', 'log10', 'nCr', 'nPr', 'sqrt', 'abs', '!', '^'].includes(key)) {
      let content = expression.slice(start, end);
      // Function tiles act on the selection, or wrap the whole expression.
      if (!content && start === expression.length && !/[+−\-×÷*/^(,]\s*$/.test(before)) {
        content = expression;
        before = '';
        after = '';
      }
      if (key === '!') text = content ? `(${content})!` : '!';
      else if (key === '^') text = content ? `(${content})^` : '^';
      else if (key === 'nCr' || key === 'nPr') {
        text = `${key}(${content},)`;
        cursor = before.length + text.length - (content ? 1 : 2);
      } else {
        text = `${key}(${content})`;
        cursor = before.length + text.length - (content ? 0 : 1);
      }
    }
    if (key === 'back') {
      if (start === end) before = before.slice(0, -1);
      text = '';
    }
    const next = before + text + after;
    if (next.length > 160) return;
    setExpression(next);
    requestAnimationFrame(() => {
      const position = cursor ?? before.length + text.length;
      input.current?.setSelectionRange(position, position);
    });
  }
  function submit(text = expression) {
    if (busy || expired) return;
    void onAction({ type: 'math-submit', challengeId: challenge.id, expression: text });
  }
  return (
    <dialog
      ref={ref}
      className="mathbo-dialog"
      aria-labelledby="mathbo-title"
      onCancel={(e) => e.preventDefault()}
    >
      <div className="mathbo-heading">
        <div>
          <span>
            <Calculator /> Mathbo
          </span>
          <h2 id="mathbo-title">Make the match.</h2>
        </div>
        <div
          className={`mathbo-timer ${seconds <= 5 ? 'urgent' : ''}`}
          role="timer"
          aria-label={`${seconds} seconds remaining`}
        >
          {seconds}
          <small>seconds</small>
        </div>
      </div>
      <p className="mathbo-owner">
        {owner.id === room.you ? 'Your' : `${owner.name}’s`} card {slot} is revealed to everyone.
      </p>
      <div className="mathbo-values">
        <span>
          Selected card <strong>{challenge.source}</strong>
        </span>
        <span>
          Discard target <strong>{challenge.target}</strong>
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="mathbo-expression">
          Your expression · LHS
          <div>
            <input
              ref={input}
              value={expression}
              maxLength={160}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy || expired}
              onChange={(e) => setExpression(e.target.value)}
              aria-label="Mathbo expression"
            />
            <b>= {challenge.target}</b>
          </div>
        </label>
        <p className={`mathbo-preview ${matches ? 'matches' : ''}`} aria-live="polite">
          {expired ? (
            'Time is up. Resolving the table…'
          ) : matches ? (
            <>
              <Check /> Equal! Ready to snap.
            </>
          ) : result !== undefined ? (
            `Result: ${Number(result.toPrecision(10))}. Make it equal ${challenge.target}.`
          ) : (
            error
          )}
        </p>
        <div className="mathbo-keys" aria-label="Math keypad">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              title={operationHelp[key]}
              disabled={busy || expired}
              onClick={() => edit(key)}
              onPointerDown={(e) => e.preventDefault()}
              aria-label={
                key === 'back'
                  ? 'Backspace'
                  : key === 'clear'
                    ? 'Clear expression'
                    : key === 'card'
                      ? 'Insert selected card number'
                      : key
              }
            >
              {key === 'back' ? (
                <Backspace />
              ) : key === 'card' ? (
                `Card ${challenge.source}`
              ) : key === 'clear' ? (
                'Clear'
              ) : key === 'log2' ? (
                'log₂'
              ) : key === 'log10' ? (
                'log₁₀'
              ) : key === 'sqrt' ? (
                '√'
              ) : key === 'abs' ? (
                '|x|'
              ) : (
                key
              )}
            </button>
          ))}
        </div>
        <p className="mathbo-rule">
          Both sides of every + / − must contain <b>{challenge.source}</b>. Other operations can use
          extra numbers. No zero exponents or ×1 / ÷1 cancellation tricks.
        </p>
        <div className="mathbo-footer">
          <button
            type="button"
            className="text-button"
            disabled={busy || expired}
            onClick={() => submit('')}
          >
            Take penalty
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || expired || !expression.trim()}
          >
            {busy ? 'Checking…' : 'Submit snap'} <Check />
          </button>
        </div>
        <p className="mathbo-penalty">
          A wrong submission or timeout gives you one hidden penalty card.
        </p>
      </form>
    </dialog>
  );
}
