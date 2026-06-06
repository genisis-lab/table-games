import { describe, expect, it } from "vitest";

import {
	CUP_PONG_BALLS_PER_TURN,
	CUP_PONG_RERACK_MOVE,
	applyCupPongIntent,
	chooseCupPongBotMove,
	createCupPongMeta,
	getCupPongLegalMoves,
	type CupPongMeta,
} from "./engine";

function freshMeta(): CupPongMeta {
	// "classic" => 6 cups per side.
	return createCupPongMeta("classic");
}

describe("Cup Pong engine", () => {
	it("removes a targeted cup and keeps the turn until both balls are used", () => {
		const meta = freshMeta();
		const first = applyCupPongIntent(meta, "p1", { column: 0 });
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.meta.cups.p2[0]).toBe(false);
		expect(first.meta.made.p1).toBe(1);
		expect(first.meta.ballsRemaining).toBe(1);
		expect(first.nextTurn).toBe("p1");
		expect(first.winner).toBeNull();

		const second = applyCupPongIntent(first.meta, "p1", { column: 1 });
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.nextTurn).toBe("p2");
		expect(second.meta.ballsRemaining).toBe(CUP_PONG_BALLS_PER_TURN);
	});

	it("misses on a wildly off throw and resets the shooter streak", () => {
		const meta = freshMeta();
		const made = applyCupPongIntent(meta, "p1", { column: 0 });
		expect(made.ok).toBe(true);
		if (!made.ok) return;
		expect(made.meta.streak.p1).toBe(1);

		// power 1 + aim 1 => accuracy 0 => guaranteed miss.
		const missed = applyCupPongIntent(made.meta, "p1", { column: 1, power: 1, aim: 1 });
		expect(missed.ok).toBe(true);
		if (!missed.ok) return;
		expect(missed.meta.cups.p2[1]).toBe(true);
		expect(missed.meta.streak.p1).toBe(0);
		expect(missed.meta.lastThrow?.made).toBe(false);
		expect(missed.nextTurn).toBe("p2");
	});

	it("makes a perfectly aimed power/aim throw", () => {
		const meta = freshMeta();
		// power 0.5 (sweet spot) + aim 0 => accuracy 1 => guaranteed make.
		const result = applyCupPongIntent(meta, "p1", { column: 0, power: 0.5, aim: 0 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.meta.cups.p2[0]).toBe(false);
		expect(result.meta.lastThrow?.made).toBe(true);
	});

	it("opens a redemption round when the rack is cleared instead of an instant win", () => {
		const meta = freshMeta();
		meta.cups.p2 = [true, false, false, false, false, false];
		const result = applyCupPongIntent(meta, "p1", { column: 0 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.winner).toBeNull();
		expect(result.meta.redemption).toEqual({ active: true, player: "p2" });
		expect(result.nextTurn).toBe("p2");
		// p1 still has all 6 cups, so p2 gets 6 redemption balls.
		expect(result.meta.ballsRemaining).toBe(6);
	});

	it("scores a successful redemption as a draw", () => {
		const meta = freshMeta();
		meta.redemption = { active: true, player: "p2" };
		meta.cups.p1 = [true, false, false, false, false, false];
		meta.ballsRemaining = 1;
		const result = applyCupPongIntent(meta, "p2", { column: 0 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.winner).toBe("draw");
	});

	it("awards the original shooter the win when redemption balls run out", () => {
		const meta = freshMeta();
		meta.redemption = { active: true, player: "p2" };
		meta.cups.p1 = [true, true, false, false, false, false];
		meta.ballsRemaining = 1;
		// Forced miss on the last redemption ball.
		const result = applyCupPongIntent(meta, "p2", { column: 0, power: 1, aim: 1 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.winner).toBe("p1");
	});

	it("re-racks remaining cups to the front and keeps the shooter's turn", () => {
		const meta = freshMeta();
		meta.cups.p2 = [false, true, false, true, false, false];
		const result = applyCupPongIntent(meta, "p1", { column: CUP_PONG_RERACK_MOVE });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.meta.cups.p2).toEqual([true, true, false, false, false, false]);
		expect(result.nextTurn).toBe("p1");
	});

	it("rejects a re-rack when the remaining cup count is not a re-rack point", () => {
		const meta = freshMeta();
		meta.cups.p2 = [true, true, true, true, true, false]; // 5 live
		const result = applyCupPongIntent(meta, "p1", { column: CUP_PONG_RERACK_MOVE });
		expect(result.ok).toBe(false);
	});

	it("rejects a re-rack when the rack is already packed", () => {
		const meta = freshMeta();
		meta.cups.p2 = [true, true, false, false, false, false]; // 2 live, but no useful reformation.
		const result = applyCupPongIntent(meta, "p1", { column: CUP_PONG_RERACK_MOVE });
		expect(result.ok).toBe(false);
	});

	it("lists only the standing opponent cups as legal targets", () => {
		const meta = freshMeta();
		meta.cups.p2 = [true, false, true, true, true, true]; // 5 live, so no re-rack move.
		expect(getCupPongLegalMoves(meta, "p1")).toEqual([{ column: 0 }, { column: 2 }, { column: 3 }, { column: 4 }, { column: 5 }]);
	});

	it("aims a ruthless bot at the center cup with tight power and aim", () => {
		const meta = freshMeta(); // 6 cups, center index 2.5
		const moves = getCupPongLegalMoves(meta, "p2");
		const move = chooseCupPongBotMove(meta, "p2", moves, "ruthless");
		expect([2, 3]).toContain(move.column);
		expect(move.power ?? 0).toBeGreaterThanOrEqual(0);
		expect(move.power ?? 0).toBeLessThanOrEqual(1);
		expect(Math.abs(move.aim ?? 0)).toBeLessThanOrEqual(0.05);
	});
});
