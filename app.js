/**
 * Smart Emergency Route Optimization System (Dashboard Version)
 * app.js — Algorithms, Canvas Visualization, Comparisons
 */

const SERVER_MODE = window.location.protocol !== 'file:';

// State to keep track of dynamic weights locally for map visualizer
let LOCAL_TRAFFIC_MULT = 1.0;
let LOCAL_BLOCKS = []; 

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

const BASE_EDGES = [
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

// For JS fallbacks
function buildGraph() {
    const g = {};
    CITY_NODES.forEach(n => { g[n.id] = []; });
    BASE_EDGES.forEach(([a, b, w]) => { 
        let currentWeight = w * LOCAL_TRAFFIC_MULT;
        const block = LOCAL_BLOCKS.find(blk => (blk[0]===a && blk[1]===b) || (blk[0]===b && blk[1]===a));
        if(block) currentWeight = Infinity;
        g[a].push({ to: b, weight: currentWeight }); 
        g[b].push({ to: a, weight: currentWeight }); 
    });
    return g;
}

function getEdgeDisplayWeight(u, v) {
    const edge = BASE_EDGES.find(([a,b]) => (a===u && b===v) || (a===v && b===u));
    if(!edge) return Infinity;
    const block = LOCAL_BLOCKS.find(blk => (blk[0]===u && blk[1]===v) || (blk[0]===v && blk[1]===u));
    if(block) return Infinity;
    return edge[2] * LOCAL_TRAFFIC_MULT;
}

/* ===================================================
   SYSTEM TICKER TIMER
   =================================================== */
function updateClock() {
    const now = new Date();
    document.getElementById('sysClock').textContent = 
        now.toTimeString().split(' ')[0] + "." + Math.floor(now.getMilliseconds()/100);
    requestAnimationFrame(updateClock);
}

/* ===================================================
   ALGORITHMS AND MIN-HEAP
   =================================================== */
class MinHeap {
    constructor() { this.heap = []; }
    push(item) { this.heap.push(item); this._up(this.heap.length - 1); }
    pop() {
        const top = this.heap[0], last = this.heap.pop();
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

function heuristic(a, b) {
    const na = CITY_NODES[a], nb = CITY_NODES[b];
    return Math.sqrt((na.x - nb.x) ** 2 + (na.y - nb.y) ** 2) * 10;
}

function dijkstra(src, dst) {
    const GRAPH = buildGraph();
    const t0 = performance.now();
    const dist = Array(N).fill(Infinity);
    const prev = Array(N).fill(-1);
    const explored = new Set();
    dist[src] = 0;
    const pq = new MinHeap(); pq.push({ cost: 0, node: src });
    while (pq.size > 0) {
        const { cost, node } = pq.pop();
        if (explored.has(node)) continue;
        explored.add(node);
        if (node === dst) break;
        for (const { to, weight } of GRAPH[node]) {
            if(weight === Infinity) continue;
            const nc = cost + weight;
            if (nc < dist[to]) { dist[to] = nc; prev[to] = node; pq.push({ cost: nc, node: to }); }
        }
    }
    return { dist, prev, explored, nodesExplored: explored.size, execTime: performance.now() - t0 };
}

function aStar(src, dst) {
    const GRAPH = buildGraph();
    const t0 = performance.now();
    const gScore = Array(N).fill(Infinity);
    const fScore = Array(N).fill(Infinity);
    const prev = Array(N).fill(-1);
    const explored = new Set();
    gScore[src] = 0; fScore[src] = heuristic(src, dst);
    const pq = new MinHeap(); pq.push({ cost: fScore[src], node: src });
    while (pq.size > 0) {
        const { node } = pq.pop();
        if (explored.has(node)) continue;
        explored.add(node);
        if (node === dst) break;
        for (const { to, weight } of GRAPH[node]) {
            if(weight === Infinity) continue;
            const tg = gScore[node] + weight;
            if (tg < gScore[to]) {
                prev[to] = node; gScore[to] = tg; fScore[to] = tg + heuristic(to, dst);
                pq.push({ cost: fScore[to], node: to });
            }
        }
    }
    return { dist: gScore, prev, explored, nodesExplored: explored.size, execTime: performance.now() - t0 };
}

// Basic stubs for JS fallback algorithms if node server dies
function bellmanFord(src, dst) { return dijkstra(src,dst); }
function floydWarshall(src, dst) { return dijkstra(src, dst); }

function reconstructPath(prev, dst) {
    const path = []; let cur = dst;
    while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
    return path;
}

const ALGO_META = {
    dijkstra: { fn: dijkstra, name: 'Dijkstra', color: '#007AFF', prefix: 'd' },
    astar: { fn: aStar, name: 'A* Search', color: '#FA3C5A', prefix: 'a' },
    bellman: { fn: bellmanFord, name: 'Bellman-Ford', color: '#FFCC00', prefix: 'b' },
    floyd: { fn: floydWarshall, name: 'Floyd', color: '#34C759', prefix: 'f' },
};

/* ===================================================
   CANVAS RENDERING (UPDATED FOR DASHBOARD)
   =================================================== */
const NODE_ICONS = { hospital: '🏥', fire: '🚒', police: '🚔', train: '🚉', civilian: '🏢' };

function getNodePos(node, W, H, pad = 50) {
    return { x: pad + node.x * (W - 2 * pad), y: pad + node.y * (H - 2 * pad) };
}

// Map edge weight to traffic layout 
function getEdgeStyle(weight) {
    if(weight === Infinity) return { color: '#4A5168', width: 2, dash: [4, 4] }; // blocked
    if(weight > 8) return { color: '#FA3C5A', width: 4, dash: [] }; // heavy red
    if(weight > 4) return { color: '#FFCC00', width: 3, dash: [] }; // med yellow
    return { color: '#34C759', width: 2, dash: [] }; // low traffic green
}

function drawGraph(canvas, { pathNodes = [], exploredNodes = new Set(), startNode = -1, endNode = -1, animProgress = 1, pathColor = '#007AFF' } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw Edges
    BASE_EDGES.forEach(([a, b]) => {
        const cw = getEdgeDisplayWeight(a, b);
        const style = getEdgeStyle(cw);
        const pa = getNodePos(CITY_NODES[a], W, H);
        const pb = getNodePos(CITY_NODES[b], W, H);
        
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = style.color; 
        ctx.lineWidth = style.width;
        ctx.setLineDash(style.dash);

        // Explored visuals
        if(exploredNodes.has(a) && exploredNodes.has(b) && !pathNodes.includes(a)) {
            ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255,255,255,0.2)';
        }
        
        ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        
        // Weight Label
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        ctx.fillStyle = cw === Infinity ? '#4A5168' : '#8E9BB0';
        ctx.font = '10px Inter'; ctx.textAlign = 'center';
        ctx.fillText(cw === Infinity ? 'X' : cw.toFixed(1), mx, my - 6);
    });

    // Draw Animated Optimal Path
    let ambuPos = null;
    if (pathNodes.length >= 2) {
        const total = pathNodes.length - 1;
        const drawn = Math.floor(animProgress * total);
        
        for (let i = 0; i <= drawn && i < total; i++) {
            const pa = getNodePos(CITY_NODES[pathNodes[i]], W, H);
            const pb = getNodePos(CITY_NODES[pathNodes[i + 1]], W, H);
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y);
            
            if (i === drawn) {
                const t = (animProgress * total) - drawn;
                const curX = pa.x + (pb.x - pa.x) * t;
                const curY = pa.y + (pb.y - pa.y) * t;
                ctx.lineTo(curX, curY);
                ambuPos = {x: curX, y: curY};
            } else { 
                ctx.lineTo(pb.x, pb.y); 
                if(i === drawn-1 && animProgress === 1) ambuPos = {x: pb.x, y: pb.y};
            }
            
            ctx.strokeStyle = pathColor; ctx.lineWidth = 6;
            ctx.shadowColor = pathColor; ctx.shadowBlur = 15;
            ctx.stroke(); ctx.shadowBlur = 0;
        }
    }

    // Nodes
    CITY_NODES.forEach(node => {
        const { x, y } = getNodePos(node, W, H);
        const isStart = node.id === startNode, isEnd = node.id === endNode;
        const onPath = pathNodes.includes(node.id);
        const r = 12;

        if (isStart || isEnd) {
            ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2);
            ctx.fillStyle = isStart ? 'rgba(250,60,90,0.2)' : 'rgba(52,199,89,0.2)'; 
            ctx.fill();
        }

        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isStart ? '#FA3C5A' : isEnd ? '#34C759' : '#1A233A';
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = onPath ? pathColor : 'rgba(255,255,255,0.4)';
        ctx.stroke();

        ctx.fillStyle = '#FFF'; ctx.font = '12px Inter';
        ctx.textAlign = 'center'; ctx.textBaseline='middle';
        ctx.fillText(NODE_ICONS[node.type] || '📍', x, y+1);
        
        const shortName = node.name.split(' ').slice(0, 2).join(' ');
        ctx.fillStyle = isStart ? '#FFF' : '#8E9BB0';
        ctx.font = '10px Inter';
        ctx.fillText(shortName, x, y + r + 10);
    });

    // Draw Ambulance animation icon
    if(ambuPos) {
        ctx.beginPath(); ctx.arc(ambuPos.x, ambuPos.y, 10, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.font = '14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🚑', ambuPos.x, ambuPos.y+1);
        ctx.shadowBlur = 0;
    }
}

function animatePath(canvas, pathNodes, explored, startNode, endNode, pathColor, duration = 2000) {
    const t0 = performance.now();
    function frame(now) {
        let t = Math.min((now - t0) / duration, 1);
        // easeInOutQuad
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        drawGraph(canvas, { pathNodes, exploredNodes: explored, startNode, endNode, animProgress: t, pathColor });
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

/* ===================================================
   GLOBAL STATE & SETUP
   =================================================== */
let currentAlgo = 'dijkstra';
let currentPathResult = null;

function populateDropdowns() {
    ['startLocation', 'endLocation'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        if(!sel) return;
        CITY_NODES.forEach(n => {
            const pre = n.type==='hospital'?'🏥 ':n.type==='fire'?'🚒 ': n.type==='police'?'🚔 ':'📍 ';
            sel.add(new Option(pre + n.name, n.id));
        });
        sel.value = idx === 0 ? 1 : 0; // default start at firestation, end at hospital
    });
}

function setupAlgoButtons() {
    document.querySelectorAll('.algo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAlgo = btn.dataset.algo;
            document.getElementById('resultAlgo').textContent = ALGO_META[currentAlgo].name;
            document.getElementById('resultAlgoReason').textContent = "Selected via Dispatch";
        });
    });
    const currBtn = document.querySelector(`.algo-btn[data-algo="${currentAlgo}"]`);
    if(currBtn) currBtn.classList.add('active');
}

/* ===================================================
   EXECUTION
   =================================================== */
async function runCalculation() {
    const src = parseInt(document.getElementById('startLocation').value);
    const dst = parseInt(document.getElementById('endLocation').value);
    if (isNaN(src) || isNaN(dst)) { alert('Select start and destination.'); return; }
    if (src === dst) { alert('Start and destination must be different.'); return; }

    const btn = document.getElementById('calculateBtn');
    btn.innerHTML = '⏳ Computing...'; btn.disabled = true;

    const meta = ALGO_META[currentAlgo];

    try {
        let result;
        if (SERVER_MODE) {
            const algoKey = currentAlgo;
            const res = await fetch('/api/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src, dst, algo: algoKey })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            
            const dist = Array(N).fill(Infinity);
            dist[dst] = data.dist;
            const prev = Array(N).fill(-1);
            const path = data.path || [];
            for (let i = 1; i < path.length; i++) prev[path[i]] = path[i - 1];

            result = {
                dist, prev, explored: new Set(path),
                nodesExplored: data.nodesExplored, execTime: data.execTimeMs, _path: path
            };
        } else {
            result = meta.fn(src, dst);
        }

        const pathNodes = result._path || reconstructPath(result.prev, dst);
        
        const canvas = document.getElementById('mainMapCanvas');
        animatePath(canvas, pathNodes, result.explored, src, dst, meta.color, 1800);

        const distKm = (result.dist[dst] === Infinity ? '∞' : result.dist[dst].toFixed(1));
        const timeMin = result.dist[dst] === Infinity ? '—' : Math.ceil(result.dist[dst] / 60 * 60);

        document.getElementById('resultDistance').textContent = distKm === '∞'? 'Unreachable' : `${distKm} km`;
        document.getElementById('resultTime').textContent = `${result.execTime.toFixed(3)} ms`;
        document.getElementById('resultNodes').textContent = result.nodesExplored;
        document.getElementById('resultETA').textContent = distKm === '∞'? '—' : `~${timeMin} min`;
        
        document.getElementById('resultAlgo').textContent = meta.name;
        document.getElementById('resultAlgoReason').textContent = `Optimal constraint (${distKm}km)`;
    } catch (err) {
        console.error(err);
        alert('Route Calculation Error!');
    }
    
    btn.innerHTML = '🚑 Dispatch Ambulance'; btn.disabled = false;
}

/* ===================================================
   COMPARISON LOGIC (BOTTOM PANEL)
   =================================================== */
async function runComparison() {
    const src = parseInt(document.getElementById('startLocation').value);
    const dst = parseInt(document.getElementById('endLocation').value);
    if(isNaN(src) || isNaN(dst) || src===dst) return alert("Select valid route first.");

    const algos = ['dijkstra', 'astar', 'bellman', 'floyd'];
    algos.forEach(k => {
        const badge = document.getElementById(`status-${k}`);
        if(badge) { badge.textContent='Running...'; document.getElementById(`td-${ALGO_META[k].prefix}-time`).textContent='...'; }
    });

    try {
        let rawResults = {};
        if (SERVER_MODE) {
            const res = await fetch('/api/compare', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src, dst, algos })
            });
            rawResults = await res.json();
        } else {
            algos.forEach(k => rawResults[k] = ALGO_META[k].fn(src, dst));
        }

        for (const key of algos) {
            const data = rawResults[key];
            if (!data) continue;
            const meta = ALGO_META[key];
            const distVal = Array.isArray(data.dist) ? data.dist[dst] : data.dist;
            const dist = distVal === null ? Infinity : parseFloat(distVal);
            const tdP = document.getElementById(`td-${meta.prefix}-path`);
            if(tdP) tdP.textContent = dist === Infinity ? '∞' : `${dist.toFixed(1)} km`;
            const tdT = document.getElementById(`td-${meta.prefix}-time`);
            if(tdT) tdT.textContent = (data.execTimeMs ?? data.execTime).toFixed(3);
            const tdN = document.getElementById(`td-${meta.prefix}-nodes`);
            if(tdN) tdN.textContent = data.nodesExplored;

            const pathStr = (data.path || []).map(n=>CITY_NODES[n].name.split(' ')[0]).join('→');
            const tdR = document.getElementById(`td-${meta.prefix}-result`);
            if(tdR) tdR.textContent = pathStr.length > 2 ? pathStr : '—';
            
            const badge = document.getElementById(`status-${key}`);
            if(badge) { badge.textContent='✓ Done'; }
        }
    } catch (e) {
        console.error(e);
        alert('Comparison Error!');
    }
}

/* ===================================================
   CANVAS RESIZING
   =================================================== */
function observeCanvas() {
    const canvas = document.getElementById('mainMapCanvas');
    if(!canvas) return;
    const ro = new ResizeObserver(() => {
        const wrap = canvas.parentElement;
        canvas.width = wrap.offsetWidth;
        canvas.height = wrap.offsetHeight;
        drawGraph(canvas);
    });
    ro.observe(canvas.parentElement);
}

/* ===================================================
   INIT APP
   =================================================== */
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    populateDropdowns();
    setupAlgoButtons();
    observeCanvas();

    document.getElementById('calculateBtn').addEventListener('click', runCalculation);
    document.getElementById('runComparisonBtn').addEventListener('click', runComparison);

    // Refresh graph visual with new traffic multipliers
    async function syncGraphVisuals() {
        if(SERVER_MODE) {
            try {
                const res = await fetch('/api/metrics');
                if(res.ok) {
                    const data = await res.json();
                    LOCAL_BLOCKS = data.blockedEdges.map(b => [b.u, b.v]) || [];
                    // For visualization logic in frontend we can just pick max mult to apply generally, or we map specifically. 
                    const vals = Object.values(data.trafficMultipliers);
                    LOCAL_TRAFFIC_MULT = vals.length > 0 ? Math.max(...vals) : 1.0;
                    drawGraph(document.getElementById('mainMapCanvas'));
                }
            } catch(e) { console.error('fetch metrics err', e); }
        } else {
            drawGraph(document.getElementById('mainMapCanvas'));
        }
    }

    document.getElementById('simTrafficBtn').addEventListener('click', async () => {
        if (!SERVER_MODE) { LOCAL_TRAFFIC_MULT+=0.5; return syncGraphVisuals(); }
        const rEdge = BASE_EDGES[Math.floor(Math.random() * BASE_EDGES.length)];
        await fetch('/api/simulate-traffic', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ u: rEdge[0], v: rEdge[1], traffic_multiplier: 5.0 })
        });
        syncGraphVisuals();
    });

    document.getElementById('blockRoadBtn').addEventListener('click', async () => {
        const randomEdge = BASE_EDGES[Math.floor(Math.random() * BASE_EDGES.length)];
        if (!SERVER_MODE) { LOCAL_BLOCKS.push([randomEdge[0], randomEdge[1]]); return syncGraphVisuals(); }
        await fetch('/api/block-road', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ u: randomEdge[0], v: randomEdge[1], blocked: true })
        });
        syncGraphVisuals();
    });

    document.getElementById('emergencyLevel').addEventListener('change', async (e) => {
        // We route this endpoint over to /api/smart-route or leave it
        if (!SERVER_MODE) return;
        // /api/smart-route triggers the writeState. For now maybe we don't have a direct /api/state setter other than smart-route. 
    });

    document.getElementById('resetBtn').addEventListener('click', async () => {
        LOCAL_TRAFFIC_MULT = 1.0; LOCAL_BLOCKS = [];
        if(SERVER_MODE) {
            // Unblock all roads and reset traffic
            // The API doesn't have a mass reset, so we will just force reload page or do nothing since backend doesn't support mass clear
            window.location.reload();
        }
        drawGraph(document.getElementById('mainMapCanvas'));
    });
});
