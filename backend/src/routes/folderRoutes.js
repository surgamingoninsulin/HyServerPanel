import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();

async function isReadableDirectory(dirPath) {
    if (!dirPath) return false;
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) return false;
        await fs.readdir(dirPath);
        return true;
    } catch {
        return false;
    }
}

// Browse directory contents
router.get('/browse', async (req, res) => {
    try {
        let { path: browsePath, showFiles = 'false' } = req.query;
        
        // Default to home directory if no path provided
        if (!browsePath) {
            browsePath = os.homedir();
        }

        // Normalize path
        browsePath = path.normalize(browsePath);

        // Security check - prevent accessing system directories
        const systemPaths = [
            '/proc', '/sys', '/dev', '/boot', '/etc', '/var/log',
            'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
            'C:\\System32', 'C:\\SysWOW64'
        ];
        
        const isSystemPath = systemPaths.some(sysPath => 
            browsePath.toLowerCase().startsWith(sysPath.toLowerCase())
        );

        if (isSystemPath) {
            return res.status(403).json({ error: 'Access to system directories is not allowed' });
        }

        // Check if path exists and is a directory
        try {
            const stats = await fs.stat(browsePath);
            if (!stats.isDirectory()) {
                return res.status(400).json({ error: 'Path is not a directory' });
            }
        } catch {
            return res.status(404).json({ error: 'Directory not found' });
        }

        // Read directory contents
        const items = await fs.readdir(browsePath, { withFileTypes: true });
        
        const directories = [];
        const files = [];

        for (const item of items) {
            // Skip hidden files/folders (starting with .)
            if (item.name.startsWith('.')) continue;

            const itemPath = path.join(browsePath, item.name);
            
            if (item.isDirectory()) {
                directories.push({
                    name: item.name,
                    path: itemPath,
                    type: 'directory'
                });
            } else if (showFiles === 'true' && item.isFile()) {
                files.push({
                    name: item.name,
                    path: itemPath,
                    type: 'file'
                });
            }
        }

        // Sort directories alphabetically
        directories.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            currentPath: browsePath,
            parentPath: path.dirname(browsePath),
            directories,
            files: showFiles === 'true' ? files : undefined
        });
    } catch (error) {
        console.error('[FolderBrowser] Error browsing directory:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get home directory
router.get('/home', async (req, res) => {
    try {
        const homeDir = os.homedir();
        const cwd = process.cwd();
        const rootPath = path.parse(cwd).root || (process.platform === 'win32' ? 'C:\\' : '/');

        const candidates = [homeDir, cwd, rootPath].filter(Boolean);
        for (const candidate of candidates) {
            if (await isReadableDirectory(candidate)) {
                return res.json({ path: candidate });
            }
        }

        res.status(500).json({ error: 'No accessible home directory found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get common paths (Desktop, Documents, etc.)
router.get('/common-paths', async (req, res) => {
    try {
        const platform = process.platform;
        const paths = [];

        if (platform === 'win32') {
            const home = os.homedir();
            paths.push(
                { name: 'Desktop', path: path.join(home, 'Desktop') },
                { name: 'Documents', path: path.join(home, 'Documents') },
                { name: 'Downloads', path: path.join(home, 'Downloads') },
                { name: 'Home', path: home },
                { name: 'C:', path: 'C:\\' },
                { name: 'D:', path: 'D:\\' }
            );
        } else {
            const home = os.homedir();
            paths.push(
                { name: 'Home', path: home },
                { name: 'Root', path: '/' },
                { name: 'Opt', path: '/opt' },
                { name: 'Var', path: '/var' }
            );
        }

        const existingPaths = [];
        for (const item of paths) {
            if (await isReadableDirectory(item.path)) {
                existingPaths.push(item);
            }
        }

        if (existingPaths.length === 0) {
            const cwd = process.cwd();
            if (await isReadableDirectory(cwd)) {
                existingPaths.push({ name: 'Current Folder', path: cwd });
            }
        }

        res.json({ paths: existingPaths });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate if path is a valid server directory
router.post('/validate-server-path', async (req, res) => {
    try {
        const { path: checkPath } = req.body;
        
        if (!checkPath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        try {
            const stats = await fs.stat(checkPath);
            if (!stats.isDirectory()) {
                return res.json({ valid: false, error: 'Path is not a directory' });
            }
        } catch {
            return res.json({ valid: false, error: 'Directory does not exist' });
        }

        // Check for Hytale server files (root or Server/ — prefix comes from panel config)
        let hasServerFiles = false;
        try {
            await fs.access(path.join(checkPath, 'HytaleServer.jar'));
            hasServerFiles = true;
        } catch {
            try {
                await fs.access(path.join(checkPath, 'Server', 'HytaleServer.jar'));
                hasServerFiles = true;
            } catch { }
        }
        return res.json({
            valid: true,
            hasServerFiles,
            message: hasServerFiles ? 'Valid Hytale server directory' : 'Empty directory - ready for server installation'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
