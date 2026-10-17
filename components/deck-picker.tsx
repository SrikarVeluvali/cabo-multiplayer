'use client';
import { useEffect, useRef } from 'react';
import { Check, X } from '@phosphor-icons/react';
import { deckThemes } from '@/lib/deck-themes';
import { useDeckTheme } from './deck-theme';
import CardArtwork from './card-artwork';
import type { Rank, Suit } from '@/lib/types';

const preview: { rank: Rank; suit: Suit }[] = [
  { rank: 'J', suit: 'diamonds' },
  { rank: 'Q', suit: 'clubs' },
  { rank: 'K', suit: 'hearts' },
];
export default function DeckPicker({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { theme, select } = useDeckTheme();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="deck-dialog"
      aria-labelledby="deck-title"
      aria-describedby="deck-description"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="deck-dialog-heading">
        <div>
          <h2 id="deck-title">Your deck</h2>
          <p id="deck-description">Saved on this device. Applies to your view of the table.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close deck customization"
          onClick={onClose}
          autoFocus
        >
          <X />
        </button>
      </div>
      <fieldset className="deck-choices">
        <legend className="visually-hidden">Card theme</legend>
        {deckThemes.map((choice) => (
          <label
            className={`deck-choice ${choice.id === theme.id ? 'deck-choice-selected' : ''}`}
            key={choice.id}
          >
            <input
              type="radio"
              name="card-theme"
              aria-label={choice.name}
              value={choice.id}
              checked={theme.id === choice.id}
              onChange={() => select(choice.id)}
            />
            <span className="deck-choice-preview" aria-hidden="true">
              {preview.map((card) => (
                <span className="deck-preview-card" key={card.rank}>
                  <CardArtwork {...card} themeId={choice.id} />
                </span>
              ))}
            </span>
            <span className="deck-choice-copy">
              <strong>{choice.name}</strong>
              <span>{choice.description}</span>
            </span>
            <span className="deck-choice-mark" aria-hidden="true">
              {choice.id === theme.id && <Check weight="bold" />}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="deck-dialog-footer">
        <span>Changes apply instantly.</span>
        <button className="button primary" onClick={onClose}>
          Done
        </button>
      </div>
      {theme.credit && <p className="deck-credit">{theme.credit}</p>}
    </dialog>
  );
}
