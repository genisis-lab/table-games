import { getDominoLegalMoves, isSameMove, orientDomino, sideFromMove } from "./legalMoves";
import { blockedRoundWinner, scoreRound, syncDominoCounts, teamForPlayer } from "./scoring";
import { DOMINO_PLAYER_ORDER, makeDominoDeck, shuffleDominoes } from "./tiles";
import type {
  DominoApplyResult,
  DominoBoardTile,
  DominoDrawMode,
  DominoGameMode,
  DominoMeta,
  DominoMove,
  DominoPlayerMark,
  DominoTeamId,
  DominoTile
} from "./types";

const HAND_SIZE = 7;
const MAX_LOG_ITEMS = 24;

export function createDominoMeta(variant: string = "classic"): DominoMeta {
  const settings = settingsForVariant(variant);
  return startDominoRound({
    ...emptyDominoMeta(settings),
    round: 1,
    lastAction: "Round 1 starts. Seat 1 leads.",
    log: ["Round 1 starts. Seat 1 leads."]
  });
}

export function applyDominoIntent(
  metaInput: DominoMeta,
  player: DominoPlayerMark,
  move: DominoMove
): DominoApplyResult {
  const meta = normalizeDominoMeta(metaInput);
  if (!meta.playerOrder.includes(player)) return { ok: false, reason: "That seat is not in this domino game." };

  if (move.column === -1) return passOrDraw(meta, player);

  const hand = meta.hands[player];
  const tile = hand[move.column];
  if (!tile) return { ok: false, reason: "Choose one of your dominoes." };

  const legalMoves = getDominoLegalMoves(meta, player);
  const requestedMove = legalMoves.find((candidate) => isSameMove(candidate, move));
  const singleLegalMoveForTile = legalMoves.filter((candidate) => candidate.column === move.column);
  const resolvedMove = requestedMove ?? (singleLegalMoveForTile.length === 1 ? singleLegalMoveForTile[0] : null);
  if (!resolvedMove) return { ok: false, reason: "Match one open end of the chain." };

  const side = resolvedMove.side;
  const orientedTile = orientDomino(tile, side, meta);
  if (!orientedTile) return { ok: false, reason: "Match one open end of the chain." };

  hand.splice(move.column, 1);
  const boardTile: DominoBoardTile = {
    ...orientedTile,
    owner: player,
    roundIndex: meta.chain.length
  };
  if (meta.chain.length === 0 || side === "right") meta.chain.push(boardTile);
  else meta.chain.unshift(boardTile);

  meta.openLeft = meta.chain[0].left;
  meta.openRight = meta.chain.at(-1)?.right ?? null;
  meta.passed = [];
  syncDominoCounts(meta);

  const playLabel = `${seatName(player)} played ${tile.left}-${tile.right}${meta.chain.length > 1 ? ` ${side}` : ""}`;
  addLog(meta, playLabel);

  if (hand.length === 0) {
    return finishRound(meta, player, false, `${seatName(player)} went out.`, player);
  }

  return {
    ok: true,
    meta,
    point: { row: side === "left" ? 0 : 1, column: move.column },
    nextTurn: nextDominoPlayer(meta, player),
    winner: null
  };
}

export function normalizeDominoMeta(meta: DominoMeta): DominoMeta {
  const next = JSON.parse(JSON.stringify(meta)) as DominoMeta;
  const settings = {
    gameMode: next.gameMode ?? "partnership",
    drawMode: next.drawMode ?? "block",
    targetScore: next.targetScore ?? 100
  };

  next.deck ??= [];
  next.hands ??= emptyHands();
  next.hands.p1 ??= [];
  next.hands.p2 ??= [];
  next.hands.p3 ??= [];
  next.hands.p4 ??= [];
  next.handCounts ??= emptyNumbers();
  next.chain = (next.chain ?? []).map((tile, index) => ({
    ...tile,
    owner: tile.owner ?? "p1",
    roundIndex: tile.roundIndex ?? index
  }));
  next.openLeft ??= next.chain[0]?.left ?? null;
  next.openRight ??= next.chain.at(-1)?.right ?? null;
  next.scores ??= emptyNumbers();
  next.pipCounts ??= emptyNumbers();
  next.teamScores ??= { northSouth: 0, eastWest: 0 };
  next.passed ??= [];
  next.passedNumbers ??= { p1: [], p2: [], p3: [], p4: [] };
  next.playerOrder ??= [...DOMINO_PLAYER_ORDER];
  next.round ??= 1;
  next.targetScore = settings.targetScore;
  next.gameMode = settings.gameMode;
  next.drawMode = settings.drawMode;
  next.log ??= next.lastAction ? [next.lastAction] : [];
  return syncDominoCounts(next);
}

export function nextDominoPlayer(meta: DominoMeta, player: DominoPlayerMark): DominoPlayerMark {
  const current = meta.playerOrder.indexOf(player);
  return meta.playerOrder[(current + 1) % meta.playerOrder.length] ?? "p1";
}

function passOrDraw(meta: DominoMeta, player: DominoPlayerMark): DominoApplyResult {
  if (getDominoLegalMoves(meta, player).length > 0) {
    return { ok: false, reason: "You have a playable domino." };
  }

  if (meta.drawMode === "draw" && meta.deck.length > 0) {
    const drawn = meta.deck.shift();
    if (drawn) {
      meta.hands[player].push(drawn);
      syncDominoCounts(meta);
      addLog(meta, `${seatName(player)} drew from the boneyard.`);
      return {
        ok: true,
        meta,
        point: { row: 0, column: -1 },
        nextTurn: player,
        winner: null
      };
    }
  }

  addUnique(meta.passed, player);
  recordPassedNumbers(meta, player);
  addLog(meta, `${seatName(player)} passed.`);

  if (meta.passed.length >= meta.playerOrder.length) {
    const winner = blockedRoundWinner(meta);
    return finishRound(meta, winner, true, "The table blocked.", player);
  }

  return {
    ok: true,
    meta,
    point: { row: 0, column: -1 },
    nextTurn: nextDominoPlayer(meta, player),
    winner: null
  };
}

function finishRound(
  meta: DominoMeta,
  winner: DominoPlayerMark | "draw",
  blocked: boolean,
  reason: string,
  fallbackTurn: DominoPlayerMark
): DominoApplyResult {
  const { summary, matchWinner } = scoreRound(meta, winner, blocked, reason);
  const summaryText = summary.winner === "draw"
    ? `${reason} Round ${summary.round} is a draw.`
    : `${reason} ${scoreLabel(meta, summary.winner, summary.winningTeam)} scores ${summary.points}.`;
  addLog(meta, summaryText);
  meta.lastAction = summaryText;

  if (matchWinner) {
    addLog(meta, matchWinner === "draw" ? "Match ends in a draw." : `${scoreLabel(meta, matchWinner, teamForPlayer(matchWinner))} wins the match.`);
    return {
      ok: true,
      meta,
      point: { row: blocked ? 0 : 1, column: -1 },
      nextTurn: matchWinner === "draw" ? fallbackTurn : matchWinner,
      winner: matchWinner
    };
  }

  const nextStarter = summary.winner === "draw" ? nextDominoPlayer(meta, fallbackTurn) : summary.winner;
  const nextRoundMeta = startDominoRound({
    ...meta,
    round: meta.round + 1,
    lastAction: `${summaryText} Round ${meta.round + 1} starts.`,
    log: [...meta.log, `Round ${meta.round + 1} starts.`].slice(-MAX_LOG_ITEMS)
  });
  return {
    ok: true,
    meta: nextRoundMeta,
    point: { row: blocked ? 0 : 1, column: -1 },
    nextTurn: nextStarter,
    winner: null
  };
}

function startDominoRound(meta: DominoMeta): DominoMeta {
  const deck = shuffleDominoes(makeDominoDeck());
  const hands: Record<DominoPlayerMark, DominoTile[]> = {
    p1: deck.splice(0, HAND_SIZE),
    p2: deck.splice(0, HAND_SIZE),
    p3: deck.splice(0, HAND_SIZE),
    p4: deck.splice(0, HAND_SIZE)
  };

  return syncDominoCounts({
    ...meta,
    deck,
    hands,
    chain: [],
    openLeft: null,
    openRight: null,
    passed: [],
    passedNumbers: { p1: [], p2: [], p3: [], p4: [] }
  });
}

function emptyDominoMeta(settings: {
  gameMode: DominoGameMode;
  drawMode: DominoDrawMode;
  targetScore: number;
}): DominoMeta {
  return {
    deck: [],
    hands: emptyHands(),
    handCounts: emptyNumbers(),
    chain: [],
    openLeft: null,
    openRight: null,
    scores: emptyNumbers(),
    pipCounts: emptyNumbers(),
    teamScores: { northSouth: 0, eastWest: 0 },
    passed: [],
    passedNumbers: { p1: [], p2: [], p3: [], p4: [] },
    playerOrder: [...DOMINO_PLAYER_ORDER],
    round: 1,
    targetScore: settings.targetScore,
    gameMode: settings.gameMode,
    drawMode: settings.drawMode,
    log: []
  };
}

function settingsForVariant(variant: string): { gameMode: DominoGameMode; drawMode: DominoDrawMode; targetScore: number } {
  if (variant === "wide") return { gameMode: "free-for-all", drawMode: "block", targetScore: 100 };
  if (variant === "party") return { gameMode: "partnership", drawMode: "block", targetScore: 150 };
  return { gameMode: "partnership", drawMode: "block", targetScore: 100 };
}

function recordPassedNumbers(meta: DominoMeta, player: DominoPlayerMark): void {
  const numbers = [meta.openLeft, meta.openRight].filter((value): value is number => typeof value === "number");
  meta.passedNumbers[player] = [...new Set([...meta.passedNumbers[player], ...numbers])];
}

function addUnique(values: DominoPlayerMark[], value: DominoPlayerMark): void {
  if (!values.includes(value)) values.push(value);
}

function addLog(meta: DominoMeta, value: string): void {
  meta.lastAction = value;
  meta.log = [...(meta.log ?? []), value].slice(-MAX_LOG_ITEMS);
}

function scoreLabel(meta: DominoMeta, player: DominoPlayerMark, team?: DominoTeamId): string {
  if (meta.gameMode === "free-for-all") return seatName(player);
  const resolvedTeam = team ?? teamForPlayer(player);
  return resolvedTeam === "northSouth" ? "Team 1 + 3" : "Team 2 + 4";
}

function seatName(player: DominoPlayerMark): string {
  return `Seat ${player.slice(1)}`;
}

function emptyHands(): Record<DominoPlayerMark, DominoTile[]> {
  return { p1: [], p2: [], p3: [], p4: [] };
}

function emptyNumbers(): Record<DominoPlayerMark, number> {
  return { p1: 0, p2: 0, p3: 0, p4: 0 };
}
