import express from 'express';
import serversService from '../services/serversService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const USERS_JSON_FILE = path.join(DATA_DIR, 'users.json');

const router = express.Router();

// Get all servers
router.get('/', async (req, res) => {
    try {
        const servers = await serversService.list();
        res.json(servers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger server discovery
router.post('/discover', async (req, res) => {
    try {
        await serversService.load(); // Re-run discovery
        const servers = await serversService.list();
        res.json({ 
            success: true, 
            servers,
            message: `Found ${servers.length} servers`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Discover and set as current server from path
router.post('/setup', async (req, res) => {
    try {
        const { path: serverPath, setAsCurrent = true } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ error: 'Server path is required' });
        }

        // Resolve to absolute so stored path is correct
        const resolvedPath = path.isAbsolute(serverPath) ? path.normalize(serverPath) : path.resolve(process.cwd(), serverPath);
        console.log('[ServersRoutes] Setting up server from:', resolvedPath);

        // Try to load server from path
        const server = await serversService.loadServerFromPath(resolvedPath);
        
        if (!server) {
            return res.status(404).json({ error: 'No servers.json found at the specified path' });
        }

        // Add to servers list
        const exists = await serversService.list();
        const serverExists = exists.find(s => s.id === server.id);
        
        if (!serverExists) {
            serversService.servers.push(server);
        }

        // Set as current if requested
        if (setAsCurrent) {
            await serversService.setCurrent(server.id);
            console.log('[ServersRoutes] Set current server to:', server.name, server.id);
        }

        res.json({ 
            success: true, 
            server,
            message: setAsCurrent ? `Set ${server.name} as current server` : `Server discovered`
        });
    } catch (error) {
        console.error('[ServersRoutes] Setup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current server
router.get('/current', async (req, res) => {
    try {
        const server = await serversService.getCurrent();
        res.json(server || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get server configuration status
router.get('/status', async (req, res) => {
    try {
        const servers = await serversService.list();
        const currentServer = await serversService.getCurrent();
        res.json({
            hasServers: servers.length > 0,
            serverCount: servers.length,
            currentServer: currentServer,
            needsServer: servers.length === 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set current server
router.post('/current', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Server ID is required' });
        }
        const server = await serversService.setCurrent(id);
        res.json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific server by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const server = await serversService.getById(id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new server
router.post('/', async (req, res) => {
    try {
        const server = await serversService.create(req.body);
        res.status(201).json(server);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// Import existing server
router.post('/import', async (req, res) => {
    try {
        const server = await serversService.import(req.body);
        res.status(201).json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Discover specific server from folder path
router.post('/discover-path', async (req, res) => {
    try {
        const { path: serverPath } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ error: 'Server path is required' });
        }

        const resolvedPath = path.isAbsolute(serverPath) ? path.normalize(serverPath) : path.resolve(process.cwd(), serverPath);
        const server = await serversService.discoverFromPath(resolvedPath);
        res.status(201).json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate import path
router.post('/validate-import', async (req, res) => {
    try {
        const { path: importPath, jarFile = 'HytaleServer.jar' } = req.body;
        
        if (!importPath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        const fs = await import('fs/promises');
        const pathModule = await import('path');
        
        // Check if directory exists
        try {
            await fs.access(importPath);
        } catch {
            return res.status(400).json({ error: 'Directory does not exist' });
        }

        // Check for JAR file
        const jarPath = pathModule.join(importPath, jarFile);
        try {
            await fs.access(jarPath);
        } catch {
            return res.status(400).json({ error: 'HytaleServer.jar not found at specified path' });
        }

        res.json({ valid: true, message: 'Valid Hytale server found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update server
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const server = await serversService.update(id, req.body);
        res.json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete server
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await serversService.delete(id, req.body || {});
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// Duplicate server
router.post('/:id/duplicate', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const server = await serversService.duplicate(id, name);
        res.status(201).json(server);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
