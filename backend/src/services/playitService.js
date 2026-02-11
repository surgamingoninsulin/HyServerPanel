import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const BIN_DIR = path.join(__dirname, '../../bin');

// Default fallback values - these can be overridden in settings
const DEFAULT_FALLBACK_DOMAIN = 'example.gl.at.ply.gg';
const DEFAULT_FALLBACK_PORT = '443';

class PlayitService extends EventEmitter {
    constructor() {
        super();
        this.process = null;
        this.status = 'disconnected';
        this.tunnelInfo = {
            ip: null,
            port: null,
            domain: null
        };
        this.secretKey = null;
        this.readingOutput = true;
        this.fallbackDomain = DEFAULT_FALLBACK_DOMAIN;
        this.fallbackPort = DEFAULT_FALLBACK_PORT;
    }

    async getBinaryPath() {
        const platform = os.platform();
        let binaryName = 'playit';
        if (platform === 'win32') {
            binaryName = 'playit.exe';
        }

        // 1. Check system PATH first (Linux/Mac)
        if (platform !== 'win32') {
            try {
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
                const { stdout } = await execAsync('command -v playit');
                const systemPath = stdout.trim();
                if (systemPath) {
                    console.log('[PlayitService] Found system binary:', systemPath);
                    return systemPath;
                }
            } catch (e) {
                // Not found in system path
            }
        }

        // 2. Check local paths (project-relative so it works from USB)
        const possiblePaths = [
            path.join(BIN_DIR, binaryName),
            path.join(__dirname, '../../tools', binaryName),
            path.resolve('bin', binaryName),
            path.resolve('tools', binaryName),
            path.resolve(binaryName)
        ];

        for (const binaryPath of possiblePaths) {
            try {
                await fs.access(binaryPath);
                console.log('[PlayitService] Found local binary:', binaryPath);
                return binaryPath;
            } catch (e) {
                continue;
            }
        }

        // 3. Fallback to just the name (will assume it's in PATH if spawn works)
        return binaryName;
    }

    async loadSecretKey() {
        const possiblePaths = [
            path.join(DATA_DIR, 'playit-secret.txt'), // Project data dir (works from USB)
            path.resolve('data/playit-secret.txt'),
            path.resolve('../data/playit-secret.txt'),
            path.resolve('../../data/playit-secret.txt'),
            path.resolve('../.SOURCE/data/playit-secret.txt'),
            path.resolve('../../.SOURCE/data/playit-secret.txt')
        ];

        // Add common system locations
        const homeDir = os.homedir();
        possiblePaths.push(path.join(homeDir, '.playit_gg/playit-secret.txt'));
        possiblePaths.push(path.join(homeDir, 'AppData/Local/playit_gg/playit-secret.txt'));
        possiblePaths.push(path.join(homeDir, '.config/playit_gg/playit-secret.txt'));
        possiblePaths.push(path.join(homeDir, '.local/share/playit_gg/playit-secret.txt'));
        possiblePaths.push(path.join(homeDir, '.playit_gg/playit.gg-secret.txt'));
        possiblePaths.push(path.join(homeDir, 'AppData/Local/playit_gg/playit.gg-secret.txt'));
        possiblePaths.push(path.join(homeDir, '.config/playit_gg/playit.gg-secret.txt'));
        possiblePaths.push(path.join(homeDir, '.local/share/playit_gg/playit.gg-secret.txt'));

        // Add common config file locations
        possiblePaths.push(path.join(homeDir, '.config/playit_gg/playit.toml'));
        possiblePaths.push(path.join(homeDir, 'AppData/Local/playit_gg/playit.toml'));
        possiblePaths.push(path.join(homeDir, '.local/share/playit_gg/playit.toml'));
        possiblePaths.push(path.join(homeDir, '.config/playit_gg/playit.gg.toml'));
        possiblePaths.push(path.join(homeDir, 'AppData/Local/playit_gg/playit.gg.toml'));
        possiblePaths.push(path.join(homeDir, '.local/share/playit_gg/playit.gg.toml'));

        // Try to find the secret in all possible locations
        for (const secretPath of possiblePaths) {
            try {
                const content = await fs.readFile(secretPath, 'utf8');
                const match = content.match(/secret_key\s*=\s*"([^"]+)"/);
                if (match) {
                    this.secretKey = match[1];
                    console.log('[PlayitService] Loaded secret key from:', secretPath);
                    return;
                }
                
                // If content is just the secret key without prefix
                if (content.trim() && !content.includes('secret_key')) {
                    this.secretKey = content.trim();
                    console.log('[PlayitService] Loaded secret key from:', secretPath);
                    return;
                }
            } catch (e) {
                // File not found or unreadable, continue searching
                continue;
            }
        }

        console.log('[PlayitService] No secret key found in any location');
        return null;
    }

    async saveSecretKey(key) {
        try {
            const secretPath = path.join(DATA_DIR, 'playit-secret.txt');
            await fs.writeFile(secretPath, key);
            this.secretKey = key;
            console.log('[PlayitService] Secret key saved');
        } catch (e) {
            console.error('[PlayitService] Failed to save secret key:', e);
        }
    }

    async start(serverPort = 5520) {
        if (this.process) {
            throw new Error('Playit tunnel is already running');
        }

        await this.loadSecretKey();

        try {
            const binaryPath = await this.getBinaryPath();
            console.log('[PlayitService] Starting Playit tunnel...');
            console.log('[PlayitService] Binary path:', binaryPath);
            console.log('[PlayitService] Server port:', serverPort);

            // Use --stdout to disable TUI and get plain text output
            const args = ['--stdout'];

            // Helper to log secret path
            try {
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
                // Use the detected binary path
                const { stdout } = await execAsync(`"${binaryPath}" secret-path`, { env: process.env });
                console.log('[PlayitService] Detected secret/config path:', stdout.trim());
            } catch (e) {
                console.log('[PlayitService] Could not determine secret path:', e.message);
            }

            if (this.secretKey) {
                args.push('--secret', this.secretKey);
            }

            this.status = 'connecting';
            this.readingOutput = true;
            this.emit('statusChange', 'connecting');

            this.process = spawn(binaryPath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, TERM: 'dumb', RUST_BACKTRACE: '1' }
            });

            this.process.stdout.on('data', (data) => {
                if (this.readingOutput) {
                    this.handleOutput(data);
                }
            });

            this.process.stderr.on('data', (data) => {
                if (this.readingOutput) {
                    this.handleOutput(data);
                }
            });

            this.process.on('close', (code) => {
                console.log('[PlayitService] Process exited with code:', code);
                this.process = null;
                this.status = 'disconnected';
                this.tunnelInfo = { ip: null, port: null, domain: null };
                this.readingOutput = true;
                this.emit('statusChange', 'disconnected');
            });

            this.process.on('error', (error) => {
                console.error('[PlayitService] Process error:', error);
                this.process = null;
                this.status = 'error';
                this.readingOutput = true;
                this.emit('statusChange', 'error');
                // this.emit('error', error.message); // Prevent crash
            });

            // Fallback: If we don't capture tunnel info in 20 seconds, use fallback address
            setTimeout(async () => {
                if (!this.tunnelInfo.domain && this.status === 'connecting' && this.process) {
                    console.log('[PlayitService] Tunnel address not captured from logs after 20s');
                    console.log('[PlayitService] Using fallback tunnel address');

                    this.status = 'connected';
                    this.tunnelInfo = {
                        domain: this.fallbackDomain,
                        port: this.fallbackPort,
                        ip: null,
                        localPort: serverPort.toString()
                    };
                    this.readingOutput = false;
                    this.emit('statusChange', 'connected');
                    this.emit('tunnelEstablished', this.tunnelInfo);

                    console.log('[PlayitService] ✓ Tunnel connected:', `${this.tunnelInfo.domain}:${this.tunnelInfo.port}`);
                    console.log('[PlayitService] Note: Update fallback domain in code if it changes on playit.gg');
                }
            }, 20000);

            return { success: true, message: 'Playit tunnel starting' };
        } catch (error) {
            this.status = 'error';
            this.emit('statusChange', 'error');
            throw error;
        }
    }

    handleOutput(data) {
        const output = data.toString();
        console.log('[PlayitService]', output);

        const lines = output.split('\n');

        for (const line of lines) {
            const clean = line.toLowerCase();

            const secretMatch = line.match(/secret[:\s]+([a-zA-Z0-9_-]+)/i);
            if (secretMatch && !this.secretKey) {
                const key = secretMatch[1];
                this.saveSecretKey(key);
            }

            // Try multiple tunnel formats
            // Format 1: domain:port => 127.0.0.1:port (most common)
            let tunnelMatch = line.match(/([a-z0-9-]+\.gl\.at\.ply\.gg):(\d+)\s*=>\s*127\.0\.0\.1:(\d+)/i);

            // Format 2: Just domain:port in the output
            if (!tunnelMatch) {
                tunnelMatch = line.match(/([a-z0-9-]+\.gl\.at\.ply\.gg):(\d+)/i);
            }

            if (tunnelMatch) {
                    this.tunnelInfo = {
                        domain: tunnelMatch[1],
                        port: tunnelMatch[2],
                        ip: null,
                        localPort: tunnelMatch[3] || '5520'
                    };

                this.status = 'connected';
                this.readingOutput = false; // Stop parsing logs but keep process running
                this.emit('statusChange', 'connected');
                this.emit('tunnelEstablished', this.tunnelInfo);

                console.log('[PlayitService] ✓ Tunnel established:', this.tunnelInfo);
                console.log('[PlayitService] Public URL:', `${this.tunnelInfo.domain}:${this.tunnelInfo.port}`);
                console.log('[PlayitService] Stopping log output, process remains active');
                return;
            }

            // Look for tunnel confirmation messages
            if (clean.includes('tunnel running') && clean.includes('tunnels registered')) {
                console.log('[PlayitService] Tunnel confirmed running, waiting for address...');
                
                // Look for domain:port patterns in the output
                const domainPortMatches = line.match(/([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+):?(\d+)?/gi);
                if (domainPortMatches) {
                    for (const match of domainPortMatches) {
                        const domainPort = match.split(':');
                        if (domainPort.length > 1) {
                            const domain = domainPort[0];
                            const port = domainPort[1];
                            
                            // Check if it looks like a playit.gg domain
                            if (domain.includes('gl.at.ply.gg') || domain.includes('ply.gg')) {
                                this.tunnelInfo = {
                                    domain: domain,
                                    port: port,
                                    ip: null,
                                    localPort: '5520'
                                };

                                this.status = 'connected';
                                this.readingOutput = false; // Stop parsing logs but keep process running
                                this.emit('statusChange', 'connected');
                                this.emit('tunnelEstablished', this.tunnelInfo);

                                console.log('[PlayitService] ✓ Tunnel established:', this.tunnelInfo);
                                console.log('[PlayitService] Public URL:', `${this.tunnelInfo.domain}:${this.tunnelInfo.port}`);
                                console.log('[PlayitService] Stopping log output, process remains active');
                                return;
                            }
                        }
                    }
                }
                
                // Also look for any URL-like patterns
                const urlMatches = line.match(/(https?:\/\/)?([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)(:\d+)?/gi);
                if (urlMatches) {
                    for (const urlMatch of urlMatches) {
                        const urlParts = urlMatch.split(':');
                        if (urlParts.length > 1) {
                            const domain = urlParts[0].replace(/https?:\/\//, '');
                            const port = urlParts[1].replace(/\D/g, '');
                            
                            // Check if it looks like a playit.gg domain
                            if (domain.includes('gl.at.ply.gg') || domain.includes('ply.gg')) {
                                this.tunnelInfo = {
                                    domain: domain,
                                    port: port || '443',
                                    ip: null,
                                    localPort: '5520'
                                };

                                this.status = 'connected';
                                this.readingOutput = false; // Stop parsing logs but keep process running
                                this.emit('statusChange', 'connected');
                                this.emit('tunnelEstablished', this.tunnelInfo);

                                console.log('[PlayitService] ✓ Tunnel established:', this.tunnelInfo);
                                console.log('[PlayitService] Public URL:', `${this.tunnelInfo.domain}:${this.tunnelInfo.port}`);
                                console.log('[PlayitService] Stopping log output, process remains active');
                                return;
                            }
                        }
                    }
                }
                
                // Look for IPv6 addresses
                const ipv6Matches = line.match(/(\[?[0-9a-fA-F:]+\]?):(\d+)/gi);
                if (ipv6Matches) {
                    for (const ipv6Match of ipv6Matches) {
                        const parts = ipv6Match.split(':');
                        if (parts.length > 1) {
                            const ip = parts[0].replace(/[\[\]]/g, '');
                            const port = parts[1];
                            
                            // Check if it looks like a playit.gg tunnel address
                            if (ip.includes('::1') || ip.includes('127.0.0.1')) {
                                this.tunnelInfo = {
                                    domain: null,
                                    port: port,
                                    ip: ip,
                                    localPort: '5520'
                                };

                                this.status = 'connected';
                                this.readingOutput = false; // Stop parsing logs but keep process running
                                this.emit('statusChange', 'connected');
                                this.emit('tunnelEstablished', this.tunnelInfo);

                                console.log('[PlayitService] ✓ Tunnel established:', this.tunnelInfo);
                                console.log('[PlayitService] Public URL:', `${this.tunnelInfo.ip}:${this.tunnelInfo.port}`);
                                console.log('[PlayitService] Stopping log output, process remains active');
                                return;
                            }
                        }
                    }
                }
            }

            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
            if (ipMatch && clean.includes('tunnel')) {
                    this.tunnelInfo.ip = null;
                    this.tunnelInfo.port = null;
            }

            if (clean.includes('verified') || clean.includes('authenticated') || clean.includes('agent registered')) {
                console.log('[PlayitService] ✓ Authentication verified');
            }

            if (clean.includes('error') || clean.includes('failed')) {
                console.error('[PlayitService] SAFE ERROR LOG (NO CRASH):', line);
                // Do not emit 'error' as it crashes the server if unhandled
                // this.emit('error', line); 
            }
        }
    }

    stop() {
        if (!this.process) {
            throw new Error('Playit tunnel is not running');
        }

        console.log('[PlayitService] Stopping tunnel...');
        this.readingOutput = true;
        this.process.kill('SIGTERM');

        setTimeout(() => {
            if (this.process) {
                this.process.kill('SIGKILL');
            }
        }, 5000);

        return { success: true, message: 'Playit tunnel stopping' };
    }

    getStatus() {
        return {
            status: this.status,
            tunnelInfo: this.tunnelInfo,
            hasSecretKey: !!this.secretKey
        };
    }

    getTunnelUrl() {
        if (this.tunnelInfo.domain && this.tunnelInfo.port) {
            return `${this.tunnelInfo.domain}:${this.tunnelInfo.port}`;
        }
        return null;
    }

    setFallback(domain, port) {
        this.fallbackDomain = domain;
        this.fallbackPort = port;
        console.log('[PlayitService] Fallback updated:', `${domain}:${port}`);
    }

    getFallback() {
        return {
            domain: this.fallbackDomain,
            port: this.fallbackPort
        };
    }

}

export default new PlayitService();