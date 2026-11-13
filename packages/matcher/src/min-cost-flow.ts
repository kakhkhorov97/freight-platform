interface Edge {
  readonly from: number;
  readonly to: number;
  readonly cost: number;
  available: boolean;
}

// Each forward edge is immediately followed by its reverse edge.
function addEdge(
  edges: Edge[],
  from: number,
  to: number,
  cost: number,
): number {
  const index = edges.length;
  edges.push({ from, to, cost, available: true });
  edges.push({ from: to, to: from, cost: -cost, available: false });
  return index;
}

function augment(edges: Edge[], nodeCount: number): boolean {
  const sink = nodeCount - 1;
  const distances = Array<number>(nodeCount).fill(Infinity);
  const previous = new Map<number, number>();
  distances[0] = 0;

  // Reverse edges have negative cost. Bellman-Ford permits reassignment.
  for (let pass = 0; pass < nodeCount - 1; pass += 1) {
    let changed = false;
    for (const [index, edge] of edges.entries()) {
      const start = distances[edge.from] ?? Infinity;
      if (!edge.available || !Number.isFinite(start)) continue;
      const candidate = start + edge.cost;
      if (candidate < (distances[edge.to] ?? Infinity)) {
        distances[edge.to] = candidate;
        previous.set(edge.to, index);
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (!previous.has(sink)) return false;

  const path: number[] = [];
  const visited = new Set<number>();
  let node = sink;
  while (node !== 0) {
    if (visited.has(node)) {
      throw new RangeError(
        "Cost precision is insufficient for batch assignment",
      );
    }
    visited.add(node);
    const index = previous.get(node);
    const edge = index === undefined ? undefined : edges[index];
    if (index === undefined || !edge)
      throw new Error("Incomplete augmenting path");
    path.push(index);
    node = edge.from;
  }
  for (const index of path) {
    const edge = edges[index];
    const reverse = edges[index ^ 1];
    if (!edge || !reverse) throw new Error("Missing residual edge");
    edge.available = false;
    reverse.available = true;
  }
  return true;
}

export function solveFlow(
  tripCount: number,
  loadCount: number,
  candidates: readonly { trip: number; load: number; cost: number }[],
): number[] {
  const nodeCount = tripCount + loadCount + 2;
  const edges: Edge[] = [];
  for (let trip = 0; trip < tripCount; trip += 1) {
    addEdge(edges, 0, 1 + trip, 0);
  }
  for (let load = 0; load < loadCount; load += 1) {
    addEdge(edges, 1 + tripCount + load, nodeCount - 1, 0);
  }
  const candidateEdges = candidates.map(({ trip, load, cost }) => {
    if (cost > Number.MAX_VALUE / nodeCount) {
      throw new RangeError("Assignment cost magnitude is too large");
    }
    return addEdge(edges, 1 + trip, 1 + tripCount + load, cost);
  });
  while (augment(edges, nodeCount)) {
    // Continue until no augmenting path remains, maximizing cardinality first.
  }
  return candidateEdges.flatMap((edgeIndex, index) =>
    edges[edgeIndex]?.available === false ? [index] : [],
  );
}
