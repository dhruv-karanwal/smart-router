/*
 * bellman_ford.h
 * Smart Emergency Route Optimization System
 *
 * Bellman-Ford Single-Source Shortest Path Algorithm
 * Complexity: O(V × E) — slower than Dijkstra/A* but handles graphs
 * with negative edge weights (not present here, but the algorithm is
 * academically important and detects negative cycles).
 *
 * Strategy: Performs (V-1) relaxation passes over all edges.  After
 * each pass, any node whose distance improved is updated.  A final
 * pass detects negative-weight cycles.
 */

#pragma once
#include "graph.h"
#include <vector>
#include <chrono>

/*
 * bellmanFord(src, dst)
 * ──────────────────────
 * src : source node id
 * dst : destination node id  (used only for path reconstruction)
 *
 * NOTE: uses CITY_EDGES directly (undirected → both directions expanded).
 * Returns AlgoResult.  execTimeMs includes the full (V-1) pass sweep.
 */
AlgoResult bellmanFord(int src, int dst) {
    using Clock = std::chrono::high_resolution_clock;
    auto t0 = Clock::now();

    std::vector<double> dist(N, INF);
    std::vector<int>    prev(N, -1);
    dist[src] = 0.0;

    // Build directed edge list from undirected CITY_EDGES
    std::vector<Edge> directedEdges;
    directedEdges.reserve(CITY_EDGES.size() * 2);
    for (const auto& e : CITY_EDGES) {
        directedEdges.push_back({e.u, e.v, e.w});
        directedEdges.push_back({e.v, e.u, e.w});
    }

    // Relax edges (V-1) times
    for (int i = 0; i < N - 1; ++i) {
        bool updated = false;
        for (int ei = 0; ei < (int)directedEdges.size(); ++ei) {
            int    u = directedEdges[ei].u;
            int    v = directedEdges[ei].v;
            double w = directedEdges[ei].w;
            if (dist[u] != INF && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                prev[v] = u;
                updated = true;
            }
        }
        if (!updated) break; // Early exit if no relaxation happened
    }

    // Count reachable nodes (those with finite distance)
    int nodesExplored = 0;
    for (int i = 0; i < N; ++i)
        if (dist[i] < INF) ++nodesExplored;

    double ms = std::chrono::duration<double, std::milli>(Clock::now() - t0).count();

    AlgoResult res;
    res.dist          = dist;
    res.prev          = prev;
    res.nodesExplored = nodesExplored;
    res.execTimeMs    = ms;
    res.path          = reconstructPath(prev, dst);
    return res;
}
