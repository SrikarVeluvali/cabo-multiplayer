# Animation audit

Verified locally on 16 October 2026. Screenshots document the current source build; this audit does not claim a production deployment or an FPS benchmark.

## Viewing cards

Private peeks and public reveals use one persistent `ViewMotion` instance per card/view. An invisible slot preserves the original hand geometry while the card travels to the viewing desk. The same instance flips down and returns before the slot is restored. A changing poll, countdown, or Mathbo gift deadline cannot create a second flight.

The viewing state retains only faces already authorized in that seat's snapshot. Observers animate backs, without front artwork. New rounds, results, transfers, and explicit discard/snap movements release the old view instead of resurrecting it. Public reveal handoffs continue from the card's actual screen position, including an interrupted outward flight.

Opening views wait for the deal to finish. The server reserves one second for opening/power cards to return before accepting the next swap/turn action. Reduced-motion users see the desk directly and do not wait for a retained return animation.

## Checked interactions

| Interaction                    | Verification                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening deal and opening peeks | Fresh browser deal; automated check that bot-selected peeks wait for dealing; stable identity when the second card is selected; timeout return retention.                         |
| 7/8 own peek                   | Browser automatic return with distinct intermediate positions; no remaining flight after landing.                                                                                 |
| 9/10 spy                       | Browser outward and early-return trajectories; original opponent slot restored. Repeated on a 390×844 phone viewport with no page overflow.                                       |
| Black king two-card peek       | Browser two simultaneous views and two returns to different owners' slots.                                                                                                        |
| Private observer view          | Browser flight contains no face artwork and remains face down. Unit tests also compare authorized and observer snapshots.                                                         |
| Queen/king optional swap       | Browser return then blind swap; server rejects a premature swap during the return. Optional/skip paths and bot decisions covered by rules tests.                                  |
| Blind swap                     | Browser two back-only flights, one start, no replay after settling.                                                                                                               |
| Draw and discard               | Browser draw node and explicit discard flight. Draw travel is implemented by the existing deck-to-slot animation; timing samples captured its tail rather than a full trajectory. |
| Replacement                    | Browser separate outgoing discard and incoming draw flights with the supplied artwork and correct face states.                                                                    |
| Correct own snap               | Browser single drop flight; source hand retained through travel; remaining three cards centered exactly after settling.                                                           |
| Correct opponent snap          | Browser original red face; one public-card flight to discard plus a hidden gift flight into the opponent slot.                                                                    |
| Wrong snap and penalty         | Browser public reveal plus one face-down penalty flight; five-card hand. Rules tests and API smoke cover five-second reveal expiry and exactly one penalty.                       |
| Mathbo expression → gift       | Browser public view ID and desk position remain unchanged after a valid `6+(6/2)=9` submission. Gift follows with two flights, one face up and one hidden.                        |
| Mathbo failures/timeouts       | Two-seat API smoke checks invalid equation, public reveal, hidden penalty, and simultaneous timeout polls producing only one penalty.                                             |
| CABO, scoring, deck exhaustion | Rules tests and two-seat API smoke cover locked hands, final turns, results, strict caller scoring, ties, and last-card resolution.                                               |
| Countdown/poll rerenders       | Memoized flight components and stable event IDs; automated viewing-state and announcement-duration checks.                                                                        |
| Reduced motion                 | Automated view-state test skips retained return; card/flight transitions read the system preference.                                                                              |

Desktop screenshot checks used 1440×900; the welcome screen was also captured at 1280×720. Responsive checks include 390×844, 320×568, and short landscape 568×320. Earlier layout checks covered seven-card hands; the current phone spy check confirms the new viewing motion remains inside the viewport. Full games with more seats still use the existing opponent paging.

## Validation

- `npm test`: 183 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, including icon routes.
- `npm run test:integration`: passed against the local running server.
- `npm run test:mathbo`: passed against the local running server.
- README screenshots captured from the actual running UI and visually inspected.

A transient Windows destination-file sharing error appeared in the storage concurrency check. Local atomic renames now retry bounded sharing errors while retaining the room queue; failed temporary files are cleaned up. The full concurrency check passes with this handling.
