/*
 * floyd_warshall.h
 * Smart Emergency Route Optimization System
 *
 * Floyd-Warshall All-Pairs Shortest Path Algorithm
 * Complexity: O(V³) time, O(V²) space.
 *
 * Strategy: Dynamic programming over intermediate vertices k.
 * d[i][j] = min(d[i][j], d[i][k] + d[k][j]) for all i, j, k.
 * Produces shortest distances between EVERY pair of nodes, not just
 * from one source — the most general (and most expensive) algorithm.
 *
 * The function accepts (src, dst) so it can extract the relevant
 * single-pair result and reconstruct the path for comparison.
 */

#pragma once
#include "graph.h"
#include <vector>
#include <chrono>

// Stores the complete all-pairs result for optional reuse.
struct FWResult {
    std::vector<std::vector<double>> d;     // d[i][j] = shortest i→j
    std::vector<std::vector<int>>    next;  // next[i][j] = first step on path i→j
};

/*
 * floydWarshall(src, dst)
 * ───────────────────────
 * Runs the full O(V³) DP over all node pairs, then extracts the
 * src → dst result.
 *
 * Returns AlgoResult where:
 *   dist[i] = shortest distance from src to i  (row src of d matrix)
 *   nodesExplored = N  (all nodes are processed)
 */
AlgoResult floydWarshall(int src, int dst) {
    using Clock = std::chrono::high_resolution_clock;
    auto t0 = Clock::now();

    // Initialise distance and next-hop matrices
    std::vector<std::vector<double>> d(N, std::vector<double>(N, INF));
    std::vector<std::vector<int>>    next(N, std::vector<int>(N, -1));

    for (int i = 0; i < N; ++i) d[i][i] = 0.0;

    for (const auto& e : CITY_EDGES) {
        d[e.u][e.v] = e.w;   d[e.v][e.u] = e.w;
        next[e.u][e.v] = e.v; next[e.v][e.u] = e.u;
    }

    // Triple-loop DP
    for (int k = 0; k < N; ++k)
        for (int i = 0; i < N; ++i)
            for (int j = 0; j < N; ++j)
                if (d[i][k] != INF && d[k][j] != INF && d[i][k] + d[k][j] < d[i][j]) {
                    d[i][j]    = d[i][k] + d[k][j];
                    next[i][j] = next[i][k];
                }

    // Reconstruct path src → dst via next-hop matrix
    std::vector<int> path;
    if (next[src][dst] != -1 || src == dst) {
        path.push_back(src);
        int cur = src;
        while (cur != dst) {
            cur = next[cur][dst];
            path.push_back(cur);
            if ((int)path.size() > N + 1) { path.clear(); break; } // guard
        }
    }

    // Build prev[] array compatible with AlgoResult (reverse of path)
    std::vector<int> prev(N, -1);
    for (int i = 1; i < (int)path.size(); ++i)
        prev[path[i]] = path[i - 1];

    double ms = std::chrono::duration<double, std::milli>(Clock::now() - t0).count();

    AlgoResult res;
    res.dist          = d[src];   // distances from src to every node
    res.prev          = prev;
    res.nodesExplored = N;        // Floyd-Warshall processes every node
    res.execTimeMs    = ms;
    res.path          = path;
    return res;
}
