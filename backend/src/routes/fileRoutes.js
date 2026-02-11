import express from 'express';
import multer from 'multer';
import fileService from '../services/fileService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to get server path based on serverId
async function getServerPath(serverId) {
    if (serverId) {
        const serversService = (await import('../services/serversService.js')).default;
        const server = await serversService.getById(serverId);
        if (!server) {
            throw new Error(`Server with id '${serverId}' not found`);
        }
        return server.path;
    }
    // Fallback to current server
    const serversService = (await import('../services/serversService.js')).default;
    const server = await serversService.getCurrent();
    if (!server) {
        throw new Error('No server configured');
    }
    return server.path;
}

// Helper to extract serverId from request (query, body, or header)
function getServerIdFromRequest(req) {
    return req.query.serverId || req.body.serverId || req.headers['x-server-id'];
}

// List files in directory
router.get('/list', async (req, res) => {
    try {
        const directory = req.query.directory || '';
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = directory ? `${basePath}/${directory}` : basePath;
        
        const files = await fileService.listFilesExternal(fullPath);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Read file content
router.get('/read', async (req, res) => {
    try {
        const { path } = req.query;
        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = path.startsWith(basePath) ? path : `${basePath}/${path}`;
        const result = await fileService.readFile(fullPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Write file content
router.post('/write', async (req, res) => {
    try {
        const { path, content } = req.body;
        if (!path || content === undefined) {
            return res.status(400).json({ error: 'Path and content are required' });
        }
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = path.startsWith(basePath) ? path : `${basePath}/${path}`;
        const result = await fileService.writeFile(fullPath, content);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file or directory
router.delete('/delete', async (req, res) => {
    try {
        const { path } = req.body;
        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = path.startsWith(basePath) ? path : `${basePath}/${path}`;
        const result = await fileService.deleteFile(fullPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create directory
router.post('/mkdir', async (req, res) => {
    try {
        const { path } = req.body;
        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = path.startsWith(basePath) ? path : `${basePath}/${path}`;
        const result = await fileService.createDirectory(fullPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create directory for folder browser (allows absolute paths)
router.post('/mkdir-absolute', async (req, res) => {
    try {
        const { path: dirPath } = req.body;
        if (!dirPath) {
            return res.status(400).json({ error: 'Path is required' });
        }
        
        const fs = await import('fs/promises');
        await fs.mkdir(dirPath, { recursive: true });
        
        res.json({ success: true, path: dirPath });
    } catch (error) {
        console.error('[FileRoutes] mkdir-absolute error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath || !req.file) {
            return res.status(400).json({ error: 'Path and file are required' });
        }
        const serverId = getServerIdFromRequest(req);
        const basePath = await getServerPath(serverId);
        const fullPath = filePath.startsWith(basePath) ? filePath : `${basePath}/${filePath}`;
        const result = await fileService.uploadFile(fullPath, req.file.buffer);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
