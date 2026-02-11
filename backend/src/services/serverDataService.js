import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ServerDataService {
    getHytaleConfigPath(serverPath) {
        return path.join(serverPath, 'hytale.json');
    }

    getPlayersPath(serverPath) {
        return path.join(serverPath, 'players.json');
    }

    getModsPath(serverPath) {
        return path.join(serverPath, 'Server', 'mods');
    }

    getPluginsPath(serverPath) {
        return path.join(serverPath, 'Server', 'plugins');
    }

    getServerPath(serverPath, subPath = '') {
        return subPath ? path.join(serverPath, subPath) : serverPath;
    }

    async getHytaleConfig(serverPath) {
        const configPath = this.getHytaleConfigPath(serverPath);
        
        try {
            const data = await fs.readFile(configPath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                const defaultConfig = {
                    MOTD: 'A Hytale Server',
                    MaxPlayers: 100,
                    ServerName: '',
                    Version: '1.0.0',
                    Defaults: { World: 'default' }
                };
                await this.saveHytaleConfig(serverPath, defaultConfig);
                return defaultConfig;
            }
            throw err;
        }
    }

    async saveHytaleConfig(serverPath, config) {
        const configPath = this.getHytaleConfigPath(serverPath);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    async getPlayers(serverPath) {
        const playersPath = this.getPlayersPath(serverPath);
        
        try {
            const data = await fs.readFile(playersPath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                const defaultPlayers = {
                    whitelist: [],
                    blacklist: [],
                    operators: []
                };
                await this.savePlayers(serverPath, defaultPlayers);
                return defaultPlayers;
            }
            throw err;
        }
    }

    async savePlayers(serverPath, players) {
        const playersPath = this.getPlayersPath(serverPath);
        await fs.writeFile(playersPath, JSON.stringify(players, null, 2));
    }

    async listMods(serverPath) {
        const modsPath = this.getModsPath(serverPath);
        
        try {
            const entries = await fs.readdir(modsPath, { withFileTypes: true });
            const mods = [];
            
            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.zip') || entry.name.endsWith('.jar'))) {
                    const filePath = path.join(modsPath, entry.name);
                    const stats = await fs.stat(filePath);
                    mods.push({
                        name: entry.name,
                        path: entry.name,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
            
            return mods;
        } catch (err) {
            if (err.code === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }

    async listPlugins(serverPath) {
        const pluginsPath = this.getPluginsPath(serverPath);
        
        try {
            const entries = await fs.readdir(pluginsPath, { withFileTypes: true });
            const plugins = [];
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    const filePath = path.join(pluginsPath, entry.name);
                    const stats = await fs.stat(filePath);
                    plugins.push({
                        name: entry.name,
                        path: entry.name,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
            
            return plugins;
        } catch (err) {
            if (err.code === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }

    async deleteMod(serverPath, modName) {
        const modsPath = this.getModsPath(serverPath);
        const modPath = path.join(modsPath, modName);
        
        await fs.unlink(modPath);
        return { success: true };
    }

    async deletePlugin(serverPath, pluginName) {
        const pluginsPath = this.getPluginsPath(serverPath);
        const pluginPath = path.join(pluginsPath, pluginName);
        
        await fs.unlink(pluginPath);
        return { success: true };
    }

    async uploadMod(serverPath, file) {
        const modsPath = this.getModsPath(serverPath);
        const destPath = path.join(modsPath, file.name);
        
        await fs.mkdir(modsPath, { recursive: true });
        
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(destPath, buffer);
        
        return { success: true, name: file.name };
    }

    async uploadPlugin(serverPath, file) {
        const pluginsPath = this.getPluginsPath(serverPath);
        const destPath = path.join(pluginsPath, file.name);
        
        await fs.mkdir(pluginsPath, { recursive: true });
        
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(destPath, buffer);
        
        return { success: true, name: file.name };
    }

    async addPlayerToWhitelist(serverPath, player) {
        const players = await this.getPlayers(serverPath);
        
        const exists = players.whitelist.find(p => 
            p.uuid === player.uuid || p.name === player.name
        );
        
        if (!exists) {
            players.whitelist.push({
                uuid: player.uuid,
                name: player.name,
                addedAt: new Date().toISOString(),
                addedBy: player.addedBy || 'console'
            });
            await this.savePlayers(serverPath, players);
        }
        
        return players;
    }

    async removePlayerFromWhitelist(serverPath, playerName) {
        const players = await this.getPlayers(serverPath);
        
        players.whitelist = players.whitelist.filter(p => p.name !== playerName);
        await this.savePlayers(serverPath, players);
        
        return players;
    }

    async addPlayerToBlacklist(serverPath, player) {
        const players = await this.getPlayers(serverPath);
        
        const exists = players.blacklist.find(p => 
            p.uuid === player.uuid || p.name === player.name
        );
        
        if (!exists) {
            players.blacklist.push({
                uuid: player.uuid,
                name: player.name,
                reason: player.reason || 'No reason provided',
                bannedAt: new Date().toISOString(),
                bannedBy: player.bannedBy || 'console'
            });
            await this.savePlayers(serverPath, players);
        }
        
        return players;
    }

    async removePlayerFromBlacklist(serverPath, playerName) {
        const players = await this.getPlayers(serverPath);
        
        players.blacklist = players.blacklist.filter(p => p.name !== playerName);
        await this.savePlayers(serverPath, players);
        
        return players;
    }

    async addOperator(serverPath, player) {
        const players = await this.getPlayers(serverPath);
        
        const exists = players.operators.find(p => 
            p.uuid === player.uuid || p.name === player.name
        );
        
        if (!exists) {
            players.operators.push({
                uuid: player.uuid,
                name: player.name,
                level: player.level || 4,
                addedAt: new Date().toISOString()
            });
            await this.savePlayers(serverPath, players);
        }
        
        return players;
    }

    async removeOperator(serverPath, playerName) {
        const players = await this.getPlayers(serverPath);
        
        players.operators = players.operators.filter(p => p.name !== playerName);
        await this.savePlayers(serverPath, players);
        
        return players;
    }
}

export default new ServerDataService();
