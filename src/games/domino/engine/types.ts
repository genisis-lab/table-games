export type DominoPlayerMark = "p1" | "p2" | "p3" | "p4";
export type DominoTeamId = "northSouth" | "eastWest";
export type DominoGameMode = "partnership" | "free-for-all";
export type DominoDrawMode = "block" | "draw";
export type DominoDifficulty = "casual" | "sharp" | "ruthless";
export type DominoSide = "left" | "right";

export interface DominoTile {
  id: string;
  left: number;
  right: number;
}

export interface DominoBoardTile extends DominoTile {
  owner: DominoPlayerMark;
  roundIndex: number;
}

export interface DominoMove {
  column: number;
  edge?: "h" | "v";
}

export interface DominoLegalMove extends DominoMove {
  side: DominoSide;
  tile: DominoTile;
  orientedTile: DominoTile;
  resultingEnds: [number, number];
}

export interface DominoRoundSummary {
  round: number;
  winner: DominoPlayerMark | "draw";
  winningTeam?: DominoTeamId;
  points: number;
  blocked: boolean;
  remainingPips: Record<DominoPlayerMark, number>;
  reason: string;
}

export interface DominoMeta {
  deck: DominoTile[];
  hands: Record<DominoPlayerMark, DominoTile[]>;
  handCounts: Record<DominoPlayerMark, number>;
  chain: DominoBoardTile[];
  openLeft: number | null;
  openRight: number | null;
  scores: Record<DominoPlayerMark, number>;
  pipCounts: Record<DominoPlayerMark, number>;
  teamScores: Record<DominoTeamId, number>;
  passed: DominoPlayerMark[];
  passedNumbers: Record<DominoPlayerMark, number[]>;
  playerOrder: DominoPlayerMark[];
  round: number;
  targetScore: number;
  gameMode: DominoGameMode;
  drawMode: DominoDrawMode;
  roundWinner?: DominoPlayerMark | "draw";
  winningTeam?: DominoTeamId;
  lastScoreDelta?: number;
  lastRound?: DominoRoundSummary;
  lastAction?: string;
  log: string[];
}

export type DominoApplyResult =
  | {
      ok: true;
      meta: DominoMeta;
      point: { row: number; column: number };
      nextTurn: DominoPlayerMark;
      winner: DominoPlayerMark | "draw" | null;
    }
  | {
      ok: false;
      reason: string;
    };
