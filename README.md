# Table Sparks

Table Sparks is a deploy-ready browser board-game platform built with React,
TypeScript, Vite, Cloudflare Workers, and Durable Objects.

V1 includes:

- Four in a Row
- Tic Tac Toe
- Gomoku
- Ultimate Tic Tac Toe
- Dots and Boxes
- Reversi
- Checkers
- Battleship bot mode
- Mancala
- Hex
- Nine Men's Morris
- Invite links for friend rooms
- Bot rooms with Casual, Sharp, and Ruthless modes
- Live chat
- Full-screen reaction bursts
- Rematch and game switching
- Board-size rule variants for Tic Tac Toe-style games and Dots and Boxes
- Rules cards, move history, undo requests, rematch voting, and spectator seat claiming

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run test:worker
npm run build
npm run types
npm run check
```

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
