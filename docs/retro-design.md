# Cabo: pine-and-gold arcade

## Direction and audit

An overhaul of the visual language with the existing game structure preserved. The previous interface used DM Sans, photographic felt, engraved sleeves, rounded panels, and soft shadows. The new direction is a quiet 1980s card game: pixel lettering, hard shadows, square controls, stepped card corners, and a dithered green playfield.

Design variance 6, motion intensity 4, visual density 4. Native CSS, existing Motion animations, and the existing Phosphor icon family. No new component framework. The single route, room settings, rules, multiplayer behavior, card sizes, and animation timing remain in place. Card movement stays smooth to make each action readable.

## Palette and type

The existing palette is retained: pine `#12251f`, panels `#1b3029`, felt `#284e40`, sage `#a8b9a6`, ivory `#f0efe5`, and gold `#c9af79`. Both interface themes use these established tokens. Gold rules buttons stay gold in light mode; destructive leave buttons stay filled red with white text.

[Pixelify Sans](https://github.com/google/fonts/tree/main/ofl/pixelifysans) supplies readable interface text. [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p) supplies the wordmark, welcome title, room codes, and timer. Fonts and their SIL Open Font License files are in `public/fonts/`, loaded with `next/font/local`; the browser makes no font-provider requests.

## Shared styling and artwork

- `app/retro.css` owns the retro styling. `app/design.css` continues to own game geometry and responsive layout.
- `public/art/pixel-court.png` is the generated court-card welcome illustration; `pixel-court.webp` is its lossless web asset. A detailed pixel king and layered green-and-gold card backs sit against a quiet pine-green field. The artwork is contained rather than cropped, and its phone placement reserves room for real HTML text. See `artwork-prompts.md` for the generation brief.
- `public/art/pixel-felt.svg` is a small repeating, low-contrast dither tile. It replaces photographic texture on the lobby, board, and practice examples.
- `public/art/pixel-spade-sleeve.webp` is the shared, generated pixel-art card back: a clear gold spade, a simple gold border, four small corner ornaments, and ample pine-green space. It stays legible and quiet across a full hand at small sizes. The full-resolution PNG is preserved beside the optimized web asset. Original face artwork is unchanged.
- The 8-bit deck is the default for new visitors. Saved deck choices remain personal and are preserved.

All card faces and backs use one two-pixel stair-step corner mask, including the deck gallery, settings thumbnail, custom themes, private peeks, public reveals, replacements, and card flights. Masks are applied to individual printed faces rather than the 3D flip container, preserving backface visibility. The original deck images remain untouched. New themes inherit the same corners automatically.

Focus indicators remain visible; dialog backgrounds are solid rather than blurred. All controls remain native HTML. Reduced-motion preferences still apply, including a static buzzer state. There are no animated CRT overlays or flickering backgrounds.

## Local verification

Checked the home page, waiting room, card gallery, interactive rules, Mathbo keypad, and table. Desktop checks include 1280×720; phone checks include 390×844, 320×568, and 568×320 landscape. Small layouts retain every main control without page scrolling. The short-phone Mathbo dialog fits within its viewport without internal scrolling. The desktop action dock stays 84px high and clear of the player nameplate.

Live checks included dealing, private peeks, custom card faces, the snap buzzer, a valid Mathbo expression, and the resulting discard/recentering. The full game test suite and production build also pass.

Results use a large gold winner heading above the hands, with a score underneath. It fades in after the card flip, or appears immediately with reduced motion. A resize observer reserves the actual heading height, so long names and shared wins wrap without hiding the cards. Compact screens omit the redundant round-complete label to keep player paging controls on one line.
