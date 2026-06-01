# Table Sparks

Table Sparks is a deploy-ready browser board-game platform built with React,
TypeScript, Vite, Cloudflare Workers, and Durable Objects.

V1 includes:

- Four in a Row
- Tic Tac Toe
- Gomoku
- Invite links for friend rooms
- Bot rooms with Casual, Sharp, and Ruthless modes
- Live chat
- Full-screen reaction bursts
- Rematch and game switching

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
