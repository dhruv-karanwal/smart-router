/*
 * astar.h
 * Smart Emergency Route Optimization System
 *
 * A* (A-Star) Heuristic Search Algorithm
 * Complexity: O(E log V) — faster than Dijkstra in practice when a good
 * heuristic is available (here: Euclidean distance × 10).
 *
 * Strategy: Maintains f(n) = g(n) + h(n) where g(n) is the actual cost
 * from the source and h(n) is an admissible heuristic estimate to the
 * destination.  Nodes are expanded in order of f-score, guaranteeing
 * optimality when heuristic is non-overestimating.
 */

#pragma once
#include "graph.h"
#include <queue>
#include <vector>
#include <chrono>

/*
 * aStar(g, src, dst)
 * ──────────────────
 * g   : adjacency list built with buildGraph()
 * src : source node id
 * dst : destination node id
 *
 * Returns AlgoResult containing g-scores (≡ distances), predecessors,
 * path, nodes explored, and wall-clock execution time in ms.
 */
AlgoResult aStar(const AdjList& g, int src, int dst) {
    using Clock = std::chrono::high_resolution_clock;
    auto t0 = Clock::now();

    std::vector<double> gScore(N, INF);
    std::vector<double> fScore(N, INF);
    std::vector<int>    prev(N, -1);
    std::vector<bool>   closed(N, false);

    gScore[src] = 0.0;
    fScore[src] = heuristic(src, dst);

    // Min-heap ordered by f-score
    std::priority_queue<PQNode, std::vector<PQNode>, std::greater<PQNode>> pq;
    pq.push({fScore[src], src});

    int nodesExplored = 0;

    while (!pq.empty()) {
        PQNode top = pq.top(); pq.pop();
        int u = top.node;

        if (closed[u]) continue;
        closed[u] = true;
        ++nodesExplored;

        if (u == dst) break; // Found optimal path to destination

        for (int i = 0; i < (int)g[u].size(); ++i) {
            int    to     = g[u][i].to;
            double weight = g[u][i].weight;
            double tg = gScore[u] + weight;
            if (tg < gScore[to]) {
                prev[to]   = u;
                gScore[to] = tg;
                fScore[to] = tg + heuristic(to, dst);
                PQNode pn; pn.cost = fScore[to]; pn.node = to;
                pq.push(pn);
            }
        }
    }

    double ms = std::chrono::duration<double, std::milli>(Clock::now() - t0).count();

    AlgoResult res;
    res.dist          = gScore;   // g-scores represent actual distances
    res.prev          = prev;
    res.nodesExplored = nodesExplored;
    res.execTimeMs    = ms;
    res.path          = reconstructPath(prev, dst);
    return res;
}
