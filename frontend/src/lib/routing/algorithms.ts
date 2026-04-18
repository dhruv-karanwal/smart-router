import { CityGraph, haversineDist } from './graph-builder';

export interface RouteResult {
  algo: string;
  dist: number;      // effective distance (weight * traffic)
  path: number[];    // node IDs
  execTimeMs: number;
}

// Simple Min-Heap Priority Queue for Dijkstra and A*
class MinHeap {
  private heap: { node: number; cost: number }[] = [];

  push(node: number, cost: number) {
    this.heap.push({ node, cost });
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[parentIdx].cost <= this.heap[idx].cost) break;
      [this.heap[parentIdx], this.heap[idx]] = [this.heap[idx], this.heap[parentIdx]];
      idx = parentIdx;
    }
  }

  private sinkDown(idx: number) {
    const len = this.heap.length;
    while (true) {
      let left = 2 * idx + 1;
      let right = 2 * idx + 2;
      let smallest = idx;

      if (left < len && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < len && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

export function dijkstra(graph: CityGraph, start: number, end: number): RouteResult {
  const t0 = performance.now();
  
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const pq = new MinHeap();

  for (const n of graph.nodes.keys()) {
    dist.set(n, Infinity);
  }
  
  dist.set(start, 0);
  pq.push(start, 0);

  while (!pq.isEmpty()) {
    const { node: u, cost: d } = pq.pop()!;

    if (u === end) break;
    if (d > (dist.get(u) || Infinity)) continue;

    const edges = graph.adjList.get(u) || [];
    for (const e of edges) {
      const alt = d + (e.weight * e.trafficFactor);
      if (alt < (dist.get(e.v) || Infinity)) {
        dist.set(e.v, alt);
        prev.set(e.v, u);
        pq.push(e.v, alt);
      }
    }
  }

  return reconstructPath(prev, dist, start, end, 'Dijkstra', performance.now() - t0);
}

export function aStar(graph: CityGraph, start: number, end: number): RouteResult {
  const t0 = performance.now();
  
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const pq = new MinHeap();

  for (const n of graph.nodes.keys()) {
    dist.set(n, Infinity);
  }
  
  dist.set(start, 0);
  const targetNode = graph.nodes.get(end);

  if (!targetNode) return { algo: 'A*', dist: Infinity, path: [], execTimeMs: 0 };

  pq.push(start, 0);

  while (!pq.isEmpty()) {
    const { node: u, cost: d } = pq.pop()!;

    if (u === end) break;
    if (d > (dist.get(u) || Infinity)) continue;

    const uNode = graph.nodes.get(u);
    const edges = graph.adjList.get(u) || [];

    for (const e of edges) {
      const gCur = dist.get(u) || 0;
      const gScore = gCur + (e.weight * e.trafficFactor);
      
      if (gScore < (dist.get(e.v) || Infinity)) {
        dist.set(e.v, gScore);
        prev.set(e.v, u);

        const vNode = graph.nodes.get(e.v);
        let hScore = 0;
        if (vNode) {
            hScore = haversineDist(vNode.lat, vNode.lng, targetNode.lat, targetNode.lng);
        }
        
        pq.push(e.v, gScore + hScore); // f = g + h
      }
    }
  }

  return reconstructPath(prev, dist, start, end, 'A*', performance.now() - t0);
}

export function bellmanFord(graph: CityGraph, start: number, end: number): RouteResult {
  const t0 = performance.now();
  
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();

  for (const n of graph.nodes.keys()) dist.set(n, Infinity);
  dist.set(start, 0);

  const V = graph.nodes.size;
  // Relax all edges V - 1 times
  // In JS with 1000 nodes, V=1000, edges=2000. 1000 * 2000 = 2M operations. Fast enough (< 100ms).
  // Optimization: Stop if no changes
  for (let i = 0; i < V - 1; i++) {
    let updated = false;
    for (const [u, edges] of Array.from(graph.adjList.entries())) {
      const uDist = dist.get(u) || Infinity;
      if (uDist === Infinity) continue;
      
      for (const e of edges) {
        const newDist = uDist + (e.weight * e.trafficFactor);
        if (newDist < (dist.get(e.v) || Infinity)) {
          dist.set(e.v, newDist);
          prev.set(e.v, u);
          updated = true;
        }
      }
    }
    if (!updated) break;
  }

  return reconstructPath(prev, dist, start, end, 'Bellman-Ford', performance.now() - t0);
}

function reconstructPath(prev: Map<number, number>, dist: Map<number, number>, start: number, end: number, algo: string, execTimeMs: number): RouteResult {
  if (dist.get(end) === Infinity || dist.get(end) === undefined) {
      return { algo, dist: Infinity, path: [], execTimeMs };
  }

  const path: number[] = [];
  let curr = end;
  while (curr !== start && prev.has(curr)) {
    path.unshift(curr);
    curr = prev.get(curr)!;
  }
  path.unshift(start);

  return { algo, dist: dist.get(end) || 0, path, execTimeMs };
}
