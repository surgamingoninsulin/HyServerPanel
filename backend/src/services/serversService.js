import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { assertNotSourcePath } from '../utils/sourcePathGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
// Project root Servers folder: ./Servers/<server_name>/ (services -> src -> backend -> project root)
const SERVERS_BASE_DIR = path.join(__dirname, '../../..', 'Servers');
const SERVERS_JSON_FILE = path.join(DATA_DIR, 'servers.json');
const CURRENT_SERVER_ID_FILE = path.join(DATA_DIR, 'current-server.id');
const SERVER_ENV_FILE_NAME = '.env';
const SERVER_ENV_KEYS = {
    javaPath: 'PANEL_JAVA_PATH',
    jarFile: 'PANEL_JAR_FILE',
    assetsFile: 'PANEL_ASSETS_FILE',
    aotCacheFile: 'PANEL_AOT_CACHE_FILE',
    aotEnabled: 'PANEL_AOT_ENABLED',
    minMemory: 'PANEL_MIN_MEMORY',
    maxMemory: 'PANEL_MAX_MEMORY',
    port: 'PANEL_PORT',
    startCommand: 'PANEL_START_COMMAND'
};
const MANAGED_SERVER_ENV_KEYS = Object.values(SERVER_ENV_KEYS);

class ServersService {
    constructor() {
        this.servers = [];
        this.currentServerId = null;
    }

    getServerConfigPath(serverPath) {
        return path.join(serverPath, 'servers.json');
    }

    getHytaleConfigPath(serverPath) {
        return path.join(serverPath, 'hytale.json');
    }

    getPlayersPath(serverPath) {
        return path.join(serverPath, 'players.json');
    }

    getServerEnvPath(serverPath) {
        return path.join(serverPath, SERVER_ENV_FILE_NAME);
    }

    escapeEnvValue(value) {
        const raw = String(value ?? '');
        if (raw === '') return '""';
        if (!/[=\s#"\\]/.test(raw)) return raw;
        return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    parseEnvBoolean(value, fallback = false) {
        if (value == null) return fallback;
        const normalized = String(value).trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
        return fallback;
    }

    parseEnvPort(value, fallback = 5520) {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
            return fallback;
        }
        return parsed;
    }

    async readServerEnv(serverPath) {
        const envPath = this.getServerEnvPath(serverPath);
        try {
            const content = await fs.readFile(envPath, 'utf8');
            return dotenv.parse(content);
        } catch (err) {
            if (err.code === 'ENOENT') return {};
            throw err;
        }
    }

    applyServerEnvToConfig(serverConfig, envMap = {}) {
        const merged = { ...serverConfig };

        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.javaPath) && envMap[SERVER_ENV_KEYS.javaPath] !== '') {
            merged.javaPath = envMap[SERVER_ENV_KEYS.javaPath];
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.jarFile) && envMap[SERVER_ENV_KEYS.jarFile] !== '') {
            merged.jarFile = envMap[SERVER_ENV_KEYS.jarFile];
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.assetsFile) && envMap[SERVER_ENV_KEYS.assetsFile] !== '') {
            merged.assetsFile = envMap[SERVER_ENV_KEYS.assetsFile];
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.aotCacheFile)) {
            merged.aotCacheFile = envMap[SERVER_ENV_KEYS.aotCacheFile] || null;
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.aotEnabled)) {
            merged.aotEnabled = this.parseEnvBoolean(envMap[SERVER_ENV_KEYS.aotEnabled], merged.aotEnabled !== false);
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.minMemory) && envMap[SERVER_ENV_KEYS.minMemory] !== '') {
            merged.minMemory = envMap[SERVER_ENV_KEYS.minMemory];
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.maxMemory) && envMap[SERVER_ENV_KEYS.maxMemory] !== '') {
            merged.maxMemory = envMap[SERVER_ENV_KEYS.maxMemory];
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.port)) {
            merged.port = this.parseEnvPort(envMap[SERVER_ENV_KEYS.port], merged.port || 5520);
        }
        if (Object.prototype.hasOwnProperty.call(envMap, SERVER_ENV_KEYS.startCommand) && envMap[SERVER_ENV_KEYS.startCommand] !== '') {
            merged.startCommand = envMap[SERVER_ENV_KEYS.startCommand];
        }

        return merged;
    }

    buildManagedServerEnv(serverConfig = {}) {
        return {
            [SERVER_ENV_KEYS.javaPath]: serverConfig.javaPath || 'java',
            [SERVER_ENV_KEYS.jarFile]: serverConfig.jarFile || 'Server/HytaleServer.jar',
            [SERVER_ENV_KEYS.assetsFile]: serverConfig.assetsFile || 'Assets.zip',
            [SERVER_ENV_KEYS.aotCacheFile]: serverConfig.aotCacheFile || '',
            [SERVER_ENV_KEYS.aotEnabled]: serverConfig.aotEnabled === false ? 'false' : 'true',
            [SERVER_ENV_KEYS.minMemory]: serverConfig.minMemory || '1G',
            [SERVER_ENV_KEYS.maxMemory]: serverConfig.maxMemory || '2G',
            [SERVER_ENV_KEYS.port]: String(serverConfig.port ?? 5520),
            [SERVER_ENV_KEYS.startCommand]: serverConfig.startCommand || ''
        };
    }

    async writeServerEnv(serverPath, serverConfig = {}) {
        const envPath = this.getServerEnvPath(serverPath);
        await fs.mkdir(serverPath, { recursive: true });

        let existing = {};
        try {
            const content = await fs.readFile(envPath, 'utf8');
            existing = dotenv.parse(content);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        const managed = this.buildManagedServerEnv(serverConfig);
        const merged = { ...existing, ...managed };
        const customKeys = Object.keys(merged)
            .filter((key) => !MANAGED_SERVER_ENV_KEYS.includes(key))
            .sort((a, b) => a.localeCompare(b));
        const orderedKeys = [...MANAGED_SERVER_ENV_KEYS, ...customKeys];

        const lines = [];
        const seen = new Set();
        for (const key of orderedKeys) {
            if (seen.has(key)) continue;
            seen.add(key);
            const value = merged[key];
            if (value == null) continue;
            lines.push(`${key}=${this.escapeEnvValue(value)}`);
        }

        const payload = lines.length > 0 ? `${lines.join('\n')}\n` : '';
        await fs.writeFile(envPath, payload, 'utf8');
    }

    getServerFolderPath(serverName) {
        return path.join(SERVERS_BASE_DIR, serverName);
    }

    toAbsolutePath(candidatePath) {
        if (!candidatePath || typeof candidatePath !== 'string') {
            return null;
        }

        return path.isAbsolute(candidatePath)
            ? path.normalize(candidatePath)
            : path.resolve(process.cwd(), candidatePath);
    }

    toComparablePath(candidatePath) {
        const normalized = path.normalize(candidatePath);
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    }

    pathsEqual(leftPath, rightPath) {
        if (!leftPath || !rightPath) return false;
        return this.toComparablePath(leftPath) === this.toComparablePath(rightPath);
    }

    hasServerInMemory(server) {
        const absolutePath = this.toAbsolutePath(server?.path);
        return this.servers.some(existing =>
            existing.id === server?.id ||
            (absolutePath && this.pathsEqual(existing.path, absolutePath))
        );
    }

    async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    async ensureServersDir() {
        try {
            await fs.access(SERVERS_BASE_DIR);
        } catch {
            await fs.mkdir(SERVERS_BASE_DIR, { recursive: true });
        }
    }

    async load() {
        this.servers = [];
        this.currentServerId = null;

        await this.ensureDataDir();
        await this.ensureServersDir();

        let persistedServers = [];

        try {
            const data = await fs.readFile(SERVERS_JSON_FILE, 'utf8');
            const parsed = JSON.parse(data);
            this.currentServerId = parsed.currentServerId || null;
            if (Array.isArray(parsed.servers)) {
                persistedServers = parsed.servers;
            }
        } catch {
            try {
                const idData = await fs.readFile(CURRENT_SERVER_ID_FILE, 'utf8');
                this.currentServerId = idData.trim() || null;
            } catch {
                this.currentServerId = null;
            }
        }

        for (const storedServer of persistedServers) {
            if (!storedServer?.path) continue;

            const resolvedPath = this.toAbsolutePath(storedServer.path);
            if (!resolvedPath) continue;

            const loadedServer = await this.loadServerFromPath(resolvedPath, storedServer.id);
            const mergedServer = loadedServer
                ? {
                    ...loadedServer,
                    id: storedServer.id || loadedServer.id,
                    name: storedServer.name || loadedServer.name,
                    createdAt: storedServer.createdAt || loadedServer.createdAt,
                    updatedAt: storedServer.updatedAt || loadedServer.updatedAt
                }
                : {
                    id: storedServer.id || uuidv4(),
                    name: storedServer.name || path.basename(resolvedPath),
                    path: resolvedPath,
                    javaPath: storedServer.javaPath || 'java',
                    jarFile: storedServer.jarFile || 'Server/HytaleServer.jar',
                    assetsFile: storedServer.assetsFile || 'Assets.zip',
                    maxMemory: storedServer.maxMemory || '2G',
                    minMemory: storedServer.minMemory || '1G',
                    port: storedServer.port || 5520,
                    aotEnabled: storedServer.aotEnabled !== undefined ? storedServer.aotEnabled : true,
                    aotCacheFile: storedServer.aotCacheFile || 'Server/HytaleServer.aot',
                    modProviders: storedServer.modProviders || { curseforge: { apiKey: '' } },
                    playitDomain: storedServer.playitDomain,
                    playitPort: storedServer.playitPort,
                    createdAt: storedServer.createdAt,
                    updatedAt: storedServer.updatedAt || new Date().toISOString()
                };

            if (!this.hasServerInMemory(mergedServer)) {
                this.servers.push(mergedServer);
            }
        }

        await this.discoverServers();
    }

    async discoverServers() {
        try {
            const entries = await fs.readdir(SERVERS_BASE_DIR, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const serverPath = path.join(SERVERS_BASE_DIR, entry.name);
                    try {
                        const server = await this.loadServerFromPath(serverPath);
                        if (!server) {
                            continue;
                        }

                        if (!this.hasServerInMemory(server)) {
                            this.servers.push(server);
                            console.log('[ServersService] Loaded server:', server.name, 'ID:', server.id);
                        }
                    } catch (err) {
                        console.log('[ServersService] Error loading server from', serverPath, ':', err.message);
                    }
                }
            }
        } catch (err) {
            console.log('[ServersService] Cannot access Servers directory:', err.message);
        }

        if (this.servers.length > 0) {
            const currentExists = this.currentServerId
                ? this.servers.some(s => s.id === this.currentServerId)
                : false;

            if (!this.currentServerId || !currentExists) {
                this.currentServerId = this.servers[0].id;
                await this.saveCurrentServerId();
            }
        } else {
            this.currentServerId = null;
            await this.saveCurrentServerId();
        }

        console.log('[ServersService] Discovery complete. Found', this.servers.length, 'servers');
    }

    async autoCreateServerConfig(serverPath, folderName) {
        const configPath = this.getServerConfigPath(serverPath);

        try {
            await fs.access(configPath);
            return await this.loadServerFromPath(serverPath);
        } catch {
            console.log('[ServersService] Auto-creating server config for:', folderName);

            const newServer = {
                id: uuidv4(),
                name: folderName,
                path: serverPath,
                javaPath: 'java',
                jarFile: 'Server/HytaleServer.jar',
                assetsFile: 'Assets.zip',
                maxMemory: '2G',
                minMemory: '1G',
                port: 5520,
                aotEnabled: true,
                aotCacheFile: 'Server/HytaleServer.aot',
                modProviders: { curseforge: { apiKey: '' } },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await this.ensureServerFolderStructure(serverPath);
            await fs.writeFile(configPath, JSON.stringify({ servers: [newServer] }, null, 2));
            await this.writeServerEnv(serverPath, newServer);

            return newServer;
        }
    }

    async ensureServerFolderStructure(serverPath) {
        const folders = [
            'Server',
            'logs'
        ];

        for (const folder of folders) {
            const folderPath = path.join(serverPath, folder);
            try {
                await fs.access(folderPath);
            } catch {
                await fs.mkdir(folderPath, { recursive: true });
            }
        }

        const hytaleConfigPath = this.getHytaleConfigPath(serverPath);
        try {
            await fs.access(hytaleConfigPath);
        } catch {
            await fs.writeFile(hytaleConfigPath, JSON.stringify({
                MOTD: 'A Hytale Server',
                MaxPlayers: 100,
                ServerName: '',
                Version: '1.0.0',
                Defaults: { World: 'default' }
            }, null, 2));
        }

        const playersPath = this.getPlayersPath(serverPath);
        try {
            await fs.access(playersPath);
        } catch {
            await fs.writeFile(playersPath, JSON.stringify({
                whitelist: [],
                blacklist: [],
                operators: []
            }, null, 2));
        }
    }

    async loadServerFromPath(serverPath, providedId = null) {
        // Always use absolute path so jar/aot paths resolve correctly (avoids Server\Server\... on Windows)
        serverPath = path.isAbsolute(serverPath) ? path.normalize(serverPath) : path.resolve(process.cwd(), serverPath);
        const configPath = this.getServerConfigPath(serverPath);
        
        try {
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            
            let serverConfig = null;
            
            if (Array.isArray(config.servers) && config.servers.length > 0) {
                serverConfig = config.servers[0];
            } else if (config.id) {
                serverConfig = config;
            }
            
            if (!serverConfig) {
                return null;
            }
            
            let loadedServer = {
                id: serverConfig.id || providedId || uuidv4(),
                name: serverConfig.name || path.basename(serverPath),
                path: serverPath,
                javaPath: serverConfig.javaPath || 'java',
                jarFile: serverConfig.jarFile || 'Server/HytaleServer.jar',
                assetsFile: serverConfig.assetsFile || 'Assets.zip',
                maxMemory: serverConfig.maxMemory || '2G',
                minMemory: serverConfig.minMemory || '1G',
                port: serverConfig.port || 5520,
                aotEnabled: serverConfig.aotEnabled !== undefined ? serverConfig.aotEnabled : true,
                aotCacheFile: serverConfig.aotCacheFile || 'Server/HytaleServer.aot',
                modProviders: serverConfig.modProviders || { curseforge: { apiKey: '' } },
                playitDomain: serverConfig.playitDomain,
                playitPort: serverConfig.playitPort,
                createdAt: serverConfig.createdAt,
                updatedAt: serverConfig.updatedAt || new Date().toISOString()
            };
            try {
                const envMap = await this.readServerEnv(serverPath);
                loadedServer = this.applyServerEnvToConfig(loadedServer, envMap);
            } catch (envErr) {
                console.warn('[ServersService] Failed to parse server .env for', serverPath, ':', envErr.message);
            }

            return loadedServer;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.log('[ServersService] Error reading server config:', err.message);
            }
            return null;
        }
    }

    async list() {
        return this.servers;
    }

    async getById(id) {
        return this.servers.find(s => s.id === id) || null;
    }

    async getCurrent() {
        if (!this.currentServerId) {
            return null;
        }
        return this.servers.find(s => s.id === this.currentServerId) || null;
    }

    async setCurrent(id) {
        const server = this.servers.find(s => s.id === id);
        if (server) {
            this.currentServerId = id;
            await this.saveCurrentServerId();
            return server;
        }
        throw new Error(`Server ${id} not found`);
    }

    async saveCurrentServerId() {
        await this.ensureDataDir();
        await fs.writeFile(CURRENT_SERVER_ID_FILE, this.currentServerId || '');
        
        let serversData = { servers: this.servers, currentServerId: this.currentServerId };
        try {
            const existingData = await fs.readFile(SERVERS_JSON_FILE, 'utf8');
            const parsed = JSON.parse(existingData);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                serversData = {
                    ...parsed,
                    servers: this.servers,
                    currentServerId: this.currentServerId
                };
            }
        } catch {}
        
        await fs.writeFile(SERVERS_JSON_FILE, JSON.stringify(serversData, null, 2));
    }

    async create(serverData) {
        await this.load();
        const skipFolderBootstrap = serverData?.skipFolderBootstrap === true || serverData?.installMode === 'auto';

        let serverPath = typeof serverData.path === 'string' ? serverData.path.trim() : '';
        if (!serverPath) {
            const safeName = (serverData.name || 'New Server').replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'NewServer';
            serverPath = this.getServerFolderPath(safeName);
        } else if (path.isAbsolute(serverPath)) {
            serverPath = path.normalize(serverPath);
        } else {
            serverPath = path.resolve(process.cwd(), serverPath);
        }
        serverPath = assertNotSourcePath(serverPath, 'Server path');
        
        let panelSettings = null;
        try {
            const settingsPath = path.join(DATA_DIR, 'settings.json');
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            panelSettings = JSON.parse(settingsData);
        } catch {}

        const newServer = {
            id: uuidv4(),
            name: serverData.name || 'New Server',
            path: serverPath,
            javaPath: serverData.javaPath || panelSettings?.javaPath || 'java',
            jarFile: serverData.jarFile || panelSettings?.jarFile || 'Server/HytaleServer.jar',
            assetsFile: serverData.assetsFile || panelSettings?.assetsFile || 'Assets.zip',
            maxMemory: serverData.maxMemory || panelSettings?.maxMemory || '2G',
            minMemory: serverData.minMemory || panelSettings?.minMemory || '1G',
            port: serverData.port || panelSettings?.port || 5520,
            aotEnabled: serverData.aotEnabled !== undefined ? serverData.aotEnabled : (panelSettings?.aotEnabled !== undefined ? panelSettings?.aotEnabled : true),
            aotCacheFile: serverData.aotCacheFile || panelSettings?.aotCacheFile || 'Server/HytaleServer.aot',
            modProviders: serverData.modProviders || panelSettings?.modProviders || { curseforge: { apiKey: '' } },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.ensureServersDir();
        await fs.mkdir(serverPath, { recursive: true });
        if (!skipFolderBootstrap) {
            await this.ensureServerFolderStructure(serverPath);
        }

        // Always persist a per-server local config file (Servers/<name>/servers.json).
        const configPath = this.getServerConfigPath(serverPath);
        await fs.writeFile(configPath, JSON.stringify({ servers: [newServer] }, null, 2));
        await this.writeServerEnv(serverPath, newServer);

        this.servers.push(newServer);
        
        if (this.servers.length === 1) {
            await this.setCurrent(newServer.id);
        } else {
            await this.saveCurrentServerId();
        }
        
        return newServer;
    }

    async import(importData) {
        await this.load();

        let panelSettings = null;
        try {
            const settingsPath = path.join(DATA_DIR, 'settings.json');
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            panelSettings = JSON.parse(settingsData);
        } catch {}

        let sourcePath = importData.path;
        if (!path.isAbsolute(sourcePath)) {
            sourcePath = path.resolve(sourcePath);
        }

        const jarFile = importData.jarFile || panelSettings?.jarFile || 'HytaleServer.jar';
        try {
            const jarPath = path.join(sourcePath, jarFile);
            await fs.access(jarPath);
        } catch {
            throw new Error('No valid Hytale server found at the specified path');
        }

        const safeName = (importData.name || path.basename(sourcePath)).replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'ImportedServer';
        const targetPath = path.join(SERVERS_BASE_DIR, safeName);

        try {
            await fs.access(targetPath);
            throw new Error(`A server folder named "${safeName}" already exists in Servers/. Choose a different name or remove it first.`);
        } catch (e) {
            if (e.message && e.message.includes('already exists')) throw e;
            if (e.code !== 'ENOENT') throw e;
        }

        await this.ensureServersDir();
        await fs.cp(sourcePath, targetPath, { recursive: true });
        await this.ensureServerFolderStructure(targetPath);

        const importedServer = {
            id: uuidv4(),
            name: importData.name || safeName,
            path: targetPath,
            javaPath: importData.javaPath || panelSettings?.javaPath || 'java',
            jarFile: importData.jarFile || panelSettings?.jarFile || 'Server/HytaleServer.jar',
            assetsFile: importData.assetsFile || panelSettings?.assetsFile || 'Assets.zip',
            maxMemory: importData.maxMemory || panelSettings?.maxMemory || '2G',
            minMemory: importData.minMemory || panelSettings?.minMemory || '1G',
            port: importData.port ?? panelSettings?.port ?? 5520,
            aotEnabled: importData.aotEnabled !== undefined ? importData.aotEnabled : (panelSettings?.aotEnabled !== undefined ? panelSettings?.aotEnabled : true),
            aotCacheFile: importData.aotCacheFile || panelSettings?.aotCacheFile || 'Server/HytaleServer.aot',
            modProviders: importData.modProviders || panelSettings?.modProviders || { curseforge: { apiKey: '' } },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const configPath = this.getServerConfigPath(targetPath);
        await fs.writeFile(configPath, JSON.stringify({ servers: [importedServer] }, null, 2));
        await this.writeServerEnv(targetPath, importedServer);

        this.servers.push(importedServer);
        if (this.servers.length === 1) {
            await this.setCurrent(importedServer.id);
        } else {
            await this.saveCurrentServerId();
        }

        console.log('[ServersService] Imported server: copied', sourcePath, 'to', targetPath);
        return importedServer;
    }

    async update(id, updates) {
        await this.load();
        
        const index = this.servers.findIndex(s => s.id === id);
        if (index === -1) {
            throw new Error(`Server ${id} not found`);
        }

        // Never allow empty path updates to clobber an existing server path.
        if (updates.path != null && typeof updates.path === 'string' && updates.path.trim() === '') {
            updates = { ...updates };
            delete updates.path;
        }

        // Resolve path to absolute when panel configuration saves server path
        if (updates.path != null && updates.path !== '' && !path.isAbsolute(updates.path)) {
            updates = { ...updates, path: path.resolve(process.cwd(), updates.path) };
        } else if (updates.path != null && updates.path !== '') {
            updates = { ...updates, path: path.normalize(updates.path) };
        }

        if (updates.path != null && updates.path !== '') {
            updates = { ...updates, path: assertNotSourcePath(updates.path, 'Server path') };
        }

        this.servers[index] = {
            ...this.servers[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const configPath = this.getServerConfigPath(this.servers[index].path);
        await fs.mkdir(this.servers[index].path, { recursive: true });
        // Preserve playit fallback and CurseForge API key from existing file so updates never clobber them
        try {
            const data = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(data);
            const existing = Array.isArray(config.servers) && config.servers.length > 0
                ? (config.servers.find(s => s.id === id) || config.servers[0])
                : null;
            if (existing) {
                if (existing.playitDomain != null) this.servers[index].playitDomain = existing.playitDomain;
                if (existing.playitPort != null) this.servers[index].playitPort = existing.playitPort;
                if (existing.modProviders?.curseforge?.apiKey != null && existing.modProviders.curseforge.apiKey !== '') {
                    this.servers[index].modProviders = this.servers[index].modProviders || {};
                    this.servers[index].modProviders.curseforge = this.servers[index].modProviders.curseforge || {};
                    this.servers[index].modProviders.curseforge.apiKey = existing.modProviders.curseforge.apiKey;
                }
            }
        } catch (e) {
            if (e.code !== 'ENOENT') console.error('[ServersService] Preserve playit/apiKey from config:', e.message);
        }

        await fs.writeFile(configPath, JSON.stringify({ servers: [this.servers[index]] }, null, 2));
        await this.writeServerEnv(this.servers[index].path, this.servers[index]);
        await this.saveCurrentServerId();

        return this.servers[index];
    }

    async delete(id, options = {}) {
        await this.load();
        
        const index = this.servers.findIndex(s => s.id === id);
        if (index === -1) {
            throw new Error(`Server ${id} not found`);
        }

        const server = this.servers[index];
        const shouldDeleteFiles = options?.deleteFiles !== false;
        const fallbackServerId = options?.fallbackServerId || null;

        if (shouldDeleteFiles) {
            const resolvedServerPath = assertNotSourcePath(this.toAbsolutePath(server.path), 'Server path');
            const rootPath = path.parse(resolvedServerPath).root;

            if (this.pathsEqual(resolvedServerPath, rootPath)) {
                const error = new Error('Refusing to delete drive root');
                error.statusCode = 400;
                throw error;
            }

            if (this.pathsEqual(resolvedServerPath, PROJECT_ROOT) || this.pathsEqual(resolvedServerPath, SERVERS_BASE_DIR)) {
                const error = new Error('Refusing to delete protected project path');
                error.statusCode = 400;
                throw error;
            }

            // Stop installer/download activity for this folder before deletion.
            try {
                const installerService = (await import('./installerService.js')).default;
                if (installerService?.stopIfTargetPath) {
                    await installerService.stopIfTargetPath(resolvedServerPath);
                }
            } catch (err) {
                console.warn('[ServersService] Could not stop installer before delete:', err.message);
            }

            // Stop running server process for this server if needed.
            try {
                const multiServerService = (await import('./multiServerService.js')).default;
                const instance = multiServerService?.getOrCreateInstance ? multiServerService.getOrCreateInstance(id) : null;
                if (instance?.getStatus?.().status && instance.getStatus().status !== 'offline') {
                    try {
                        instance.stop();
                    } catch {}
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (err) {
                console.warn('[ServersService] Could not stop server process before delete:', err.message);
            }

            try {
                const maxAttempts = 6;
                let lastDeleteError = null;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        await fs.rm(resolvedServerPath, { recursive: true, force: true });
                        lastDeleteError = null;
                        break;
                    } catch (err) {
                        lastDeleteError = err;
                        const code = err?.code;
                        const isLockError = code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY';
                        if (!isLockError || attempt === maxAttempts) {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, attempt * 500));
                    }
                }

                if (lastDeleteError) {
                    throw lastDeleteError;
                }
            } catch (err) {
                const error = new Error(`Failed to delete server folder "${resolvedServerPath}": ${err.message}`);
                error.statusCode = 500;
                throw error;
            }
        } else {
            const configPath = this.getServerConfigPath(server.path);
            try {
                await fs.unlink(configPath);
            } catch (err) {
                console.log('[ServersService] Could not delete server config file:', err.message);
            }
        }

        this.servers.splice(index, 1);

        if (this.currentServerId === id) {
            const preferredFallback = this.servers.find(s => s.id === fallbackServerId);
            this.currentServerId = preferredFallback?.id || this.servers[0]?.id || null;
        }

        await this.saveCurrentServerId();

        return { success: true, deletedPath: server.path };
    }

    async duplicate(id, newName) {
        await this.load();
        
        const original = this.servers.find(s => s.id === id);
        if (!original) {
            throw new Error(`Server ${id} not found`);
        }

        const safeName = newName.replace(/[^a-zA-Z0-9-_ ]/g, '');
        const newPath = this.getServerFolderPath(safeName);

        await this.ensureServerFolderStructure(newPath);

        const duplicatedServer = {
            ...original,
            id: uuidv4(),
            name: safeName,
            path: newPath,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const configPath = this.getServerConfigPath(newPath);
        await fs.writeFile(configPath, JSON.stringify({ servers: [duplicatedServer] }, null, 2));
        await this.writeServerEnv(newPath, duplicatedServer);

        this.servers.push(duplicatedServer);
        await this.saveCurrentServerId();

        return duplicatedServer;
    }

    async getServerPath(id) {
        const server = await this.getById(id);
        return server?.path || null;
    }

    async getServerDataPath(id, subPath = '') {
        const serverPath = await this.getServerPath(id);
        if (!serverPath) return null;
        return subPath ? path.join(serverPath, subPath) : serverPath;
    }

    async discoverFromPath(serverPath) {
        let server = await this.loadServerFromPath(serverPath);
        
        if (!server) {
            const folderName = path.basename(serverPath);
            server = await this.autoCreateServerConfig(serverPath, folderName);
        }

        if (server) {
            const exists = this.servers.find(s => s.id === server.id);
            if (!exists) {
                this.servers.push(server);
                await this.saveCurrentServerId();
            }
        }

        return server;
    }
}

export default new ServersService();
