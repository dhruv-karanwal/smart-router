/*
 * dijkstra.h
 * Smart Emergency Route Optimization System
 *
 * Dijkstra's Single-Source Shortest Path Algorithm
 * Complexity: O((V + E) log V) using a binary min-heap.
 *
 * Strategy: Greedily extracts the node with the lowest known distance
 * from a priority queue and relaxes its neighbours.
 */

#pragma once
#include "graph.h"
#include <queue>
#include <vector>
#include <chrono>

/*
 * dijkstra(g, src, dst)
 * ─────────────────────
 * g   : adjacency list built with buildGraph()
 * src : source node id
 * dst : destination node id
 *
 * Returns AlgoResult containing distances, predecessors, path,
 * nodes explored, and wall-clock execution time in ms.
 */
AlgoResult dijkstra(const AdjList& g, int src, int dst) {
    using Clock = std::chrono::high_resolution_clock;
    auto t0 = Clock::now();

    std::vector<double> dist(N, INF);
    std::vector<int>    prev(N, -1);
    std::vector<bool>   visited(N, false);

    dist[src] = 0.0;

    // Min-heap: (cost, node)
    std::priority_queue<PQNode, std::vector<PQNode>, std::greater<PQNode>> pq;
    pq.push({0.0, src});

    int nodesExplored = 0;

    while (!pq.empty()) {
        PQNode top = pq.top(); pq.pop();
        double cost = top.cost;
        int    u    = top.node;

        if (visited[u]) continue;
        visited[u] = true;
        ++nodesExplored;

        if (u == dst) break; // Early exit once destination is settled

        for (int i = 0; i < (int)g[u].size(); ++i) {
            int    to     = g[u][i].to;
            double weight = g[u][i].weight;
            double nc = cost + weight;
            if (nc < dist[to]) {
                dist[to] = nc;
                prev[to] = u;
                PQNode pn; pn.cost = nc; pn.node = to;
                pq.push(pn);
            }
        }
    }

    double ms = std::chrono::duration<double, std::milli>(Clock::now() - t0).count();

    AlgoResult res;
    res.dist          = dist;
    res.prev          = prev;
    res.nodesExplored = nodesExplored;
    res.execTimeMs    = ms;
    res.path          = reconstructPath(prev, dst);
    return res;
}
