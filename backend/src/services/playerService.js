import fs from 'fs/promises';
import path from 'path';
import serversService from './serversService.js';

class PlayerService {
    async getServerPath(serverId = null) {
        if (serverId) {
            const server = await serversService.getById(serverId);
            if (!server) throw new Error(`Server with id '${serverId}' not found`);
            return server.path;
        }
        const server = await serversService.getCurrent();
        if (!server) throw new Error('No server configured');
        return server.path;
    }

    async getPlayersDir(serverId = null) {
        const serverPath = await this.getServerPath(serverId);
        return path.join(serverPath, 'universe', 'players');
    }

    async getPermissionsFile(serverId = null) {
        const serverPath = await this.getServerPath(serverId);
        return path.join(serverPath, 'permissions.json');
    }

    async listPlayers(serverId = null) {
        try {
            const dir = await this.getPlayersDir(serverId);
            const files = await fs.readdir(dir);
            const playerFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.bak'));

            const players = [];
            for (const file of playerFiles) {
                try {
                    const content = await fs.readFile(path.join(dir, file), 'utf8');
                    const data = JSON.parse(content);
                    const uuid = file.replace('.json', '');

                    // Basic extraction
                    players.push({
                        uuid,
                        name: data.Components?.Nameplate?.Text || data.Components?.DisplayName?.DisplayName?.RawText || 'Unknown',
                        gameMode: data.Components?.Player?.GameMode || 'Unknown',
                        health: data.Components?.EntityStats?.Stats?.Health?.Value || 0,
                        lastModified: (await fs.stat(path.join(dir, file))).mtime
                    });
                } catch (err) {
                    console.error(`Error reading player file ${file}:`, err.message);
                }
            }
            return players;
        } catch (error) {
            console.error('[PlayerService] Error listing players:', error.message);
            return [];
        }
    }

    async getPlayer(uuid, serverId = null) {
        const dir = await this.getPlayersDir(serverId);
        const filePath = path.join(dir, `${uuid}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);

        // Add OP status
        const isOp = await this.isOp(uuid, serverId);
        return { ...data, isOp };
    }

    async updatePlayer(uuid, updates, serverId = null) {
        const dir = await this.getPlayersDir(serverId);
        const filePath = path.join(dir, `${uuid}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        let data = JSON.parse(content);

        // Deep merge or specific updates? 
        // For simplicity and safety, let's allow updating specific components
        if (updates.Components) {
            if (updates.Components.EntityStats?.Stats) {
                const stats = updates.Components.EntityStats.Stats;
                for (const key in stats) {
                    if (data.Components.EntityStats.Stats[key]) {
                        data.Components.EntityStats.Stats[key].Value = stats[key].Value;
                    }
                }
            }
            if (updates.Components.Player?.GameMode) {
                data.Components.Player.GameMode = updates.Components.Player.GameMode;
            }
        }
        if (typeof updates.isOp !== 'undefined') {
            await this.setOp(uuid, updates.isOp, serverId);
        }

        await fs.writeFile(filePath, JSON.stringify(data, null, 4));
        return data;
    }

    async isOp(uuid, serverId = null) {
        try {
            const permissionsFile = await this.getPermissionsFile(serverId);
            const content = await fs.readFile(permissionsFile, 'utf8');
            const permissions = JSON.parse(content);
            return permissions.ops?.some(op => op.uuid === uuid) || false;
        } catch (error) {
            return false;
        }
    }

    async setOp(uuid, isOp, serverId = null) {
        const permissionsFile = await this.getPermissionsFile(serverId);
        let permissions = { ops: [] };
        try {
            const content = await fs.readFile(permissionsFile, 'utf8');
            permissions = JSON.parse(content);
            if (!permissions.ops) permissions.ops = [];
        } catch (error) {
            // File doesn't exist yet
        }

        // Remove existing op entry if present
        permissions.ops = permissions.ops.filter(op => op.uuid !== uuid);

        // Add new op entry if isOp is true
        if (isOp) {
            permissions.ops.push({
                uuid,
                level: 4,
                bypassPlayerLimit: true
            });
        }

        await fs.writeFile(permissionsFile, JSON.stringify(permissions, null, 4));
    }

    async kickPlayer(uuid, serverId = null) {
        // In a real implementation, this would send a kick command to the server
        // For now, we just log it
        console.log(`Kicking player ${uuid} on server ${serverId || 'current'}`);
        return { success: true };
    }
}

export default new PlayerService();
