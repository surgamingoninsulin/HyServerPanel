import express from 'express';
import multiServerService from '../services/multiServerService.js';
import serverDataService from '../services/serverDataService.js';
import serversService from '../services/serversService.js';

const router = express.Router();

async function getCurrentServer(req) {
    await serversService.load();
    const serverId = req.query.serverId || req.body.serverId || req.headers['x-server-id'];
    if (serverId) {
        const server = await serversService.getById(serverId);
        if (!server) return null;
        return server;
    }
    return await serversService.getCurrent();
}

async function getCurrentServerPath(req) {
    const server = await getCurrentServer(req);
    if (!server) {
        return null;
    }
    return server.path;
}

router.get('/status', async (req, res) => {
    try {
        const server = await getCurrentServer(req);
        if (!server) {
            return res.status(404).json({
                error: 'Server not found',
                message: 'The requested server was not found or no server is selected.',
                code: 'SERVER_NOT_FOUND'
            });
        }
        const serverPath = server.path;
        const instance = await multiServerService.getInstanceFromRequest(req);
        const status = instance.getStatus();

        try {
            const config = await serverDataService.getHytaleConfig(serverPath);
            status.config = {
                motd: config.MOTD,
                maxPlayers: config.MaxPlayers,
                worldName: config.Defaults?.World || 'default',
                serverName: config.ServerName,
                version: `v${config.Version}`
            };

            if (status.stats && status.stats.players) {
                status.stats.players.max = config.MaxPlayers;
            }
        } catch (err) {
            console.error("Failed to load config for status:", err.message);
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const config = await serverDataService.getHytaleConfig(serverPath);
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/config', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        await serverDataService.saveHytaleConfig(serverPath, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/players', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const players = await serverDataService.getPlayers(serverPath);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/players/whitelist', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const { uuid, name, addedBy } = req.body;
        if (!uuid || !name) {
            return res.status(400).json({ error: 'UUID and name are required' });
        }
        
        const players = await serverDataService.addPlayerToWhitelist(serverPath, { uuid, name, addedBy });
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/players/whitelist/:name', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const players = await serverDataService.removePlayerFromWhitelist(serverPath, req.params.name);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/players/blacklist', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const { uuid, name, reason, bannedBy } = req.body;
        if (!uuid || !name) {
            return res.status(400).json({ error: 'UUID and name are required' });
        }
        
        const players = await serverDataService.addPlayerToBlacklist(serverPath, { uuid, name, reason, bannedBy });
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/players/blacklist/:name', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const players = await serverDataService.removePlayerFromBlacklist(serverPath, req.params.name);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/players/operators', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const { uuid, name, level } = req.body;
        if (!uuid || !name) {
            return res.status(400).json({ error: 'UUID and name are required' });
        }
        
        const players = await serverDataService.addOperator(serverPath, { uuid, name, level });
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/players/operators/:name', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const players = await serverDataService.removeOperator(serverPath, req.params.name);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/mods', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const mods = await serverDataService.listMods(serverPath);
        res.json(mods);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/plugins', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ error: 'No server configured' });
        }
        
        const plugins = await serverDataService.listPlugins(serverPath);
        res.json(plugins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/start', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ 
                error: 'No server configured',
                message: 'Please create or import a server first',
                code: 'NO_SERVER_CONFIGURED'
            });
        }
        
        console.log('[API] Received Start Server Request');
        const instance = await multiServerService.getInstanceFromRequest(req);
        const result = await instance.start();
        res.json(result);
    } catch (error) {
        console.error('[API] Start Server Failed:', error.message);
        res.status(400).json({ error: error.message });
    }
});

router.post('/stop', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ 
                error: 'No server configured',
                message: 'Please create or import a server first',
                code: 'NO_SERVER_CONFIGURED'
            });
        }
        
        const instance = await multiServerService.getInstanceFromRequest(req);
        const result = instance.stop();
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/restart', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ 
                error: 'No server configured',
                message: 'Please create or import a server first',
                code: 'NO_SERVER_CONFIGURED'
            });
        }
        
        const instance = await multiServerService.getInstanceFromRequest(req);
        const result = await instance.restart();
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/command', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ 
                error: 'No server configured',
                message: 'Please create or import a server first',
                code: 'NO_SERVER_CONFIGURED'
            });
        }
        
        const { command } = req.body;
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }
        
        const instance = await multiServerService.getInstanceFromRequest(req);
        const result = instance.sendCommand(command);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const serverPath = await getCurrentServerPath(req);
        
        if (!serverPath) {
            return res.status(400).json({ 
                error: 'No server configured',
                message: 'Please create or import a server first',
                code: 'NO_SERVER_CONFIGURED'
            });
        }
        
        const instance = await multiServerService.getInstanceFromRequest(req);
        res.json(instance.logs || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
