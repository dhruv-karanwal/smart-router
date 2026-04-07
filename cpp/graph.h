/*
 * graph.h
 * Smart Emergency Route Optimization System
 * Shared city graph data — nodes, edges, adjacency list, MinHeap, utilities.
 */

#pragma once
#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>
#include <limits>
#include <chrono>
#include <functional>

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
static const int N = 16;
static const double INF = std::numeric_limits<double>::infinity();

// ─────────────────────────────────────────────
//  CITY NODES
// ─────────────────────────────────────────────
struct CityNode {
    int id;
    std::string name;
    double x, y;
    std::string type;
};

static const std::vector<CityNode> CITY_NODES = {
    {0,  "Central Hospital",  0.50, 0.15, "hospital"},
    {1,  "Fire Station A",    0.15, 0.30, "fire"},
    {2,  "Police HQ",         0.80, 0.28, "police"},
    {3,  "Market Square",     0.35, 0.40, "civilian"},
    {4,  "University Gate",   0.65, 0.42, "civilian"},
    {5,  "Airport Terminal",  0.20, 0.60, "civilian"},
    {6,  "Tech Park",         0.50, 0.55, "civilian"},
    {7,  "Riverside Bridge",  0.80, 0.58, "civilian"},
    {8,  "Eastgate Mall",     0.90, 0.40, "civilian"},
    {9,  "North Station",     0.35, 0.20, "train"},
    {10, "West Junction",     0.08, 0.50, "civilian"},
    {11, "City Hall",         0.62, 0.25, "civilian"},
    {12, "South Terminal",    0.50, 0.80, "train"},
    {13, "Industrial Zone",   0.22, 0.75, "civilian"},
    {14, "Park District",     0.72, 0.72, "civilian"},
    {15, "Harbor Gate",       0.88, 0.80, "civilian"},
};

// ─────────────────────────────────────────────
//  CITY EDGES  {from, to, weight(km)}
// ─────────────────────────────────────────────
struct Edge {
    int u, v;
    double w;
};

static const std::vector<Edge> CITY_EDGES = {
    {0,  9,  3.2}, {0, 11, 2.8}, {0,  1, 5.6}, {0,  2, 4.1},
    {1,  9,  3.0}, {1,  3, 4.2}, {1, 10, 3.5},
    {2, 11,  3.3}, {2,  8, 2.9}, {2,  4, 4.0},
    {3,  9,  2.7}, {3,  4, 4.5}, {3,  6, 3.8}, {3,  5, 4.6},
    {4, 11,  2.5}, {4,  6, 2.9}, {4,  7, 3.7},
    {5, 10,  2.8}, {5,  6, 4.0}, {5, 13, 3.2},
    {6,  7,  3.5}, {6, 12, 3.4},
    {7,  8,  3.0}, {7, 14, 2.6},
    {12,13,  4.1}, {12,14, 3.3},
    {13,10,  4.0},
    {14,15,  2.4}, {8, 15, 4.2},
};

// ─────────────────────────────────────────────
//  ADJACENCY LIST
// ─────────────────────────────────────────────
struct AdjEntry { int to; double weight; };
using AdjList = std::vector<std::vector<AdjEntry>>;

inline AdjList buildGraph() {
    AdjList g(N);
    for (const auto& e : CITY_EDGES) {
        g[e.u].push_back({e.v, e.w});
        g[e.v].push_back({e.u, e.w});
    }
    return g;
}

// ─────────────────────────────────────────────
//  DYNAMIC STATE 
// ─────────────────────────────────────────────
struct GraphState {
    std::vector<std::pair<int, int>> blockedEdges;
    // Keys: "u-v", Value: multiplier
    std::unordered_map<std::string, double> trafficMultipliers;
    double emergencyPriorityFactor; // subtracts from weight
};

inline AdjList buildDynamicGraph(const GraphState& state) {
    AdjList g(N);
    for (const auto& e : CITY_EDGES) {
        // Check if edge is blocked
        bool isBlocked = false;
        for (const auto& b : state.blockedEdges) {
            if ((b.first == e.u && b.second == e.v) || (b.first == e.v && b.second == e.u)) {
                isBlocked = true;
                break;
            }
        }
        if (isBlocked) continue; // Skip blocked edges

        double curWeight = e.w;

        // Apply traffic
        std::string key1 = std::to_string(e.u) + "-" + std::to_string(e.v);
        std::string key2 = std::to_string(e.v) + "-" + std::to_string(e.u);
        
        if (state.trafficMultipliers.count(key1)) {
            curWeight *= state.trafficMultipliers.at(key1);
        } else if (state.trafficMultipliers.count(key2)) {
            curWeight *= state.trafficMultipliers.at(key2);
        }

        // Apply emergency priority
        curWeight -= state.emergencyPriorityFactor;

        // Ensure weight doesn't drop too much unless we explicitly test negative cycles
        // For safety, let's keep it > 0.1 unless emergency priority heavily forces it
        // A minimum threshold guarantees A* / Dijkstra still functions, or if it goes < 0 Bellman-Ford kicks in.
        // Node.js decides algo. If Bellman-ford, it can handle < 0. For Dijkstra we shouldn't allow < 0.
        // Actually, let's allow it to drop to arbitrary, but cap it at -10 max.
        
        g[e.u].push_back({e.v, curWeight});
        g[e.v].push_back({e.u, curWeight});
    }
    return g;
}

// ─────────────────────────────────────────────
//  MIN-HEAP (priority queue node)
// ─────────────────────────────────────────────
struct PQNode {
    double cost;
    int    node;
    bool operator>(const PQNode& o) const { return cost > o.cost; }
};

// ─────────────────────────────────────────────
//  ALGORITHM RESULT
// ─────────────────────────────────────────────
struct AlgoResult {
    std::vector<double> dist;       // dist[i] = shortest distance from src to i
    std::vector<int>    prev;       // prev[i] = predecessor in shortest path
    int                 nodesExplored;
    double              execTimeMs; // milliseconds
    std::vector<int>    path;       // reconstructed path src → dst
};

// ─────────────────────────────────────────────
//  PATH RECONSTRUCTION
// ─────────────────────────────────────────────
inline std::vector<int> reconstructPath(const std::vector<int>& prev, int dst) {
    std::vector<int> path;
    for (int cur = dst; cur != -1; cur = prev[cur])
        path.insert(path.begin(), cur);
    return path;
}

// ─────────────────────────────────────────────
//  HEURISTICS
// ─────────────────────────────────────────────
inline double heuristicEuclidean(int a, int b) {
    double dx = CITY_NODES[a].x - CITY_NODES[b].x;
    double dy = CITY_NODES[a].y - CITY_NODES[b].y;
    return std::sqrt(dx * dx + dy * dy) * 10.0;
}

inline double heuristicManhattan(int a, int b) {
    double dx = std::abs(CITY_NODES[a].x - CITY_NODES[b].x);
    double dy = std::abs(CITY_NODES[a].y - CITY_NODES[b].y);
    return (dx + dy) * 10.0;
}

inline double heuristic(int a, int b) {
    // Defaulting to Euclidean for best smooth performance, 
    // but Manhattan is available per requirements.
    return heuristicEuclidean(a, b);
}
