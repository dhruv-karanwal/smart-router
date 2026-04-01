/**
 * Smart Emergency Route Optimization System
 * app.js — Algorithms, Canvas Visualization, Charts, Comparison Dashboard
 *
 * When served via server.js (node server.js → localhost:3000) the
 * Calculate and Compare buttons call the Node.js /api/* endpoints which
 * spawn the real compiled C++ binary for every result.
 * If the server is not running (file:// mode) the JS implementations are
 * used automatically as a fallback.
 */

// true when running via the Node.js server (same origin, not file://)
const SERVER_MODE = window.location.protocol !== 'file:';

/* ===================================================
   CITY GRAPH DATA
   =================================================== */
const CITY_NODES = [
    { id: 0, name: 'Central Hospital', x: 0.50, y: 0.15, type: 'hospital' },
    { id: 1, name: 'Fire Station A', x: 0.15, y: 0.30, type: 'fire' },
    { id: 2, name: 'Police HQ', x: 0.80, y: 0.28, type: 'police' },
    { id: 3, name: 'Market Square', x: 0.35, y: 0.40, type: 'civilian' },
    { id: 4, name: 'University Gate', x: 0.65, y: 0.42, type: 'civilian' },
    { id: 5, name: 'Airport Terminal', x: 0.20, y: 0.60, type: 'civilian' },
    { id: 6, name: 'Tech Park', x: 0.50, y: 0.55, type: 'civilian' },
    { id: 7, name: 'Riverside Bridge', x: 0.80, y: 0.58, type: 'civilian' },
    { id: 8, name: 'Eastgate Mall', x: 0.90, y: 0.40, type: 'civilian' },
    { id: 9, name: 'North Station', x: 0.35, y: 0.20, type: 'train' },
    { id: 10, name: 'West Junction', x: 0.08, y: 0.50, type: 'civilian' },
    { id: 11, name: 'City Hall', x: 0.62, y: 0.25, type: 'civilian' },
    { id: 12, name: 'South Terminal', x: 0.50, y: 0.80, type: 'train' },
    { id: 13, name: 'Industrial Zone', x: 0.22, y: 0.75, type: 'civilian' },
    { id: 14, name: 'Park District', x: 0.72, y: 0.72, type: 'civilian' },
    { id: 15, name: 'Harbor Gate', x: 0.88, y: 0.80, type: 'civilian' },
];

const CITY_EDGES = [
    [0, 9, 3.2], [0, 11, 2.8], [0, 1, 5.6], [0, 2, 4.1],
    [1, 9, 3.0], [1, 3, 4.2], [1, 10, 3.5],
    [2, 11, 3.3], [2, 8, 2.9], [2, 4, 4.0],
    [3, 9, 2.7], [3, 4, 4.5], [3, 6, 3.8], [3, 5, 4.6],
    [4, 11, 2.5], [4, 6, 2.9], [4, 7, 3.7],
    [5, 10, 2.8], [5, 6, 4.0], [5, 13, 3.2],
    [6, 7, 3.5], [6, 12, 3.4],
    [7, 8, 3.0], [7, 14, 2.6],
    [12, 13, 4.1], [12, 14, 3.3],
    [13, 10, 4.0],
    [14, 15, 2.4], [8, 15, 4.2],
];

const N = CITY_NODES.length;

function buildGraph() {
    const g = {};
    CITY_NODES.forEach(n => { g[n.id] = []; });
    CITY_EDGES.forEach(([a, b, w]) => { g[a].push({ to: b, weight: w }); g[b].push({ to: a, weight: w }); });
    return g;
}
const GRAPH = buildGraph();

/* ===================================================
   MIN-HEAP
   =================================================== */
class MinHeap {
    constructor() { this.heap = []; }
    push(item) { this.heap.push(item); this._up(this.heap.length - 1); }
    pop() {
        const top = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) { this.heap[0] = last; this._down(0); }
        return top;
    }
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.heap[p].cost <= this.heap[i].cost) break;
            [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]]; i = p;
        }
    }
    _down(i) {
        const n = this.heap.length;
        while (true) {
            let m = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.heap[l].cost < this.heap[m].cost) m = l;
            if (r < n && this.heap[r].cost < this.heap[m].cost) m = r;
            if (m === i) break;
            [this.heap[m], this.heap[i]] = [this.heap[i], this.heap[m]]; i = m;
        }
    }
    get size() { return this.heap.length; }
}

/* ===================================================
   ALGORITHMS
   =================================================== */

function heuristic(a, b) {
    const na = CITY_NODES[a], nb = CITY_NODES[b];
    return Math.sqrt((na.x - nb.x) ** 2 + (na.y - nb.y) ** 2) * 10;
}

function dijkstra(src, dst) {
    const t0 = performance.now();
    const dist = Array(N).fill(Infinity);
    const prev = Array(N).fill(-1);
    const explored = new Set();
    dist[src] = 0;
    const pq = new MinHeap();
    pq.push({ cost: 0, node: src });
    while (pq.size > 0) {
        const { cost, node } = pq.pop();
        if (explored.has(node)) continue;
        explored.add(node);
        if (node === dst) break;
        for (const { to, weight } of GRAPH[node]) {
            const nc = cost + weight;
            if (nc < dist[to]) { dist[to] = nc; prev[to] = node; pq.push({ cost: nc, node: to }); }
        }
    }
    return { dist, prev, explored, nodesExplored: explored.size, execTime: performance.now() - t0 };
}

function aStar(src, dst) {
    const t0 = performance.now();
    const gScore = Array(N).fill(Infinity);
    const fScore = Array(N).fill(Infinity);
    const prev = Array(N).fill(-1);
    const explored = new Set();
    gScore[src] = 0; fScore[src] = heuristic(src, dst);
    const pq = new MinHeap();
    pq.push({ cost: fScore[src], node: src });
    while (pq.size > 0) {
        const { node } = pq.pop();
        if (explored.has(node)) continue;
        explored.add(node);
        if (node === dst) break;
        for (const { to, weight } of GRAPH[node]) {
            const tg = gScore[node] + weight;
            if (tg < gScore[to]) {
                prev[to] = node; gScore[to] = tg; fScore[to] = tg + heuristic(to, dst);
                pq.push({ cost: fScore[to], node: to });
            }
        }
    }
    return { dist: gScore, prev, explored, nodesExplored: explored.size, execTime: performance.now() - t0 };
}

function bellmanFord(src, dst) {
    const t0 = performance.now();
    const dist = Array(N).fill(Infinity);
    const prev = Array(N).fill(-1);
    dist[src] = 0;
    const edges = [];
    CITY_EDGES.forEach(([a, b, w]) => { edges.push([a, b, w], [b, a, w]); });
    for (let i = 0; i < N - 1; i++) {
        for (const [u, v, w] of edges) {
            if (dist[u] !== Infinity && dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
        }
    }
    const explored = new Set(dist.map((d, i) => d < Infinity ? i : -1).filter(i => i >= 0));
    return { dist, prev, explored, nodesExplored: explored.size, execTime: performance.now() - t0 };
}

function floydWarshall(src, dst) {
    const t0 = performance.now();
    // Build V×V distance + next matrix
    const INF = Infinity;
    const d = Array.from({ length: N }, (_, i) => Array(N).fill(INF));
    const next = Array.from({ length: N }, (_, i) => Array(N).fill(-1));
    for (let i = 0; i < N; i++) { d[i][i] = 0; }
    CITY_EDGES.forEach(([a, b, w]) => {
        d[a][b] = w; d[b][a] = w;
        next[a][b] = b; next[b][a] = a;
    });
    for (let k = 0; k < N; k++) {
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (d[i][k] !== INF && d[k][j] !== INF && d[i][k] + d[k][j] < d[i][j]) {
                    d[i][j] = d[i][k] + d[k][j];
                    next[i][j] = next[i][k];
                }
            }
        }
    }
    // Reconstruct path
    const prev = Array(N).fill(-1);
    if (next[src][dst] !== -1) {
        let cur = src;
        while (cur !== dst) {
            const nx = next[cur][dst];
            prev[nx] = cur;
            cur = nx;
        }
    }
    const dist = d[src]; // distances from src to all nodes
    return { dist, prev, explored: new Set(Array.from({ length: N }, (_, i) => i)), nodesExplored: N, execTime: performance.now() - t0 };
}

function reconstructPath(prev, dst) {
    const path = []; let cur = dst;
    while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
    return path;
}

const ALGO_META = {
    dijkstra: { fn: dijkstra, name: 'Dijkstra', color: '#457B9D', prefix: 'd' },
    astar: { fn: aStar, name: 'A* Search', color: '#E63946', prefix: 'a' },
    bellman: { fn: bellmanFord, name: 'Bellman-Ford', color: '#7c3aed', prefix: 'b' },
    floyd: { fn: floydWarshall, name: 'Floyd-Warshall', color: '#f97316', prefix: 'f' },
};

function algoDisplayName(key) { return ALGO_META[key]?.name || key; }

/* ===================================================
   CANVAS RENDERING
   =================================================== */
const NODE_COLORS = { hospital: '#E63946', fire: '#f97316', police: '#2563eb', train: '#7c3aed', civilian: '#1D3557' };

function getNodePos(node, W, H, pad = 52) {
    return { x: pad + node.x * (W - 2 * pad), y: pad + node.y * (H - 2 * pad) };
}

function drawGraph(canvas, { pathNodes = [], exploredNodes = new Set(), startNode = -1, endNode = -1, animProgress = 1, scale = 1, pathColor = '#E63946' } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f8fafc'); bg.addColorStop(1, '#eef2f7');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Edges
    CITY_EDGES.forEach(([a, b, w]) => {
        const pa = getNodePos(CITY_NODES[a], W, H);
        const pb = getNodePos(CITY_NODES[b], W, H);
        const onPath = pathNodes.includes(a) && pathNodes.includes(b) &&
            Math.abs(pathNodes.indexOf(a) - pathNodes.indexOf(b)) === 1;
        const isExp = exploredNodes.has(a) || exploredNodes.has(b);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        if (onPath) {
            ctx.strokeStyle = pathColor; ctx.lineWidth = 4; ctx.setLineDash([]);
            ctx.shadowColor = pathColor; ctx.shadowBlur = 10;
        } else if (isExp) {
            ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = 'rgba(29,53,87,0.13)'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.shadowBlur = 0;
        }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        // Weight label
        if (scale >= 0.9) {
            const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
            ctx.fillStyle = onPath ? '#7c2d12' : '#94a3b8';
            ctx.font = `500 ${Math.round(10 * scale)}px Inter,sans-serif`;
            ctx.textAlign = 'center'; ctx.fillText(`${w}`, mx, my - 4);
        }
    });

    // Animated path
    if (pathNodes.length >= 2 && animProgress < 1) {
        const total = pathNodes.length - 1;
        const drawn = Math.floor(animProgress * total);
        for (let i = 0; i <= drawn && i < total; i++) {
            const pa = getNodePos(CITY_NODES[pathNodes[i]], W, H);
            const pb = getNodePos(CITY_NODES[pathNodes[i + 1]], W, H);
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y);
            if (i === drawn) {
                const t = (animProgress * total) - drawn;
                ctx.lineTo(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t);
            } else { ctx.lineTo(pb.x, pb.y); }
            ctx.strokeStyle = pathColor; ctx.lineWidth = 5;
            ctx.shadowColor = pathColor; ctx.shadowBlur = 16;
            ctx.stroke(); ctx.shadowBlur = 0;
        }
    }

    // Nodes
    CITY_NODES.forEach(node => {
        const { x, y } = getNodePos(node, W, H);
        const isStart = node.id === startNode, isEnd = node.id === endNode;
        const onPath = pathNodes.includes(node.id);
        const exp = exploredNodes.has(node.id);
        const r = 8;
        if (isStart || isEnd || onPath) {
            ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2);
            ctx.fillStyle = isStart ? 'rgba(22,163,74,0.18)' : isEnd ? 'rgba(245,158,11,0.18)' : `${pathColor}22`; ctx.fill();
        }
        if (exp && !onPath) {
            ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(59,130,246,0.35)'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isStart ? '#16a34a' : isEnd ? '#f59e0b' : onPath ? pathColor : exp ? '#3b82f6' : (NODE_COLORS[node.type] || '#1D3557');
        ctx.shadowColor = (isStart || isEnd || onPath) ? ctx.fillStyle : 'transparent';
        ctx.shadowBlur = (isStart || isEnd || onPath) ? 10 : 0;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        const shortName = node.name.split(' ').slice(0, 2).join(' ');
        ctx.fillStyle = (onPath || isStart || isEnd) ? '#1a1a2e' : '#4a6285';
        ctx.font = `${(onPath || isStart || isEnd) ? '600' : '500'} 10px Inter,sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText(shortName, x, y + r + 13);
    });
}

function drawHeroMap() {
    const canvas = document.getElementById('heroMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(13,27,42,0.6)'; ctx.fillRect(0, 0, W, H);
    const pad = 36;
    CITY_EDGES.forEach(([a, b]) => {
        const pa = getNodePos(CITY_NODES[a], W, H, pad);
        const pb = getNodePos(CITY_NODES[b], W, H, pad);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = 'rgba(100,150,200,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    });
    const demoPath = [1, 3, 4, 6, 12];
    for (let i = 0; i < demoPath.length - 1; i++) {
        const pa = getNodePos(CITY_NODES[demoPath[i]], W, H, pad);
        const pb = getNodePos(CITY_NODES[demoPath[i + 1]], W, H, pad);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = '#E63946'; ctx.lineWidth = 2.5;
        ctx.shadowColor = '#E63946'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    }
    CITY_NODES.forEach(node => {
        const { x, y } = getNodePos(node, W, H, pad);
        const onPath = demoPath.includes(node.id);
        const r = onPath ? 5 : 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = node.id === demoPath[0] ? '#16a34a' : node.id === demoPath[demoPath.length - 1] ? '#f59e0b' : onPath ? '#E63946' : 'rgba(100,150,200,0.5)';
        ctx.shadowBlur = onPath ? 8 : 0; ctx.shadowColor = onPath ? ctx.fillStyle : 'transparent';
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    });
}

function animatePath(canvas, pathNodes, explored, startNode, endNode, pathColor, duration = 1300) {
    const t0 = performance.now();
    function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        drawGraph(canvas, { pathNodes, exploredNodes: explored, startNode, endNode, animProgress: t, scale: mapScale, pathColor });
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

/* ===================================================
   CHART.JS CHARTS
   =================================================== */
let timeChart = null, nodesChart = null;

const CHART_COLORS = {
    dijkstra: '#457B9D', astar: '#E63946', bellman: '#7c3aed', floyd: '#f97316'
};
const CHART_LABELS = { dijkstra: 'Dijkstra', astar: 'A* Search', bellman: 'Bellman-Ford', floyd: 'Floyd-Warshall' };

function initCharts() {
    const chartDefaults = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: { duration: 800, easing: 'easeOutQuart' },
    };
    const gridColor = 'rgba(29,53,87,0.07)';

    timeChart = new Chart(document.getElementById('timeChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 6, borderSkipped: false }] },
        options: {
            ...chartDefaults,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#4a6285', font: { family: 'Inter', size: 12 } } },
                y: { grid: { color: gridColor }, ticks: { color: '#4a6285', font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'Time (ms)', color: '#7a92b0', font: { size: 11 } } }
            }
        }
    });

    nodesChart = new Chart(document.getElementById('nodesChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 6, borderSkipped: false }] },
        options: {
            ...chartDefaults,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#4a6285', font: { family: 'Inter', size: 12 } } },
                y: { grid: { color: gridColor }, ticks: { color: '#4a6285', font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'Nodes', color: '#7a92b0', font: { size: 11 } } }
            }
        }
    });
}

function updateCharts(results) {
    const keys = Object.keys(results);
    const labels = keys.map(k => CHART_LABELS[k]);
    const times = keys.map(k => parseFloat(results[k].execTime.toFixed(3)));
    const nodes = keys.map(k => results[k].nodesExplored);
    const colors = keys.map(k => CHART_COLORS[k]);

    [timeChart, nodesChart].forEach(c => {
        c.data.labels = labels;
        c.data.datasets[0].backgroundColor = colors.map(c => c + 'cc');
        c.data.datasets[0].borderColor = colors;
        c.data.datasets[0].borderWidth = 1.5;
    });
    timeChart.data.datasets[0].data = times;
    nodesChart.data.datasets[0].data = nodes;
    timeChart.update(); nodesChart.update();
}

/* ===================================================
   GLOBAL STATE
   =================================================== */
let currentAlgo = 'dijkstra';
let mapScale = 1.0;
let currentPathResult = null;
let comparisonResults = {}; // key: algo → result data
let vizAlgo = 'dijkstra';
let compSrc = -1, compDst = -1;

/* ===================================================
   ROUTE PLANNER LOGIC
   =================================================== */
function populateDropdowns() {
    ['startLocation', 'endLocation'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        CITY_NODES.forEach(n => sel.add(new Option(n.name, n.id)));
        sel.value = idx === 0 ? 1 : 12;
    });
}

async function runCalculation() {
    const src = parseInt(document.getElementById('startLocation').value);
    const dst = parseInt(document.getElementById('endLocation').value);
    if (isNaN(src) || isNaN(dst)) { alert('Please select both start and destination.'); return; }
    if (src === dst) { alert('Start and destination must be different.'); return; }

    const btn = document.getElementById('calculateBtn');
    btn.classList.add('btn-loading'); btn.disabled = true;

    const meta = ALGO_META[currentAlgo];

    try {
        let result;

        if (SERVER_MODE) {
            // ── C++ path via Node.js server ────────────────────────────
            const algoKey = currentAlgo === 'astar' ? 'astar'
                : currentAlgo === 'bellman' ? 'bellman'
                    : currentAlgo === 'floyd' ? 'floyd'
                        : 'dijkstra';

            const res = await fetch('/api/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src, dst, algo: algoKey })
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            // Normalise C++ JSON response to the same shape the UI expects
            const dist = Array(N).fill(Infinity);
            dist[dst] = data.dist;
            // Build prev[] from path array
            const prev = Array(N).fill(-1);
            const path = data.path || [];
            for (let i = 1; i < path.length; i++) prev[path[i]] = path[i - 1];

            result = {
                dist, prev,
                explored: new Set(path),
                nodesExplored: data.nodesExplored,
                execTime: data.execTimeMs,
                _path: path   // pre-built path from C++
            };
        } else {
            // ── JS fallback (file:// mode) ─────────────────────────────
            result = meta.fn(src, dst);
        }

        const pathNodes = result._path || reconstructPath(result.prev, dst);
        currentPathResult = { pathNodes, explored: result.explored, src, dst, color: meta.color };

        document.getElementById('canvasOverlay').classList.add('hidden');
        animatePath(document.getElementById('mainMapCanvas'), pathNodes, result.explored, src, dst, meta.color, 1400);

        const distKm = (result.dist[dst] === Infinity ? '∞' : result.dist[dst].toFixed(1));
        const timeMin = result.dist[dst] === Infinity ? '—' : Math.ceil(result.dist[dst] / 60 * 60);
        document.getElementById('resultDistance').textContent = `${distKm} km`;
        document.getElementById('resultTime').textContent = `~${timeMin} min`;
        document.getElementById('resultNodes').textContent = result.nodesExplored;
        document.getElementById('resultAlgo').textContent = meta.name;
        document.getElementById('resultCard').classList.add('visible');
        document.getElementById('routeLength').textContent = `${distKm} km`;
        document.getElementById('selectedAlgo').textContent = meta.name;
        document.getElementById('mapInfo').textContent =
            `Path: ${CITY_NODES[src].name} → ${CITY_NODES[dst].name} | ${meta.name} | ${distKm} km` +
            (SERVER_MODE ? ' [C++]' : ' [JS]');

        const pathEl = document.getElementById('resultPath');
        pathEl.innerHTML = '';
        pathNodes.forEach(nid => {
            const s = document.createElement('span'); s.className = 'path-node';
            s.textContent = CITY_NODES[nid].name.split(' ')[0]; pathEl.appendChild(s);
        });

        compSrc = src; compDst = dst;
        document.getElementById('selRouteInfo').innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Route: <strong style="color:var(--navy)">${CITY_NODES[src].name}</strong> → <strong style="color:var(--navy)">${CITY_NODES[dst].name}</strong>`;

    } catch (err) {
        console.error('Route error:', err);
        alert('Error running algorithm: ' + (err.message || JSON.stringify(err)));
    }

    btn.classList.remove('btn-loading'); btn.disabled = false;
}

function resetMap() {
    currentPathResult = null;
    drawGraph(document.getElementById('mainMapCanvas'), { scale: mapScale });
    document.getElementById('canvasOverlay').classList.remove('hidden');
    document.getElementById('resultCard').classList.remove('visible');
    ['resultDistance', 'resultTime', 'resultNodes', 'resultAlgo'].forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('resultPath').innerHTML = '';
    document.getElementById('routeLength').textContent = '— km';
    document.getElementById('selectedAlgo').textContent = '—';
    document.getElementById('mapInfo').textContent = 'City graph with 16 intersection nodes and 24 road edges';
}

/* ===================================================
   COMPARISON DASHBOARD LOGIC
   =================================================== */
async function runComparison() {
    const src = compSrc >= 0 ? compSrc : parseInt(document.getElementById('startLocation').value);
    const dst = compDst >= 0 ? compDst : parseInt(document.getElementById('endLocation').value);
    if (isNaN(src) || isNaN(dst) || src === dst) {
        alert('Please calculate a route in the Route Planner first, or select valid start/destination.'); return;
    }

    const checkedAlgos = [];
    document.querySelectorAll('.checkbox-list input[type=checkbox]:checked').forEach(cb => checkedAlgos.push(cb.value));
    if (checkedAlgos.length === 0) { alert('Please select at least one algorithm.'); return; }

    const btn = document.getElementById('runComparisonBtn');
    btn.classList.add('btn-loading'); btn.disabled = true;

    comparisonResults = {};
    const allKeys = ['dijkstra', 'astar', 'bellman', 'floyd'];

    // Reset table cells
    allKeys.forEach(k => {
        const s = document.getElementById(`status-${k}`);
        if (s) { s.textContent = checkedAlgos.includes(k) ? 'Running…' : 'Skipped'; s.className = `badge-status ${checkedAlgos.includes(k) ? 'status-running' : 'status-skipped'}`; }
        const { prefix } = ALGO_META[k];
        ['nodes', 'time', 'path', 'result'].forEach(col => {
            const el = document.getElementById(`td-${prefix}-${col}`);
            if (el) el.textContent = checkedAlgos.includes(k) ? '…' : '—';
        });
    });

    try {
        let rawResults = {};

        if (SERVER_MODE) {
            // ── Single C++ call returns all results at once ─────────────
            const res = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src, dst, algos: checkedAlgos })
            });
            if (!res.ok) throw new Error(await res.text());
            rawResults = await res.json(); // { dijkstra: {...}, astar: {...}, ... }
        } else {
            // ── JS fallback ──────────────────────────────────────────────
            for (const key of checkedAlgos) {
                const meta = ALGO_META[key];
                rawResults[key] = meta.fn(src, dst);
                rawResults[key]._jsResult = true;
            }
        }

        // Populate table row by row (with a small stagger for visual effect)
        for (let i = 0; i < checkedAlgos.length; i++) {
            const key = checkedAlgos[i];
            const data = rawResults[key];
            if (!data) continue;

            await new Promise(r => setTimeout(r, i * 200)); // stagger

            const meta = ALGO_META[key];
            const path = data.path || (data._jsResult ? reconstructPath(data.prev, dst) : []);
            const distKm = (data.dist === null || data.dist === undefined)
                ? (data._jsResult ? (data.dist?.[dst] === Infinity ? '∞' : `${data.dist?.[dst].toFixed(1)} km`) : '∞')
                : `${parseFloat(data.dist).toFixed(1)} km`;
            const pathStr = path.length > 1 ? path.map(n => CITY_NODES[n].name.split(' ')[0]).join('→') : '—';
            const timeMs = data._jsResult ? data.execTime.toFixed(3) : parseFloat(data.execTimeMs).toFixed(3);
            const nodesEx = data._jsResult ? data.nodesExplored : data.nodesExplored;

            const { prefix } = meta;
            const setCell = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setCell(`td-${prefix}-nodes`, nodesEx);
            setCell(`td-${prefix}-time`, `${timeMs} ms${SERVER_MODE ? ' [C++]' : ''}`);
            setCell(`td-${prefix}-path`, distKm);
            setCell(`td-${prefix}-result`, pathStr);
            const rEl = document.getElementById(`td-${prefix}-result`);
            if (rEl) rEl.title = pathStr;

            const s = document.getElementById(`status-${key}`);
            if (s) { s.textContent = '✓ Done'; s.className = 'badge-status status-done'; }

            // Build explored set from path for canvas visualisation
            const explored = new Set(path);

            // Build dist array for finishComparison
            const distVal = data._jsResult ? data.dist[dst] : parseFloat(data.dist);
            const distArr = Array(N).fill(Infinity); distArr[dst] = distVal;

            // Build prev[] from path
            const prev = Array(N).fill(-1);
            for (let pi = 1; pi < path.length; pi++) prev[path[pi]] = path[pi - 1];

            comparisonResults[key] = {
                dist: distArr, prev, explored, pathNodes: path,
                nodesExplored: nodesEx,
                execTime: parseFloat(timeMs),
                distKm, timeMs: parseFloat(timeMs), pathStr,
                color: meta.color, name: meta.name
            };
        }

        finishComparison(src, dst);
    } catch (err) {
        console.error('Comparison error:', err);
        alert('Error running comparison: ' + (err.message || JSON.stringify(err)));
    }

    btn.classList.remove('btn-loading'); btn.disabled = false;
}

function finishComparison(src, dst) {
    // Summary cards
    const keys = Object.keys(comparisonResults);
    const fastest = keys.reduce((a, b) => comparisonResults[a].execTime < comparisonResults[b].execTime ? a : b);
    const shortestDist = keys.reduce((a, b) => comparisonResults[a].dist[dst] < comparisonResults[b].dist[dst] ? a : b);
    document.getElementById('fastestAlgo').textContent = comparisonResults[fastest].name;
    document.getElementById('fastestTime').textContent = `${comparisonResults[fastest].execTime.toFixed(3)} ms`;
    document.getElementById('shortestDist').textContent = comparisonResults[shortestDist].distKm;

    // Charts
    updateCharts(comparisonResults);

    // Viz: show first checked algo
    document.getElementById('vizOverlay').classList.add('hidden');
    switchVizAlgo(Object.keys(comparisonResults)[0], src, dst);
}

function switchVizAlgo(key, src, dst) {
    if (!comparisonResults[key]) return;
    vizAlgo = key;
    const res = comparisonResults[key];
    const canvas = document.getElementById('vizMapCanvas');
    animatePath(canvas, res.pathNodes, res.explored, src || compSrc, dst || compDst, res.color, 900);

    // Update viz switcher active state
    document.querySelectorAll('.viz-algo-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vizalgo === key);
    });

    // Update info bar
    document.getElementById('vizAlgoName').textContent = res.name;
    document.getElementById('vizDistance').textContent = `Distance: ${res.distKm}`;
    document.getElementById('vizNodes').textContent = `Nodes explored: ${res.nodesExplored}`;
}

/* ===================================================
   NAVIGATION & UI SETUP
   =================================================== */
function setupNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinksEl = document.getElementById('navLinks');
    hamburger.addEventListener('click', () => navLinksEl.classList.toggle('open'));
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
        let cur = '';
        sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) cur = s.id; });
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === cur));
    });
    navLinks.forEach(l => l.addEventListener('click', () => navLinksEl.classList.remove('open')));
}

function setupAlgoSelector() {
    document.querySelectorAll('.algo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAlgo = btn.dataset.algo;
            document.getElementById('selectedAlgo').textContent = algoDisplayName(currentAlgo);
        });
    });
}

function setupZoom() {
    document.getElementById('zoomIn').addEventListener('click', () => {
        mapScale = Math.min(mapScale + 0.15, 1.8);
        redrawMain();
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        mapScale = Math.max(mapScale - 0.15, 0.5);
        redrawMain();
    });
}

function redrawMain() {
    const canvas = document.getElementById('mainMapCanvas');
    if (currentPathResult) {
        const { pathNodes, explored, src, dst, color } = currentPathResult;
        drawGraph(canvas, { pathNodes, exploredNodes: explored, startNode: src, endNode: dst, scale: mapScale, pathColor: color });
    } else {
        drawGraph(canvas, { scale: mapScale });
    }
}

function setupVizSwitcher() {
    document.querySelectorAll('.viz-algo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.vizalgo;
            if (comparisonResults[key]) switchVizAlgo(key, compSrc, compDst);
        });
    });
}

/* ===================================================
   CANVAS RESIZE OBSERVER
   =================================================== */
function observeCanvas(canvasId, ratio) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
        const w = canvas.parentElement.offsetWidth;
        canvas.width = w;
        canvas.height = Math.round(w / ratio);
        if (canvasId === 'mainMapCanvas') redrawMain();
        else if (canvasId === 'vizMapCanvas' && Object.keys(comparisonResults).length > 0) {
            switchVizAlgo(vizAlgo, compSrc, compDst);
        } else {
            drawGraph(canvas);
        }
    });
    ro.observe(canvas.parentElement);
}

/* ===================================================
   INIT
   =================================================== */
document.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    setupNavigation();
    setupAlgoSelector();
    setupZoom();
    setupVizSwitcher();
    initCharts();

    drawGraph(document.getElementById('mainMapCanvas'), { scale: mapScale });
    drawGraph(document.getElementById('vizMapCanvas'));
    drawHeroMap();

    observeCanvas('mainMapCanvas', 800 / 520);
    observeCanvas('vizMapCanvas', 900 / 460);

    document.getElementById('calculateBtn').addEventListener('click', runCalculation);
    document.getElementById('resetBtn').addEventListener('click', resetMap);
    document.getElementById('runComparisonBtn').addEventListener('click', runComparison);

    document.getElementById('startPlanningBtn').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('route-planner').scrollIntoView({ behavior: 'smooth' });
    });
});
