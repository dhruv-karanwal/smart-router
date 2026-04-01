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

// ── POST /api/route ──────────────────────────────────────────────────────
// Body: { src: number, dst: number, algo: string }
// Returns single-algorithm JSON result from C++
app.post('/api/route', async (req, res) => {
    const { src, dst, algo } = req.body;

    if (src === undefined || dst === undefined || !algo) {
        return res.status(400).json({ error: 'Missing src, dst, or algo in request body' });
    }

    try {
        const result = await runCpp(['--json', String(src), String(dst), algo]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ── POST /api/compare ────────────────────────────────────────────────────
// Body: { src: number, dst: number, algos: string[] }
//   algos can be ['dijkstra','astar','bellman','floyd'] or omit for all
// Returns object keyed by algo name
app.post('/api/compare', async (req, res) => {
    const { src, dst, algos } = req.body;

    if (src === undefined || dst === undefined) {
        return res.status(400).json({ error: 'Missing src or dst in request body' });
    }

    // If all 4 are requested (or none specified), use the C++ "all" shortcut
    const ALL_ALGOS = ['dijkstra', 'astar', 'bellman', 'floyd'];
    const requested = Array.isArray(algos) && algos.length > 0 ? algos : ALL_ALGOS;
    const runAll = requested.length === 4 && ALL_ALGOS.every(a => requested.includes(a));

    try {
        if (runAll) {
            // Single spawn for all 4 — most efficient
            const result = await runCpp(['--json', String(src), String(dst), 'all']);
            return res.json(result);
        }

        // Run only the requested subset in parallel
        const promises = requested.map(algo =>
            runCpp(['--json', String(src), String(dst), algo])
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
    console.log('    POST /api/route    { src, dst, algo }');
    console.log('    POST /api/compare  { src, dst, algos[] }');
    console.log('');
});
