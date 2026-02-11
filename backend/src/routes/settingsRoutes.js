import express from 'express';
import settingsService from '../services/settingsService.js';
import hytaleConfigService from '../services/hytaleConfigService.js';

const router = express.Router();

// --- Panel Settings ---

router.get('/panel', async (req, res) => {
    try {
        const settings = await settingsService.get();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/panel', async (req, res) => {
    try {
        const settings = await settingsService.update(req.body);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/detect', async (req, res) => {
    try {
        const info = await settingsService.detectSystem();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Server Settings (config.json) ---

router.get('/server', async (req, res) => {
    try {
        const serverId = req.query.serverId || req.headers['x-server-id'] || null;
        const config = await hytaleConfigService.get(serverId);
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/server', async (req, res) => {
    try {
        const serverId = req.body.serverId || req.query.serverId || req.headers['x-server-id'] || null;
        const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.prototype.hasOwnProperty.call(req.body, 'serverId'))
            ? Object.fromEntries(Object.entries(req.body).filter(([k]) => k !== 'serverId'))
            : req.body;
        const config = await hytaleConfigService.update(payload, serverId);
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Server Arguments (per-server startup flags) ---

router.get('/server-arguments', async (req, res) => {
    try {
        const serverId = req.query.serverId || req.headers['x-server-id'] || null;
        const args = await settingsService.getServerArguments(serverId);
        res.json(args);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/server-arguments', async (req, res) => {
    try {
        const serverId = req.body.serverId || req.query.serverId || req.headers['x-server-id'] || null;
        const { serverId: _s, ...args } = req.body;
        const saved = await settingsService.saveServerArguments(args, serverId || _s);
        res.json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Generic File Settings (bans, permissions, whitelist) ---

router.get('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const serverId = req.query.serverId || req.headers['x-server-id'] || null;
        const content = await hytaleConfigService.getFile(filename, serverId);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const serverId = req.body.serverId || req.query.serverId || req.headers['x-server-id'] || null;
        const payload = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.prototype.hasOwnProperty.call(req.body, 'serverId'))
            ? Object.fromEntries(Object.entries(req.body).filter(([k]) => k !== 'serverId'))
            : req.body;
        const content = await hytaleConfigService.saveFile(filename, payload, serverId);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
