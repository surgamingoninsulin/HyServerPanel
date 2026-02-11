import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import playitService from '../services/playitService.js';
import serversService from '../services/serversService.js';
import settingsService from '../services/settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const DEFAULT_FALLBACK = { domain: 'example.gl.at.ply.gg', port: '443' };

// Always save/read from project root: ./Servers/<server_name>/servers.json — never .SOURCE or server.path.
const PROJECT_ROOT = path.join(__dirname, '../../..');
const SERVERS_DIR = path.join(PROJECT_ROOT, 'Servers');

function getServersJsonPath(server) {
    const serverName = (server.name || path.basename(server.path || '')).replace(/[<>:"/\\|?*]/g, '') || 'default';
    const p = path.join(SERVERS_DIR, serverName, 'servers.json');
    if (p.includes('.SOURCE')) {
        throw new Error('Cannot use .SOURCE path for servers.json');
    }
    return p;
}

async function getServerFromRequest(req) {
    await serversService.load(); // Fresh list so current server is found
    const serverId = req.query.serverId || req.body?.serverId || req.headers['x-server-id'];
    if (serverId) {
        return await serversService.getById(serverId);
    }
    return await serversService.getCurrent();
}

// Read playit fallback (playitDomain, playitPort) from project ./Servers/<server_name>/servers.json
async function readPlayitFallback(server) {
    if (!server?.id) return DEFAULT_FALLBACK;
    try {
        const filePath = getServersJsonPath(server);
        const data = await fs.readFile(filePath, 'utf8');
        const config = JSON.parse(data);
        const entry = Array.isArray(config.servers) && config.servers.length > 0
            ? (config.servers.find(s => s.id === server.id) || config.servers[0])
            : config.id ? config : null;
        if (entry && entry.playitDomain != null && entry.playitPort != null) {
            return { domain: String(entry.playitDomain), port: String(entry.playitPort) };
        }
    } catch (e) {
        if (e.code !== 'ENOENT') console.error('[Playit] read fallback from servers.json:', e.message);
    }
    return DEFAULT_FALLBACK;
}

// Write playit fallback + CurseForge API key to project root ./Servers/<server_name>/servers.json only. Never .SOURCE.
async function writePlayitFallback(server, domain, port) {
    if (!server?.id || !server?.name) throw new Error('No server configured');
    const filePath = getServersJsonPath(server);
    let config = { servers: [] };
    try {
        const data = await fs.readFile(filePath, 'utf8');
        config = JSON.parse(data);
        if (!Array.isArray(config.servers)) config.servers = [];
    } catch (e) {
        if (e.code === 'ENOENT') {
            // Create servers.json for already-created server folders that don't have it yet
            config = { servers: [] };
        } else {
            throw new Error('Server servers.json error at ' + filePath + ': ' + e.message);
        }
    }
    const serverName = (server.name || path.basename(server.path || '')).replace(/[<>:"/\\|?*]/g, '') || 'default';
    const serverDir = path.join(SERVERS_DIR, serverName);
    let entry = config.servers.find(s => s.id === server.id) || config.servers[0];
    if (!entry) {
        entry = { id: server.id, name: server.name || serverName, path: serverDir };
        config.servers.push(entry);
    }
    entry.playitDomain = domain;
    entry.playitPort = String(port);
    // Also save CurseForge API key in this server's servers.json (from panel settings)
    const panelSettings = await settingsService.get();
    const apiKey = panelSettings?.modProviders?.curseforge?.apiKey || '';
    entry.modProviders = entry.modProviders || {};
    entry.modProviders.curseforge = entry.modProviders.curseforge || {};
    entry.modProviders.curseforge.apiKey = apiKey;
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    console.log('[Playit] Saved fallback to', filePath, '| domain:', domain, 'port:', port, '| apiKey:', apiKey ? 'set' : 'empty');
    return filePath;
}

// Get tunnel status
router.get('/status', (req, res) => {
    const status = playitService.getStatus();
    res.json(status);
});

// Start tunnel (uses current server's port and fallback from Servers/<name>/servers.json)
router.post('/start', async (req, res) => {
    try {
        const server = await getServerFromRequest(req);
        const serverPort = server?.port ?? 5520;
        const fallback = server ? await readPlayitFallback(server) : DEFAULT_FALLBACK;
        playitService.setFallback(fallback.domain, fallback.port);
        const result = await playitService.start(serverPort);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop tunnel
router.post('/stop', (req, res) => {
    try {
        const result = playitService.stop();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tunnel URL
router.get('/url', (req, res) => {
    const url = playitService.getTunnelUrl();
    if (url) {
        res.json({ url });
    } else {
        res.status(404).json({ error: 'No active tunnel' });
    }
});

// Get fallback settings (from Servers/<server_name>/servers.json playitDomain/playitPort)
router.get('/fallback', async (req, res) => {
    try {
        const server = await getServerFromRequest(req);
        const fallback = await readPlayitFallback(server);
        res.json(fallback);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set fallback settings (save to Servers/<server_name>/servers.json playitDomain/playitPort)
router.post('/fallback', async (req, res) => {
    try {
        const { domain, port } = req.body;
        if (!domain || !port) {
            return res.status(400).json({ error: 'Domain and port are required' });
        }
        const server = await getServerFromRequest(req);
        if (!server) {
            return res.status(400).json({ error: 'No server selected' });
        }
        const filePath = await writePlayitFallback(server, domain, String(port));
        playitService.setFallback(domain, String(port));
        res.json({ success: true, message: 'Fallback updated', savedTo: filePath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;