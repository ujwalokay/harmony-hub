import * as THREE from "three";
import { SIZE, neighbors, rc } from "@/lib/baghchal";

/**
 * SINGLE SOURCE OF TRUTH for the board geometry.
 *
 * Every node, line, highlight and piece is derived from NODES below. Nothing in
 * the scene may compute its own position: pieces use `nodeVector(id)`, lines use
 * the same vectors. Node coordinates are fixed world-space values and NEVER
 * depend on viewport size, device or orientation — only the camera adapts.
 */

/** Distance between two adjacent nodes, in world units. */
export const SPACING = 1.15;
/** Height of the board plane the nodes live on. */
export const BOARD_Y = 0.41;
/** Fixed presentation rotation of the whole board group (degrees, Y axis). */
export const BOARD_ROTATION_DEG = 52;

export interface BoardNode {
  /** Index into the game board array — the node id used by game state. */
  id: number;
  /** Normalized integer board coordinates, centered on 0. */
  u: number;
  v: number;
  /** Fixed local position inside BoardGroup. */
  position: THREE.Vector3;
}

export const NODES: BoardNode[] = Array.from({ length: SIZE * SIZE }, (_, id) => {
  const [r, c] = rc(id);
  const center = (SIZE - 1) / 2;
  const u = c - center;
  const v = r - center;
  return { id, u, v, position: new THREE.Vector3(u * SPACING, BOARD_Y, v * SPACING) };
});

/** Exact node position (a fresh clone — callers must never mutate NODES). */
export function nodeVector(id: number): THREE.Vector3 {
  return NODES[id]!.position.clone();
}

export function nodePosition(id: number): [number, number, number] {
  const p = NODES[id]!.position;
  return [p.x, p.y, p.z];
}

/** Unique connecting lines, derived from the same adjacency as game logic. */
export const EDGES: Array<{ a: number; b: number }> = (() => {
  const seen = new Set<string>();
  const out: Array<{ a: number; b: number }> = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (const n of neighbors(i)) {
      const key = i < n ? `${i}-${n}` : `${n}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: i, b: n });
    }
  }
  return out;
})();

/** Local-space extents of the playable board (ignores scenery/shadow planes). */
export const BOARD_HALF_EXTENT = ((SIZE - 1) / 2) * SPACING;
/** Tallest piece above the board plane, used when fitting the camera. */
export const PIECE_HEIGHT = 0.75;
