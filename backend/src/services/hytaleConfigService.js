import fs from 'fs/promises';
import path from 'path';
import serversService from './serversService.js';

class HytaleConfigService {
    constructor() {
        this.allowedFiles = [
            'config.json',
            'bans.json',
            'permissions.json',
            'whitelist.json'
        ];
    }

    async getServer(serverId) {
        if (serverId) {
            const server = await serversService.getById(serverId);
            if (!server) {
                throw new Error(`Server with id '${serverId}' not found`);
            }
            return server;
        }
        // Fallback to current server if no serverId provided
        const server = await serversService.getCurrent();
        if (!server) {
            throw new Error('No server configured');
        }
        return server;
    }

    async getConfigPath(filename = 'config.json', serverId = null) {
        if (!this.allowedFiles.includes(filename)) {
            throw new Error(`Access to file '${filename}' is not allowed`);
        }
        const server = await this.getServer(serverId);
        return path.join(server.path, filename);
    }

    // Get config with optional serverId
    async get(serverId = null) {
        return this.getFile('config.json', serverId);
    }

    // Update config with optional serverId
    async update(newConfig, serverId = null) {
        return this.saveFile('config.json', newConfig, serverId);
    }

    // Get file with optional serverId
    async getFile(filename, serverId = null) {
        try {
            const configPath = await this.getConfigPath(filename, serverId);
            
            // Check existence
            try {
                await fs.access(configPath);
            } catch {
                // If file doesn't exist, return empty array/object based on file type
                if (filename === 'bans.json' || filename === 'whitelist.json') return [];
                return {};
            }

            const content = await fs.readFile(configPath, 'utf8');
            if (!content.trim()) {
                if (filename === 'bans.json' || filename === 'whitelist.json') return [];
                return {};
            }
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'EACCES') {
                console.error(`[ConfigService] Permission denied reading ${filename}.`);
                if (filename === 'bans.json' || filename === 'whitelist.json') return [];
                return {};
            }
            if (error instanceof SyntaxError) {
                throw new Error(`File ${filename} contains invalid JSON.`);
            }
            throw error;
        }
    }

    // Save file with optional serverId
    async saveFile(filename, content, serverId = null) {
        const configPath = await this.getConfigPath(filename, serverId);
        await fs.writeFile(configPath, JSON.stringify(content, null, 4));
        return content;
    }
}

export default new HytaleConfigService();
