# Cabo visual refresh

The current 8-bit presentation is documented in [retro-design.md](retro-design.md). This document records the earlier card-club refresh and the game layout and animation foundations it established.

## Direction

A private card-game club for friends, built around the tactile objects of play. Keep the established green and brass identity, but replace generic interface decoration with an actual deck, engraved sleeves, photographic artwork, and woven felt.

Design variance 6, motion intensity 5, visual density 4. Native CSS and existing Motion/Phosphor components; no unrelated component framework. Motion explains game actions and respects reduced-motion preferences.

## Audit

- Existing palette: forest #0c201c, raised green #142d26, ivory #f2efdf, brass #d5b67b.
- Existing type: self-hosted DM Sans; retain the family and establish a stronger display scale.
- Flow: welcome → create/join/practice → waiting room → live board → results. Keep routes, form identifiers, rules, sound toggle, themes, and multiplayer behavior.
- Preserve card flights, private peeks, public reveals, buzzer state, hand recentering, responsive controls, and the Mathbo keypad.
- Retire repeated eyebrows, mottos, fake CSS card faces, nested panel borders, and the oversized inflated oval table rail.
- The single-page route remains in place. Browser title is simply Cabo; generated green-and-brass artwork supplies browser and home-screen icons.

## Tokens and layout

Pine #12251f; panel #1b3029; felt #284e40; sage #a8b9a6; ivory #f0efe5; brass #c9af79. Dark and light shells share the same green game surface. Inputs/buttons have 8px corners; content panels 16px; cards 5px. Use quiet separators where structure is needed.

DM Sans 700 for the game title, 600 for actions, 400/500 for supporting text. No decorative serif, neon, or constantly moving backgrounds.

Desktop welcome:

```text
wordmark                            rules / sound / theme
┌──────────────────────────────┬───────────────────────┐
│                              │ Create / Join         │
│ photographic table artwork   │ Name                  │
│                              │ Start / Practice      │
│ Cabo                         │                       │
│ Four hidden cards.           │ Gold rules button     │
└──────────────────────────────────────────────────────┘
```

Waiting room: a compact heading, seating around a felt surface, and a clean settings column. The invite code is useful and prominent. On phones, retain explicit Players/Settings tabs so controls fit the screen.

Board: a fine fabric surface with a dark stitched edge, readable seat nameplates, crisp SVG faces, engraved backs, clear draw/discard areas, and a grounded action bar. Game feedback takes precedence over decorative art.

## Review against the brief

The character comes from card artwork and physical table materials, rather than generic marketing cards or a decorative gradient. The artwork is the welcome screen's single focal point; play remains visually quiet. All interactive controls stay real HTML and all game card faces preserve the supplied deck artwork.

## Assets

- `public/cards/SVG-cards-1.3/`: complete user-supplied collection copied from Downloads, with original filenames/metadata.
- `public/art/table-evening.webp`: generated photographic welcome artwork.
- `public/art/pine-felt.webp`: generated fabric surface for board and waiting room.
- `public/art/engraved-sleeve.webp`: generated sleeve used by the shared card component and every movement.
- PNG source artwork is retained alongside optimized WebP assets.

Generation used the built-in image tool. See `artwork-prompts.md` for exact prompts.

## Game canvas and field guide

The live table uses the whole viewport, with no website navbar. A small session HUD sits at the top; the bottom control tray explains the turn and holds actions. Action announcements occupy their own strip above the player areas, rather than covering the deck. CABO's locked-hand reminder has a reserved line below that strip.

Card dimensions adapt to the space: 88×128 from 1366×800 when the visible hands fit, 80×116 on smaller desktops from 1200×740, 68×99 on laptops from 1100×700, 60×87 on narrower desktops, 52×74 normally, and 36×52 on short phones and landscape. Larger sizes also apply to private peek desks. Short desktop layouts use tighter table spacing to preserve the action strip and controls. Crowded hands retain the smaller sizing when needed to fit. Flight coordinates use the same dimensions. Hands center their final row; larger hands wrap without a carousel. Narrow screens page opponent seats and follow the relevant player. Short landscape screens place opponents, piles, and your hand in three columns. Controls remain inside the viewport.

The rules are an interactive field guide: numbered lesson navigation, a tactile miniature table, and complete house-rule text. Opening cards can be clicked; replacements, powers, snaps, and CABO have replay controls. Mathbo examples use the same expression checker as the game, including addition/subtraction restrictions, zero exponents, and identity cancellation. Examples are isolated from live game state. Motion respects the system preference, and each animation has a readable final state.

Waiting-room terminology is **Snap Rule**, with **Matching ranks** and **Mathbo**. The underlying stored settings remain compatible with existing rooms. All J/Q/K cards use the supplied illustrated `2.svg` variants. Red kings have no score overlay.

## Card rendering performance

The original illustrated court SVGs range up to 1.1 MB per card. `scripts/prepare-cards.mjs` creates lossless 334×486 WebP faces from the supplied files, retaining their artwork, original colors, and court variants. All 52 served faces total about 1,981 KB versus 8,022 KB for the corresponding SVGs (75% smaller). Source SVGs remain intact. The waiting room preloads/decodes these public assets at low priority; no hidden game values are involved.

Flights and replacements are memoized by their server event identity and dimensions. Replacement faces still turn down at the intended time. Cards mount in their current face orientation instead of playing an extra flip when a flight starts. Hand slots handle recentering without a second transform on the hand container, and layout measurements depend on hand changes instead of the 100 ms clock. Small face separation and backface visibility keep the two printed sides stable during 3D flips.

Private peeks and public reveals use explicit persistent viewport flights, rather than reparenting cards between shared-layout containers. An invisible placeholder preserves both hand and desk geometry. The same card instance travels out, flips only for authorized viewers, turns down, and returns before its source slot is restored. Observers receive no hidden face artwork. Opening peeks cannot interrupt the deal. A one-second server settle interval protects returning cards from a premature swap. Mathbo's expression-to-gift transition preserves the public view identity; the subsequent snap/gift movement takes ownership from its actual screen position. See `animation-audit.md` for verification details.

The welcome screen now contains only the hero and play form; the mode preview strip has been removed. Learn the rules is a full-width gold button beside the practice action in short landscape views and below it elsewhere. Leave table is filled red with white text. The decorative 2/4 opening-peek graphic has been removed from waiting-room settings.

Each player chooses their own deck from Your deck in the waiting-room Table settings. This control sits outside the host-only rule fieldset, so guests can use it too. In-game options retain Customize deck. The supplied BASIC deck is served from its unchanged numbered PNGs as 8-bit theme. Numbered-file config maps its ranks and suits without renaming or conversion. On desktop, your hand can show up to eight cards in one centered row; larger hands and phone hands still wrap.
