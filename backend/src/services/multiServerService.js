import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import pidusage from 'pidusage';
import serversService from './serversService.js';
import settingsService from './settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

class MultiServerManager extends EventEmitter {
  constructor() {
    super();
    // Map of serverId -> server instance
    this.serverInstances = new Map();
    this.MAX_LOGS = 1000;
    this.io = null;
  }

  setSocket(io) {
    this.io = io;
    
    // Forward all events to socket.io
    this.on('console', (data) => {
      if (this.io) {
        this.io.emit('console', data);
      }
    });
    
    this.on('statusChange', (data) => {
      if (this.io) {
        this.io.emit('statusChange', data);
      }
    });
    
    this.on('startError', (data) => {
      if (this.io) {
        this.io.emit('startError', data);
      }
    });
    
    this.on('stats', (data) => {
      if (this.io) {
        this.io.emit('stats', data);
      }
    });
    
    this.on('authRequest', (data) => {
      if (this.io) {
        this.io.emit('authRequest', data);
      }
    });
  }

  getOrCreateInstance(serverId) {
    if (!this.serverInstances.has(serverId)) {
      this.serverInstances.set(serverId, new ServerInstance(serverId, this));
    }
    return this.serverInstances.get(serverId);
  }

  async getServer(serverId) {
    return await serversService.getById(serverId);
  }

  async getCurrentServer() {
    return await serversService.getCurrent();
  }

  async getInstanceById(serverId) {
    const server = await this.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    return this.getOrCreateInstance(serverId);
  }

  async getCurrentInstance() {
    const server = await this.getCurrentServer();
    if (!server) {
      throw new Error('No server configured');
    }
    return this.getOrCreateInstance(server.id);
  }

  async getInstanceFromRequest(req) {
    const serverId = req.query.serverId || req.body.serverId || req.headers['x-server-id'];
    if (serverId) {
      return await this.getInstanceById(serverId);
    }
    return await this.getCurrentInstance();
  }

  // Get status for current server
  async getStatus() {
    try {
      const instance = await this.getCurrentInstance();
      return instance.getStatus();
    } catch (error) {
      return {
        status: 'offline',
        stats: {
          uptime: 0,
          cpu: 0,
          memory: 0,
          tps: 20.0,
          players: { online: 0, max: 20 }
        },
        error: error.message
      };
    }
  }

  // Start current server
  async start() {
    const instance = await this.getCurrentInstance();
    return instance.start();
  }

  // Stop current server
  async stop() {
    const instance = await this.getCurrentInstance();
    return instance.stop();
  }

  // Restart current server
  async restart() {
    const instance = await this.getCurrentInstance();
    return instance.restart();
  }

  // Send command to current server
  async sendCommand(command) {
    const instance = await this.getCurrentInstance();
    return instance.sendCommand(command);
  }

  // Get logs for current server
  async getLogs() {
    const instance = await this.getCurrentInstance();
    return instance.logs;
  }

  // Get stats for current server
  async getStats() {
    const instance = await this.getCurrentInstance();
    return instance.stats;
  }

  // Get status for a specific server
  async getServerStatus(serverId) {
    const instance = this.getOrCreateInstance(serverId);
    return instance.getStatus();
  }

  // Build server arguments
  buildServerArguments(serverArgs) {
    const args = [];

    // Boolean flags (add if true)
    const booleanFlags = [
      'acceptEarlyPlugins', 'allowOp', 'backup', 'bare', 'disableAssetCompare',
      'disableCpbBuild', 'disableFileWatcher', 'disableSentry', 'eventDebug',
      'generateSchema', 'singleplayer', 'validateAssets', 'validateWorldGen',
      'shutdownAfterValidate'
    ];

    booleanFlags.forEach(flag => {
      if (serverArgs[flag]) {
        args.push(`--${flag.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
      }
    });

    // Value parameters (add if they have a value)
    const valueParams = {
      'authMode': 'auth-mode',
      'bind': 'bind',
      'backupDir': 'backup-dir',
      'backupFrequency': 'backup-frequency',
      'backupMaxCount': 'backup-max-count',
      'clientPid': 'client-pid',
      'earlyPlugins': 'early-plugins',
      'forceNetworkFlush': 'force-network-flush',
      'identityToken': 'identity-token',
      'log': 'log',
      'migrateWorlds': 'migrate-worlds',
      'ownerName': 'owner-name',
      'ownerUuid': 'owner-uuid',
      'worldGen': 'world-gen'
    };

    Object.entries(valueParams).forEach(([key, flag]) => {
      const value = serverArgs[key];
      if (value && value !== '' && value !== false) {
        args.push(`--${flag}`);
        args.push(String(value));
      }
    });

    return args;
  }
}

class ServerInstance extends EventEmitter {
  constructor(serverId, manager) {
    super();
    this.serverId = serverId;
    this.manager = manager;
    this.process = null;
    this.status = 'offline';
    this.stats = {
      uptime: 0,
      cpu: 0,
      memory: 0,
      tps: 20.0,
      players: { online: 0, max: 20 },
      authFileExists: false
    };
    this.logs = [];
    this.statsInterval = null;
    this.logStream = null;
    this.serverConfig = null;
  }

  async loadConfig() {
    await serversService.load();
    this.serverConfig = await serversService.getById(this.serverId);
    if (!this.serverConfig) {
      throw new Error(`Server ${this.serverId} not found`);
    }
    return this.serverConfig;
  }

  getStatus() {
    return {
      status: this.status,
      stats: this.stats,
      serverId: this.serverId
    };
  }

  addLog(data) {
    const line = data.toString();
    this.logs.push(line);
    if (this.logs.length > this.manager.MAX_LOGS) {
      this.logs.shift();
    }
    this.manager.emit('console', { serverId: this.serverId, line });
    return line.replace(/\x1B\[[0-9;]*[mK]/g, '');
  }

  async start() {
    if (this.process) {
      throw new Error('Server is already running');
    }

    try {
      await this.loadConfig();
      const config = this.serverConfig;

      if (!config.path) {
        throw new Error('Server path not configured');
      }

      // Resolve server path to absolute so jar/aot paths are correct (avoids Server\Server\... on Windows)
      const basePath = path.isAbsolute(config.path) ? path.normalize(config.path) : path.resolve(process.cwd(), config.path);

      // Check if auth.enc exists
      try {
        await fs.access(path.join(basePath, 'auth.enc'));
        this.stats.authFileExists = true;
      } catch {
        this.stats.authFileExists = false;
      }

      // Get server arguments for this server (from General + Server Arguments tabs)
      let serverArgs = [];
      try {
        const args = await settingsService.getServerArguments(this.serverId);
        serverArgs = this.manager.buildServerArguments(args);
      } catch (err) {
        console.log('[Server] No server arguments for this server, using defaults:', err.message);
      }

      // Build command: jarFile and aotCacheFile from panel config (e.g. HytaleServer.jar or Server/HytaleServer.jar — no hardcoded prefix)
      const jarFile = config.jarFile || 'HytaleServer.jar';
      const aotFile = config.aotCacheFile || 'HytaleServer.aot';
      let jarPath = path.isAbsolute(jarFile) ? jarFile : path.join(basePath, jarFile);
      let aotPath = path.isAbsolute(aotFile) ? aotFile : path.join(basePath, aotFile);

      // Resolve jar with common fallback rules so each server can use either root or Server/ layout.
      try {
        await fs.access(jarPath);
      } catch {
        const jarBaseName = path.basename(jarFile);
        const fallbackCandidates = [];
        if (!path.isAbsolute(jarFile)) {
          if (jarFile.includes('/') || jarFile.includes('\\')) {
            fallbackCandidates.push(path.join(basePath, jarBaseName));
          } else {
            fallbackCandidates.push(path.join(basePath, 'Server', jarBaseName));
          }
        }

        let foundPath = null;
        for (const candidate of fallbackCandidates) {
          try {
            await fs.access(candidate);
            foundPath = candidate;
            break;
          } catch {}
        }

        if (foundPath) {
          jarPath = foundPath;
        } else {
          const tried = [jarPath, ...fallbackCandidates].join(' | ');
          throw new Error(`Jar file not found for "${config.name || this.serverId}". Tried: ${tried}`);
        }
      }

      // AOT path fallback mirrors jar behavior, but AOT remains optional.
      if (aotFile) {
        try {
          await fs.access(aotPath);
        } catch {
          if (!path.isAbsolute(aotFile)) {
            const aotBaseName = path.basename(aotFile);
            const aotCandidates = (aotFile.includes('/') || aotFile.includes('\\'))
              ? [path.join(basePath, aotBaseName)]
              : [path.join(basePath, 'Server', aotBaseName)];
            for (const candidate of aotCandidates) {
              try {
                await fs.access(candidate);
                aotPath = candidate;
                break;
              } catch {}
            }
          }
        }
      }

      let aotArg = '';

      if (config.aotEnabled !== false) {
        try {
          await fs.access(aotPath);
          // Quote AOT path so Java receives it correctly on Windows (avoids "main class Server\Server\HytaleServer.aot")
          aotArg = `-XX:AOTCache="${aotPath}" `;
        } catch {
          console.log('[Server] AOT cache not found, starting without it');
        }
      }

      const assetsFile = config.assetsFile || 'Assets.zip';
      let assetsPath = path.isAbsolute(assetsFile) ? assetsFile : path.join(basePath, assetsFile);
      try {
        await fs.access(assetsPath);
      } catch {
        if (!path.isAbsolute(assetsFile)) {
          const assetsBaseName = path.basename(assetsFile);
          const assetsCandidates = (assetsFile.includes('/') || assetsFile.includes('\\'))
            ? [path.join(basePath, assetsBaseName)]
            : [path.join(basePath, 'Server', assetsBaseName)];
          for (const candidate of assetsCandidates) {
            try {
              await fs.access(candidate);
              assetsPath = candidate;
              break;
            } catch {}
          }
        }
      }
      const cmd = `${config.javaPath || 'java'} ${aotArg}-Xms${config.minMemory} -Xmx${config.maxMemory} -jar "${jarPath}" --assets "${assetsPath}" ${serverArgs.join(' ')}`;

      console.log(`[Server ${this.serverId}] Starting with command:`, cmd);
      console.log(`[Server ${this.serverId}] Working directory:`, basePath);

      // Spawn process
      this.process = spawn(cmd, [], {
        cwd: basePath,
        shell: true,
        windowsHide: true
      });

      this.status = 'starting';
      this.emit('statusChange', { serverId: this.serverId, status: 'starting' });
      this.manager.emit('statusChange', { serverId: this.serverId, status: 'starting' });

      // Handle process events
      this.process.stdout.on('data', (data) => {
        const line = this.addLog(data);
        this.parseLogLine(line);
      });

      this.process.stderr.on('data', (data) => {
        const line = this.addLog(data);
        this.parseLogLine(line);
      });

      this.process.on('error', (error) => {
        console.error(`[Server ${this.serverId}] Process error:`, error);
        this.addLog(`[ERROR] ${error.message}`);
        this.status = 'offline';
        this.emit('startError', { serverId: this.serverId, error: error.message });
        this.manager.emit('startError', { serverId: this.serverId, error: error.message });
        this.cleanup();
      });

      this.process.on('exit', (code) => {
        console.log(`[Server ${this.serverId}] Process exited with code ${code}`);
        this.addLog(`[System] Server stopped with code ${code}`);
        this.status = 'offline';
        this.emit('statusChange', { serverId: this.serverId, status: 'offline' });
        this.manager.emit('statusChange', { serverId: this.serverId, status: 'offline' });
        this.cleanup();
      });

      // Start stats monitoring
      this.startStatsMonitoring();

      return { 
        success: true, 
        message: 'Server starting...',
        serverId: this.serverId,
        command: cmd 
      };

    } catch (error) {
      console.error(`[Server ${this.serverId}] Start failed:`, error);
      this.status = 'offline';
      throw error;
    }
  }

  stop() {
    if (!this.process) {
      throw new Error('Server is not running');
    }

    this.process.kill('SIGTERM');
    
    // Force kill after 10 seconds if still running
    setTimeout(() => {
      if (this.process) {
        console.log(`[Server ${this.serverId}] Force killing process...`);
        this.process.kill('SIGKILL');
      }
    }, 10000);

    return { 
      success: true, 
      message: 'Server stopping...',
      serverId: this.serverId 
    };
  }

  restart() {
    if (this.process) {
      this.stop();
      setTimeout(() => {
        this.start();
      }, 2000);
      return { 
        success: true, 
        message: 'Server restarting...',
        serverId: this.serverId 
      };
    } else {
      return this.start();
    }
  }

  sendCommand(command) {
    if (!this.process || !this.process.stdin) {
      throw new Error('Server is not running');
    }

    this.process.stdin.write(command + '\n');
    return { 
      success: true, 
      message: 'Command sent',
      serverId: this.serverId 
    };
  }

  parseLogLine(line) {
    // Parse player count
    const playerMatch = line.match(/Players online: (\d+)\/(\d+)/);
    if (playerMatch) {
      this.stats.players.online = parseInt(playerMatch[1]);
      this.stats.players.max = parseInt(playerMatch[2]);
    }

    // Parse TPS
    const tpsMatch = line.match(/TPS: ([\d.]+)/);
    if (tpsMatch) {
      this.stats.tps = parseFloat(tpsMatch[1]);
    }

    // Server ready
    if (line.includes('Server started') || line.includes('Done!')) {
      this.status = 'online';
      this.emit('statusChange', { serverId: this.serverId, status: 'online' });
      this.manager.emit('statusChange', { serverId: this.serverId, status: 'online' });
    }

    // Auth request
    if (line.includes('Please authenticate') || line.includes('auth.enc')) {
      this.emit('authRequest', { serverId: this.serverId });
      this.manager.emit('authRequest', { serverId: this.serverId });
    }
  }

  startStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      if (this.process && this.process.pid) {
        try {
          const stats = await pidusage(this.process.pid);
          this.stats.cpu = stats.cpu;
          this.stats.memory = stats.memory / 1024 / 1024; // Convert to MB
          this.stats.uptime = stats.elapsed;

          this.emit('stats', { 
            serverId: this.serverId, 
            stats: this.stats 
          });
          this.manager.emit('stats', { 
            serverId: this.serverId, 
            stats: this.stats 
          });
        } catch (error) {
          // Process might have exited
        }
      }
    }, 2000);
  }

  cleanup() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.process = null;
    this.stats = {
      uptime: 0,
      cpu: 0,
      memory: 0,
      tps: 20.0,
      players: { online: 0, max: 20 },
      authFileExists: false
    };
  }
}

export default new MultiServerManager();
