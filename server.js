/**
 * server.js
 * Smart Emergency Route Optimization System — Node.js Bridge Server
 *
 * Serves the web app and exposes two API endpoints that spawn the
 * compiled C++ binary to get real algorithm results.
 *
 * Start:  node server.js
 * Open:   http://localhost:3000
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Path to the compiled C++ binary ──────────────────────────────────────
const CPP_BIN = path.join(__dirname, 'cpp', 'route_optimizer.exe');

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());

// Serve index.html, app.js, styles.css from this directory
app.use(express.static(__dirname));

// ── Helper: run C++ binary and return parsed JSON ─────────────────────────
function runCpp(args) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn(CPP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

        proc.on('close', code => {
            if (code !== 0) {
                // Try to parse error JSON from stderr
                try {
                    return reject(JSON.parse(stderr.trim()));
                } catch (_) {
                    return reject({ error: stderr.trim() || `C++ process exited with code ${code}` });
                }
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch (e) {
                reject({ error: 'Failed to parse C++ output', raw: stdout });
            }
        });

        proc.on('error', err => {
            reject({ error: `Could not start C++ binary: ${err.message}` });
        });
    });
}

const fs = require('fs');

// ── Global System State ────────────────────────────────────────────────────
let systemState = {
    blockedEdges: [], // Array of {u, v}
    trafficMultipliers: {}, // Keyed by "u-v", value is additional weight multiplier
    emergencyLevel: 'low' // low, medium, high
};

const STATE_FILE = path.join(__dirname, 'cpp', 'state.txt');

// Helper to write state for C++ engine
function writeStateFile() {
    let content = "";
    
    // 1. Blocked edges
    content += `${systemState.blockedEdges.length}\n`;
    for (const e of systemState.blockedEdges) {
        content += `${e.u} ${e.v}\n`;
    }

    // 2. Traffic Multipliers
    const trafficKeys = Object.keys(systemState.trafficMultipliers);
    content += `${trafficKeys.length}\n`;
    for (const key of trafficKeys) {
        const [u, v] = key.split('-');
        const mult = systemState.trafficMultipliers[key];
        content += `${u} ${v} ${mult}\n`;
    }

    // 3. Emergency Priority
    let priorityVal = 0.0;
    if (systemState.emergencyLevel === 'medium') priorityVal = 1.0;
    if (systemState.emergencyLevel === 'high') priorityVal = 2.0;
    content += `${priorityVal}\n`;

    fs.writeFileSync(STATE_FILE, content, 'utf8');
}

// ── POST /api/smart-route ────────────────────────────────────────────────
app.post('/api/smart-route', async (req, res) => {
    const { src, dst, emergency_level, traffic_level } = req.body;

    if (src === undefined || dst === undefined) {
        return res.status(400).json({ error: 'Missing src or dst in request body' });
    }

    if (emergency_level) systemState.emergencyLevel = emergency_level;
    
    // (Optional) apply temporary overall traffic level impact here if we wanted
    writeStateFile();

    // Smart logic: Select algorithm based on conditions
    // If priority could result in negative edges, use Bellman-Ford
    // Otherwise rely on A* for real-time speed
    let algoToUse = 'astar';
    if (systemState.emergencyLevel === 'high') {
        // High priority subtracts weights, might cause negative weights
        algoToUse = 'bellman'; 
    }

    try {
        const result = await runCpp(['--json', '--state', STATE_FILE, String(src), String(dst), algoToUse]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ── POST /api/route (legacy) ─────────────────────────────────────────────
app.post('/api/route', async (req, res) => {
    const { src, dst, algo } = req.body;
    if (src === undefined || dst === undefined || !algo) {
        return res.status(400).json({ error: 'Missing src, dst, or algo in request body' });
    }
    writeStateFile();
    try {
        const result = await runCpp(['--json', '--state', STATE_FILE, String(src), String(dst), algo]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ── POST /api/compare ────────────────────────────────────────────────────
app.post('/api/compare', async (req, res) => {
    const { src, dst, algos } = req.body;
    if (src === undefined || dst === undefined) {
        return res.status(400).json({ error: 'Missing src or dst in request body' });
    }

    writeStateFile();

    const ALL_ALGOS = ['dijkstra', 'astar', 'bellman', 'floyd'];
    const requested = Array.isArray(algos) && algos.length > 0 ? algos : ALL_ALGOS;
    const runAll = requested.length === 4 && ALL_ALGOS.every(a => requested.includes(a));

    try {
        if (runAll) {
            const result = await runCpp(['--json', '--state', STATE_FILE, String(src), String(dst), 'all']);
            return res.json(result);
        }

        const promises = requested.map(algo =>
            runCpp(['--json', '--state', STATE_FILE, String(src), String(dst), algo])
                .then(r => ({ algo, r }))
        );
        const results = await Promise.all(promises);
        const out = {};
        results.forEach(({ algo, r }) => { out[algo] = r; });
        res.json(out);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ── NEW API: Simulate Traffic ─────────────────────────────────────────
app.post('/api/simulate-traffic', (req, res) => {
    const { u, v, traffic_multiplier } = req.body;
    if (u === undefined || v === undefined || traffic_multiplier === undefined) {
        return res.status(400).json({ error: 'Missing u, v, or traffic_multiplier' });
    }
    
    const key1 = `${u}-${v}`;
    const key2 = `${v}-${u}`;
    if (traffic_multiplier <= 1.0) {
        delete systemState.trafficMultipliers[key1];
        delete systemState.trafficMultipliers[key2];
    } else {
        systemState.trafficMultipliers[key1] = traffic_multiplier;
        systemState.trafficMultipliers[key2] = traffic_multiplier;
    }
    
    res.json({ message: 'Traffic updated', state: systemState.trafficMultipliers });
});

// ── NEW API: Block Road ───────────────────────────────────────────────
app.post('/api/block-road', (req, res) => {
    const { u, v, blocked } = req.body;
    if (u === undefined || v === undefined || blocked === undefined) {
        return res.status(400).json({ error: 'Missing u, v, or blocked' });
    }

    // remove existing
    systemState.blockedEdges = systemState.blockedEdges.filter(e => !(e.u === u && e.v === v) && !(e.u === v && e.v === u));

    if (blocked) {
        systemState.blockedEdges.push({ u, v }); // undirected representation
    }

    res.json({ message: 'Road block updated', blockedEdges: systemState.blockedEdges });
});

// ── NEW API: Get Metrics ───────────────────────────────────────────────
app.get('/api/metrics', (req, res) => {
    res.json(systemState);
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('  +=====================================================+');
    console.log('  |  Smart Emergency Route Optimization System         |');
    console.log('  |  Node.js bridge server running                     |');
    console.log('  +=====================================================+');
    console.log(`  Open: http://localhost:${PORT}`);
    console.log('');
    console.log(`  C++ binary: ${CPP_BIN}`);
    console.log('  API endpoints:');
    console.log('    POST /api/smart-route    { src, dst, emergency_level, traffic_level }');
    console.log('    POST /api/simulate-traffic { u, v, traffic_multiplier }');
    console.log('    POST /api/block-road     { u, v, blocked }');
    console.log('    POST /api/route          { src, dst, algo }');
    console.log('    POST /api/compare        { src, dst, algos[] }');
    console.log('    GET  /api/metrics');
    console.log('');
});
