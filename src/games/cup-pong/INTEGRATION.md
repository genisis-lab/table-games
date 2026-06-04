# Cup Pong engine - integration into `src/shared/games.ts`

This module (`src/games/cup-pong/engine.ts`) owns all Cup Pong rules, mirroring
`src/games/domino/engine.ts`. Wiring it into `src/shared/games.ts` is a handful
of small, mechanical edits. After applying them, run:

```bash
npm install            # if you haven't refreshed deps
npm run check          # tsc typecheck
npm test               # vitest, includes the new engine.test.ts
```

> The new engine and its unit tests are fully self-contained and pass on their
> own. The edits below connect the existing dispatcher to the new module. They
> are intentionally tiny so they are easy to review and `npm run check` will
> catch any mismatch.

## 1. Add the import (top of the file, near the domino engine import)

```ts
import {
	applyCupPongIntent,
	chooseCupPongBotMove,
	createCupPongMeta as createCupPongTableMeta,
	getCupPongLegalMoves,
	normalizeCupPongMeta,
} from "../games/cup-pong/engine";
import type { CupPongMeta, CupPongPlayerMark } from "../games/cup-pong/engine";

export type { CupPongMeta } from "../games/cup-pong/engine";
```

## 2. Remove the old inline `CupPongMeta` interface

Delete the existing block (the type now lives in the engine and is re-exported
above):

```ts
export interface CupPongMeta {
	cups: Record<PlayerMark, boolean[]>;
	made: Record<PlayerMark, number>;
	streak: Record<PlayerMark, number>;
}
```

## 3. Add `power` / `aim` to `GameMove`

```ts
export interface GameMove {
	row?: number;
	column: number;
	toRow?: number;
	toColumn?: number;
	edge?: "h" | "v";
	word?: string;
	power?: number; // Cup Pong: throw power 0..1; omit for a guaranteed throw
	aim?: number;   // Cup Pong: lateral aim -1..1; omit for a guaranteed throw
}
```

## 4. Point `createMeta` at the engine factory

Change the Cup Pong branch in `createMeta`:

```ts
if (gameId === "cup-pong") return { cupPong: createCupPongTableMeta(variant) };
```

## 5. Replace the four inline Cup Pong functions with thin adapters

Delete the old inline `createCupPongMeta`, `applyCupPongMove`, `getCupPongMoves`,
and `chooseCupPongMove` and replace with:

```ts
function applyCupPongMove(state: GameState, player: PlayerMark, move: GameMove): MoveResult {
	const clonedMeta = cloneMeta(state);
	const meta = clonedMeta.cupPong;
	if (!meta) return { ok: false, state, reason: "The cups are not ready." };
	const result = applyCupPongIntent(normalizeCupPongMeta(meta), player as CupPongPlayerMark, move);
	if (!result.ok) return { ok: false, state, reason: result.reason };
	return {
		ok: true,
		point: result.point,
		state: {
			...state,
			turn: result.winner ? player : (result.nextTurn as PlayerMark),
			winner: result.winner as Winner,
			winningLine: [],
			moveCount: state.moveCount + 1,
			meta: { ...clonedMeta, cupPong: result.meta },
		},
	};
}

function getCupPongMoves(state: GameState, player: PlayerMark): GameMove[] {
	const meta = state.meta?.cupPong;
	if (!meta) return [];
	return getCupPongLegalMoves(normalizeCupPongMeta(meta), player as CupPongPlayerMark);
}

function chooseCupPongMove(
	state: GameState,
	player: PlayerMark,
	legalMoves: GameMove[],
	difficulty: BotDifficulty,
): GameMove {
	const meta = state.meta?.cupPong;
	if (!meta) return legalMoves[0];
	return chooseCupPongBotMove(
		normalizeCupPongMeta(meta),
		player as CupPongPlayerMark,
		legalMoves,
		difficulty,
	);
}
```

Notes:
* Adjust the adapter signatures to match your existing `MoveResult`,
  `GameState`, `BotDifficulty`, and `cloneMeta` shapes if they differ slightly.
* `boardScore`'s Cup Pong branch is unchanged: the new `CupPongMeta` still
  exposes `cups`, `made`, and `streak`.
* `getCupPongMoves` intentionally does NOT surface the re-rack move
  (`column === -1`), so bots never re-rack. Re-rack is driven from the UI.

## 6. Update the existing Cup Pong test in `src/shared/games.test.ts`

The old test assumed the turn passed after a single throw. With 2 balls per turn
the shooter keeps the turn after the first make. Replace it with:

```ts
it("removes targeted cups and keeps the turn until both balls are thrown in Cup Pong", () => {
	let state = play(createGameState("cup-pong"), "p1", { column: 0 });
	expect(state.meta?.cupPong?.cups.p2[0]).toBe(false);
	expect(state.meta?.cupPong?.made.p1).toBe(1);
	expect(state.turn).toBe("p1");
	expect(state.meta?.cupPong?.ballsRemaining).toBe(1);
	state = play(state, "p1", { column: 1 });
	expect(state.turn).toBe("p2");
});
```

## What Phase 1 delivers

* `power` (0..1) + `aim` (-1..1) on a throw, resolved deterministically from a
  seeded RNG stored on `meta.seed` (server-authoritative, replayable on every
  client from the snapshot). No `protocol.ts` change required.
* A bare `{ column }` throw is still a guaranteed make (backward compatible).
* 2 balls per turn; the shooter keeps the turn between balls.
* Re-rack at 6/4/3/2 cups (packs live cups to the front).
* Redemption: clearing the rack grants the opponent a redemption round instead
  of an instant win (full clear => draw; running out => original shooter wins).
* Difficulty-scaled bot accuracy (casual/sharp/ruthless wobble).
* `meta.lastThrow` carries the resolved shot for the renderer phases (2-6).
