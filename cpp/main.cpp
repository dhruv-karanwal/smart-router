/*
 * main.cpp
 * Smart Emergency Route Optimization System -- C++ Driver
 *
 * Connects:
 *   graph.h          - shared city data, adjacency list, utilities
 *   dijkstra.h       - Dijkstra's shortest-path algorithm
 *   astar.h          - A* heuristic search
 *   bellman_ford.h   - Bellman-Ford relaxation algorithm
 *   floyd_warshall.h - Floyd-Warshall all-pairs DP
 *
 * Build (g++):
 *   g++ -std=c++14 -O2 -o route_optimizer main.cpp
 *
 * Human-readable mode:
 *   ./route_optimizer              (interactive)
 *   ./route_optimizer 1 12         (Fire Station A -> South Terminal)
 *
 * JSON mode (used by Node.js server):
 *   ./route_optimizer --json <src> <dst> <algo>
 *   ./route_optimizer --json 1 12 dijkstra
 *   ./route_optimizer --json 1 12 astar
 *   ./route_optimizer --json 1 12 bellman
 *   ./route_optimizer --json 1 12 floyd
 *   ./route_optimizer --json 1 12 all
 */

#include <iostream>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <climits>

#include "graph.h"
#include "dijkstra.h"
#include "astar.h"
#include "bellman_ford.h"
#include "floyd_warshall.h"

// ─────────────────────────────────────────────────────────
//  Terminal colours (human-readable mode only)
// ─────────────────────────────────────────────────────────
#define RESET   "\033[0m"
#define BOLD    "\033[1m"
#define CYAN    "\033[36m"
#define GREEN   "\033[32m"
#define YELLOW  "\033[33m"
#define MAGENTA "\033[35m"
#define RED     "\033[31m"
#define DIM     "\033[2m"

// ─────────────────────────────────────────────────────────
//  JSON helpers
// ─────────────────────────────────────────────────────────

// Escape a string for embedding in JSON (handles backslash & double-quote)
static std::string jsonStr(const std::string& s) {
    std::string out = "\"";
    for (char c : s) {
        if (c == '"')  out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else out += c;
    }
    out += '"';
    return out;
}

// Serialise one AlgoResult to a JSON object string
// key = algo name ("dijkstra" / "astar" / "bellman" / "floyd")
static std::string algoToJson(const std::string& key, const AlgoResult& r, int dst) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(4);

    o << "{";
    o << "\"algo\":" << jsonStr(key) << ",";

    double d = r.dist[dst];
    if (d == INF) o << "\"dist\":null,";
    else          o << "\"dist\":" << std::setprecision(4) << d << ",";

    // path node IDs
    o << "\"path\":[";
    for (int i = 0; i < (int)r.path.size(); ++i) {
        if (i) o << ",";
        o << r.path[i];
    }
    o << "],";

    // path node names
    o << "\"pathNames\":[";
    for (int i = 0; i < (int)r.path.size(); ++i) {
        if (i) o << ",";
        o << jsonStr(CITY_NODES[r.path[i]].name);
    }
    o << "],";

    o << "\"nodesExplored\":" << r.nodesExplored << ",";
    o << "\"execTimeMs\":"    << std::setprecision(6) << r.execTimeMs;
    o << "}";
    return o.str();
}

// ─────────────────────────────────────────────────────────
//  JSON mode entry point
// ─────────────────────────────────────────────────────────
static int runJson(int src, int dst, const std::string& algo) {
    const AdjList G = buildGraph();

    if (algo == "all") {
        AlgoResult dR = dijkstra(G, src, dst);
        AlgoResult aR = aStar(G, src, dst);
        AlgoResult bR = bellmanFord(src, dst);
        AlgoResult fR = floydWarshall(src, dst);

        std::cout << "{";
        std::cout << "\"dijkstra\":"  << algoToJson("dijkstra",  dR, dst) << ",";
        std::cout << "\"astar\":"     << algoToJson("astar",     aR, dst) << ",";
        std::cout << "\"bellman\":"   << algoToJson("bellman",   bR, dst) << ",";
        std::cout << "\"floyd\":"     << algoToJson("floyd",     fR, dst);
        std::cout << "}" << std::endl;
        return 0;
    }

    AlgoResult r;
    if      (algo == "dijkstra") r = dijkstra(G, src, dst);
    else if (algo == "astar")    r = aStar(G,  src, dst);
    else if (algo == "bellman")  r = bellmanFord(src, dst);
    else if (algo == "floyd")    r = floydWarshall(src, dst);
    else {
        std::cerr << "{\"error\":\"Unknown algorithm: " << algo << "\"}" << std::endl;
        return 1;
    }

    std::cout << algoToJson(algo, r, dst) << std::endl;
    return 0;
}

// ─────────────────────────────────────────────────────────
//  Human-readable helpers
// ─────────────────────────────────────────────────────────
static void printDivider(int width = 70) {
    std::cout << std::string(width, '-') << "\n";
}

static void printPath(const std::vector<int>& path) {
    if (path.empty()) { std::cout << "(no path)\n"; return; }
    for (int i = 0; i < (int)path.size(); ++i) {
        if (i) std::cout << " -> ";
        std::cout << CITY_NODES[path[i]].name;
    }
    std::cout << "\n";
}

static void listNodes() {
    std::cout << BOLD << "\n  City Nodes\n" << RESET;
    printDivider();
    for (int i = 0; i < N; ++i)
        std::cout << "  [" << std::setw(2) << CITY_NODES[i].id << "]  "
                  << CITY_NODES[i].name
                  << DIM << "  (" << CITY_NODES[i].type << ")" << RESET << "\n";
    printDivider();
}

static void runComparison(int src, int dst) {
    const AdjList G = buildGraph();

    std::cout << BOLD << CYAN
              << "\n  +==========================================================+\n"
              << "  |  Smart Emergency Route Optimization -- Algorithm Compare  |\n"
              << "  +==========================================================+\n"
              << RESET;

    std::cout << "\n  Route:  "
              << BOLD << CITY_NODES[src].name << RESET
              << "  ->  "
              << BOLD << CITY_NODES[dst].name << RESET
              << "\n\n";

    AlgoResult dRes = dijkstra(G, src, dst);
    AlgoResult aRes = aStar(G, src, dst);
    AlgoResult bRes = bellmanFord(src, dst);
    AlgoResult fRes = floydWarshall(src, dst);

    struct Entry { std::string name; AlgoResult result; std::string color; };
    std::vector<Entry> entries = {
        {"Dijkstra",       dRes, GREEN},
        {"A* Search",      aRes, RED},
        {"Bellman-Ford",   bRes, MAGENTA},
        {"Floyd-Warshall", fRes, YELLOW},
    };

    std::cout << BOLD
              << "  +------------------+--------------+---------------+--------------+\n"
              << "  | Algorithm        | Distance(km) | Nodes Explored|  Time (ms)   |\n"
              << "  +------------------+--------------+---------------+--------------+\n"
              << RESET;

    double bestDist = INF, bestTime = INF;
    int    bestNodes = INT_MAX;
    for (int i = 0; i < (int)entries.size(); ++i) {
        if (entries[i].result.dist[dst]     < bestDist)  bestDist  = entries[i].result.dist[dst];
        if (entries[i].result.execTimeMs    < bestTime)  bestTime  = entries[i].result.execTimeMs;
        if (entries[i].result.nodesExplored < bestNodes) bestNodes = entries[i].result.nodesExplored;
    }

    for (int i = 0; i < (int)entries.size(); ++i) {
        Entry& e = entries[i];
        std::ostringstream ds, ms_str;
        ds     << std::fixed << std::setprecision(2) << e.result.dist[dst] << " km";
        ms_str << std::fixed << std::setprecision(4) << e.result.execTimeMs;
        std::cout << "  | " << e.color << BOLD << std::left << std::setw(16) << e.name << RESET
                  << " | " << std::right << std::setw(12) << ds.str()
                  << " | " << std::setw(13) << e.result.nodesExplored
                  << " | " << std::setw(12) << ms_str.str() << " |\n";
    }

    std::cout << BOLD
              << "  +------------------+--------------+---------------+--------------+\n"
              << RESET;

    std::cout << "\n";
    for (int i = 0; i < (int)entries.size(); ++i) {
        std::cout << "  " << entries[i].color << BOLD << entries[i].name << RESET << " path:\n    ";
        printPath(entries[i].result.path);
    }

    int fastI = 0, fewestI = 0;
    for (int i = 1; i < (int)entries.size(); ++i) {
        if (entries[i].result.execTimeMs    < entries[fastI].result.execTimeMs)    fastI   = i;
        if (entries[i].result.nodesExplored < entries[fewestI].result.nodesExplored) fewestI = i;
    }

    std::cout << "\n" << BOLD << "  * Summary\n" << RESET;
    printDivider();
    std::cout << "  Fastest algorithm : " << GREEN << BOLD << entries[fastI].name   << RESET
              << "  (" << std::fixed << std::setprecision(4) << entries[fastI].result.execTimeMs << " ms)\n";
    std::cout << "  Fewest nodes      : " << CYAN  << BOLD << entries[fewestI].name << RESET
              << "  (" << entries[fewestI].result.nodesExplored << " nodes)\n";
    std::cout << "  Optimal distance  : " << std::fixed << std::setprecision(2) << bestDist << " km\n";
    printDivider();
}

// ─────────────────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────────────────
int main(int argc, char* argv[]) {

    // ── JSON mode: --json <src> <dst> <algo> ──────────────
    if (argc >= 2 && std::string(argv[1]) == "--json") {
        if (argc != 5) {
            std::cerr << "{\"error\":\"Usage: route_optimizer --json <src> <dst> <algo>\"}" << std::endl;
            return 1;
        }
        int src = std::stoi(argv[2]);
        int dst = std::stoi(argv[3]);
        std::string algo = argv[4];
        if (src < 0 || src >= N || dst < 0 || dst >= N) {
            std::cerr << "{\"error\":\"Node IDs must be in range 0 to " << N - 1 << "\"}" << std::endl;
            return 1;
        }
        if (src == dst) {
            std::cerr << "{\"error\":\"Source and destination must differ.\"}" << std::endl;
            return 1;
        }
        return runJson(src, dst, algo);
    }

    // ── Human-readable mode ────────────────────────────────
    int src = -1, dst = -1;
    if (argc == 3) {
        src = std::stoi(argv[1]);
        dst = std::stoi(argv[2]);
    } else {
        listNodes();
        std::cout << "  Enter source node ID      : ";
        std::cin  >> src;
        std::cout << "  Enter destination node ID : ";
        std::cin  >> dst;
    }

    if (src < 0 || src >= N || dst < 0 || dst >= N) {
        std::cerr << "  [Error] Node IDs must be in range 0 to " << N - 1 << "\n";
        return 1;
    }
    if (src == dst) {
        std::cerr << "  [Error] Source and destination must differ.\n";
        return 1;
    }

    runComparison(src, dst);
    return 0;
}
