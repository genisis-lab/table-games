# Table Games

Table Games is a deploy-ready browser board-game platform built with React,
TypeScript, Vite, Cloudflare Workers, and Durable Objects.

The current shelf includes:

- Four in a Row
- Tic Tac Toe
- Gomoku
- Ultimate Tic Tac Toe
- Dots and Boxes
- Reversi
- Checkers
- Chess
- Sea Battle bot mode
- Mancala
- Hex
- Nine Men's Morris
- Color Clash
- Darts
- Word Hunt
- Cup Pong
- Dominoes
- Order & Chaos
- Memory Match
- Quoridor
- Dice Duel
- Set Trio
- Pipe Dash
- 2048
- Favorites, recent-play shortcuts, category/search filters, and Surprise Table
- Invite links for friend rooms
- Bot rooms with Casual, Sharp, and Ruthless modes
- Live chat
- Full-screen reaction bursts
- Ready/waiting lifecycle, reconnect recovery, rematch voting, and game switching
- Board-size rule variants for Tic Tac Toe-style games and Dots and Boxes
- Rules cards, move history, undo requests, rematch voting, and spectator seat claiming

## Development

```bash
npm install
npm run dev
```

Rooms use guest identity from local storage. No auth or database provider is wired in
yet, so match history, leaderboards, admin tools, and saved profiles are future hooks
rather than required environment variables.

## Multiplayer

Cloudflare Durable Objects own each room. The client sends intents such as join,
make move, chat, reaction, rematch, game switch, board variant, bot difficulty, and
bot-start toggles. The Durable Object validates origins, runtime message shapes,
payload sizes, rate limits, private seat credentials, expected revisions, and
idempotent command IDs before storing state and broadcasting snapshots over
WebSockets. Private card/tile data is masked per viewer, while reconnect leases
protect a temporarily disconnected seat.

## Arcade ports

- **Chess** uses a typed, server-authoritative engine with complete legal move
  generation, check/checkmate, castling, en passant, four promotion choices,
  stalemate, threefold repetition, the 50-move rule, insufficient-material draws,
  deterministic bot play, FEN fixtures, and perft regression tests.
- **Set Trio** uses the canonical 81-card feature deck. Three-card claims are
  atomic in friend rooms; the first valid server arrival scores, stale revisions
  are rejected, and invalid claims receive an authoritative penalty and cooldown.

## Dominoes

Dominoes is implemented as a pure engine under `src/games/domino/engine` and then
adapted into the shared Table Games room shell.

- Standard double-six set, four seats, seven tiles per player.
- `Teams 100`: partnership mode with seats 1+3 vs 2+4.
- `FFA 100`: free-for-all scoring.
- `Teams 150`: longer partnership match.
- Block table rules by default. Players may pass only when they have no legal tile.
- Rounds score remaining opponent pips. A new round is dealt automatically until a
  player/team reaches the target score.
- Opponent hands and hidden pip counts are masked in snapshots. Viewers only see
  their own tiles, public tile counts, public scores, board chain, logs, and round
  summaries.
- Bot modes map to the site modes: Casual plays the first legal tile, Sharp favors
  high-pip reduction and simple blocking, and Ruthless also considers passed
  numbers, next-player pressure, and partner-friendly ends.

## Verification

```bash
npm test
npm run test:worker
npm run build
npm run types
npm run check
```

GitHub Actions repeats engine/UI tests, the Durable Object dual-client suite, and
the production build on every main-branch push and pull request.

## Deployment

Deploy the full Worker app:

```bash
npm run deploy
```

For a static Pages frontend that talks to a deployed Worker backend, build with:

```bash
VITE_API_ORIGIN=https://your-worker.example.workers.dev npm run build
```

Then upload `dist/client` to Cloudflare Pages with SPA fallback routing.
