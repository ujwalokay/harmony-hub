export type Cell = "empty" | "goat" | "tiger";
export type Turn = "goat" | "tiger";

export interface GameState {
  board: Cell[];
  turn: Turn;
  goatsPlaced: number;
  goatsCaptured: number;
  winner: Turn | null;
  history: string[];
}

export const SIZE = 5;
export const TOTAL_GOATS = 20;

export const idx = (r: number, c: number) => r * SIZE + c;
export const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const inBounds = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const diagonalAllowed = (r: number, c: number) => (r + c) % 2 === 0;

export function neighbors(i: number): number[] {
  const [r, c] = rc(i);
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const isDiag = dr !== 0 && dc !== 0;
    if (isDiag && !diagonalAllowed(r, c)) continue;
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) out.push(idx(nr, nc));
  }
  return out;
}

/** Returns [over, landing] pairs reachable by a jump from i. */
export function jumps(i: number): Array<[number, number]> {
  const [r, c] = rc(i);
  const out: Array<[number, number]> = [];
  for (const [dr, dc] of DIRS) {
    const isDiag = dr !== 0 && dc !== 0;
    if (isDiag && !diagonalAllowed(r, c)) continue;
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + 2 * dr;
    const lc = c + 2 * dc;
    if (!inBounds(lr, lc)) continue;
    out.push([idx(mr, mc), idx(lr, lc)]);
  }
  return out;
}

export const LABELS = (() => {
  const l: string[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) l.push(`${"ABCDE"[c]}${r + 1}`);
  return l;
})();

export function createGame(): GameState {
  const board: Cell[] = Array(SIZE * SIZE).fill("empty");
  board[idx(0, 0)] = "tiger";
  board[idx(0, 4)] = "tiger";
  board[idx(4, 0)] = "tiger";
  board[idx(4, 4)] = "tiger";
  return {
    board,
    turn: "goat",
    goatsPlaced: 0,
    goatsCaptured: 0,
    winner: null,
    history: [],
  };
}

export function legalMovesFrom(state: GameState, from: number): number[] {
  const piece = state.board[from];
  if (piece === "empty") return [];
  if (piece === "tiger") {
    const moves = neighbors(from).filter((n) => state.board[n] === "empty");
    for (const [over, land] of jumps(from)) {
      if (state.board[over] === "goat" && state.board[land] === "empty") moves.push(land);
    }
    return moves;
  }
  // goat: only after all goats placed
  if (state.goatsPlaced < TOTAL_GOATS) return [];
  return neighbors(from).filter((n) => state.board[n] === "empty");
}

export function tigersBlocked(state: GameState): boolean {
  return state.board.every((cell, i) => cell !== "tiger" || legalMovesFrom(state, i).length === 0);
}

function evaluate(state: GameState): GameState {
  if (state.goatsCaptured >= 5) return { ...state, winner: "tiger" };
  if (tigersBlocked(state)) return { ...state, winner: "goat" };
  return state;
}

/** Place a goat during the placement phase. */
export function placeGoat(state: GameState, at: number): GameState | null {
  if (state.winner || state.turn !== "goat") return null;
  if (state.goatsPlaced >= TOTAL_GOATS) return null;
  if (state.board[at] !== "empty") return null;
  const board = [...state.board];
  board[at] = "goat";
  return evaluate({
    ...state,
    board,
    goatsPlaced: state.goatsPlaced + 1,
    turn: "tiger",
    history: [...state.history, `Goat placed on ${LABELS[at]}`],
  });
}

export function movePiece(state: GameState, from: number, to: number): GameState | null {
  if (state.winner) return null;
  const piece = state.board[from];
  if (piece === "empty" || piece !== state.turn) return null;
  if (!legalMovesFrom(state, from).includes(to)) return null;

  const board = [...state.board];
  board[from] = "empty";
  board[to] = piece;
  let captured = state.goatsCaptured;
  let note = `${piece === "tiger" ? "Tiger" : "Goat"} ${LABELS[from]} → ${LABELS[to]}`;

  if (piece === "tiger") {
    const jump = jumps(from).find(([, land]) => land === to);
    const isNeighbor = neighbors(from).includes(to);
    if (jump && !isNeighbor && state.board[jump[0]] === "goat") {
      board[jump[0]] = "empty";
      captured += 1;
      note += ` (captured goat on ${LABELS[jump[0]]})`;
    }
  }

  return evaluate({
    ...state,
    board,
    goatsCaptured: captured,
    turn: piece === "tiger" ? "goat" : "tiger",
    history: [...state.history, note],
  });
}

/** Simple tiger AI: prefer captures, otherwise a random legal move. */
export function tigerAiMove(state: GameState): GameState | null {
  if (state.winner || state.turn !== "tiger") return null;
  const options: Array<{ from: number; to: number; capture: boolean }> = [];
  state.board.forEach((cell, from) => {
    if (cell !== "tiger") return;
    for (const to of legalMovesFrom(state, from)) {
      const capture = jumps(from).some(([, land]) => land === to) && !neighbors(from).includes(to);
      options.push({ from, to, capture });
    }
  });
  if (options.length === 0) return null;
  const captures = options.filter((o) => o.capture);
  const pool = captures.length ? captures : options;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  return movePiece(state, pick.from, pick.to);
}
