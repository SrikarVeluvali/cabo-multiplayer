# Cabo

A private multiplayer Cabo table by Srikar Veluvali, built with Next.js, React, TypeScript, and Motion. The forest-green felt, brass controls, self-hosted DM Sans, private-room flow, and Redis architecture follow the companion BlackJack game.

![Cabo’s animated multiplayer table](docs/screenshots/table-desktop.jpg)

## Run it

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Enter a name and create a table. Invite friends with its six-character room code or invite link. Each guest marks themselves ready; the host deals. To try it alone, choose **Practice with computers**. The host can add up to three computer players, with six total seats.

Another browser tab can take another seat. Seats use session storage, so refreshing the same tab reconnects. Duplicating a tab may copy its existing seat; open a fresh tab at the base URL for another player. Friends on your LAN can use your machine’s LAN address and port, provided the firewall permits it.

## The rules at this table

These are the requested rules, with the following explicit house decisions. The same rules are accessible in the app.

- One shuffled 52-card deck; no jokers. Four face-down cards per player. Seats keep their positions as cards move. The first player rotates each round.
- The animated deal takes two seconds. Then all players have **15 seconds** to choose up to two of their own cards. Their chosen cards stay visible for the remainder of that shared window. Unused peeks expire. Opening cards are hidden again when play begins.
- Goal: the lowest sum. A = 1; 2–10 use face value; J = 11; Q = 12; black K = 13; red K = −1. An empty hand totals zero.
- At the start of your turn, draw privately from the deck, or call CABO. A drawn card can be discarded, used to replace any one of your own cards (the old card is discarded), or discarded to activate its power. Only freshly drawn cards activate powers. You cannot draw from the discard pile.
- 7/8: look at one of your own cards. 9/10: look at one opponent card. J: optionally blind-swap any two different cards on the table, including two cards in the same hand. Q: optionally look at one card anywhere, then optionally swap any two. Black K: optionally look at two different cards anywhere, then optionally swap any two. Red K has no played power.
- Looking and swapping are independent steps. For Q/black K you may look and skip swapping, or skip looking and still swap. Power peeks last up to five seconds. Cards travel to the acting player’s desk with their original slots marked, then return before the swap step. Only the acting player receives their faces; observers see the backs.
- **Snap buzzer:** the first press accepted by the server reserves the table for eight seconds to choose a card. Ordinary moves and the main turn clock pause. One buzzer attempt per player per top discard. A correct snap from your own hand removes that card; powers do not activate. All kings match each other. An eight-second timeout adds a hidden penalty card.
- **Opponent snaps:** after winning the buzzer, you may choose an unlocked opponent card. A correct match leads to a second eight-second step to choose a hidden card from your hand to give them. The matched card goes to the discard and the given card fills its original slot. If the gift step expires, one of your cards is chosen at random. Empty hands cannot offer a card.
- An incorrect snap keeps the attempted card in its slot, gives only the snapper one random unseen penalty card, and reveals the attempted card to everyone for exactly five seconds. The public reveal appears at the table center even if its owner is on another player page. Play pauses for the reveal, then the card returns face down.
- Cards settle before another action is accepted. A turn ends with an opportunity to hit the buzzer: three seconds in relaxed mode, 1.8 seconds in quick mode. Resolving a snap restarts this window. Buzzers also work during other settled moves, including another player’s turn and power steps. The server rejects stale discard targets without a penalty.
- **CABO:** called before drawing, using that turn. The caller’s hand becomes locked against swaps and opponent-snap transfers. It can still be looked at with a power, and the caller may snap their own cards. Everyone else then gets exactly one last turn. After the final snap window, all cards reveal. The caller wins only with a strictly lower score than everyone else. If the caller ties or is beaten, all _other_ players sharing the actual lowest score win. Round wins are tracked across rematches.
- Turns have a host-selected 30/45/60/90-second limit. A timeout discards any held draw without a power and passes the turn. Closing a tab keeps that player’s seat and turns time out. Reopen in the same tab to reconnect. An active human inherits hosting if the host has been absent for a minute.
- If the draw deck runs out before CABO, the final drawn card and any power are resolved, then the round ends automatically after the cards settle. The lowest score wins; ties share the win. After CABO, discards can refill the deck to complete the promised final turns. If no card can be drawn or dealt as a penalty, the round ends with scoring. There is no automatic win just for emptying a hand; call CABO when ready.

## Host it

### A persistent Node.js server

```sh
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0:3000`. Configure `PORT` for another port. Put it behind HTTPS on your hosting provider. Without Redis, room snapshots live in `.data/rooms/`; use one Node.js process and a persistent writable disk. This local fallback serializes operations inside that process, not across processes.

### Vercel

1. Import this repository as a Next.js project. The included configuration chooses the Mumbai function region and Node.js 22 is declared in `package.json`.
2. Connect an Upstash Redis database near the function region. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Use a REST write token, kept server-side. See `.env.example`; never commit `.env.local`.
3. Deploy. Vercel requires shared Redis storage; the app returns a clear error if it is missing. Configure credentials separately for Preview and Production, and redeploy after changes.

Cabo defaults to `cabo:<VERCEL_ENV or development>:room:` Redis keys, so it can share a database with BlackJack without mixing rooms. To isolate specific installations or previews, set `ROOM_STORE_PREFIX`. Rooms expire after 24 hours without game activity. Unchanged polls do not extend room lifetime. Idle local files are rejected after expiry but are not automatically deleted from disk.

The app is ready for these hosting options; no public deployment or database has been created by this repository itself.

## Multiplayer and privacy

The server owns all cards, turn validation, timers, scoring, randomness, and visibility. Public snapshots exclude the deck, seat credentials, bot memory, and hidden card faces. Card IDs are random UUIDs with no rank or suit encoded. Opening and power peeks are delivered only to the authorized player. A private draw is sent only to the current player. Local UI timers hide peeks at expiry even while reconnecting. As in an in-person memory game, players can write down or screenshot cards they were legitimately shown.

Clients poll the Next.js room API approximately every 650 ms while visible and every three seconds in the background. Timers and bots advance when requests arrive; there is no separate socket server or scheduled worker. If every client closes, the next request resumes processing expired timers. Actions use movement locks and stale state checks; replacements reserve three seconds for the old-card discard and incoming-card animation. Redis compares the entire prior snapshot using atomic Lua compare-and-set, retrying conflicting actions so concurrent snaps or turns cannot overwrite one another. Redis polling consumes provider requests; choose a plan suitable for your player count.

Computers only use opening memories, their draws, and powers they have played. They do not inspect hidden opponent cards to choose moves. They eventually call CABO so practice rounds finish. Browser tabs hold unguessable seat tokens in session storage; a room code grants joining a lobby, not inspection of existing seats. This is a private casual game without accounts, public matchmaking, or an abuse-prevention service.

## Motion and accessibility

Cards share layout identities across hands, desks, the draw area, and the discard pile. Deal and penalty cards travel from the deck; draws, discards, snaps, and swaps use position transitions. Replacements first send the old card to discard, then move the draw into its original slot. Remaining cards slide into centered rows after a snap. Peeks travel to a private desk and return to their marked slots. Wrong snaps show the attempted card at the center for everyone. Discards, blind swaps, snap drops, opponent gifts, and hidden penalties carry explicit server-authored movement paths. Vacated slots remain in place until the flight ends, then the remaining cards recenter. The buzzer holder’s nameplate pulses red; reduced-motion mode keeps a steady red highlight instead.

The waiting room follows BlackJack’s six-seat guest list, invite footer, house-settings panel, and persistent leave/ready/start dock. The app fills the viewport without page scrolling. Player pages, centered wrapping hands, mobile lounge tabs, paged rules, and a scrollable activity log keep cards and controls at readable sizes across desktop, portrait phones, and short landscape screens. Player pages follow the active seat. Numbered positions, a contextual action dock, countdowns, a last-action line, reduced-motion support, both themes, keyboard focus, and native dialogs are included.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run format:check
# With the app running in another terminal:
npm run test:integration
```

Set `TEST_URL` if the server uses another origin. The integration script creates two temporary player sessions, verifies private peeks and draws, races competing buzzers, attempts an opponent snap, replaces a card, calls CABO, completes final turns, checks revealed scores, and leaves both seats. Tests cover targeting, optional powers, ties, snap transfers and penalties, the five-second public reveal, CABO hand protection, timeouts, recycling, full bot games, and concurrent snapshot writes. A GitHub Actions workflow runs the checks and the production API smoke test.

Sound effects are synthesized locally for cards, swaps, snaps, buzzer claims, penalties, CABO, and round results. The speaker control in the header mutes immediately and remembers the preference on that device. Audio starts after a player interacts with the page; background tabs stay quiet.

Fonts are self-hosted DM Sans under the SIL Open Font License (`public/fonts/OFL.txt`). Source is `UNLICENSED`.
