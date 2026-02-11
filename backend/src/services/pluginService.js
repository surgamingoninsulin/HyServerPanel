import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import serversService from './serversService.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

class PluginService {
  constructor() {
    this.registryPath = path.join(DATA_DIR, 'installed_mods.json');
  }

  async getRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {}; // Empty registry if missing
    }
  }

  async saveRegistry(registry) {
    try {
      await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2));
    } catch (err) {
      console.error("[PluginService] Failed to save registry:", err);
    }
  }

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

  async getModsPath(serverId = null) {
    const serverPath = await this.getServerPath(serverId);
    const modsPath = path.join(serverPath, 'mods');

    try {
      await fs.access(modsPath);
    } catch {
      await fs.mkdir(modsPath, { recursive: true });
    }

    return modsPath;
  }

  async listPlugins(serverId = null) {
    const modsPath = await this.getModsPath(serverId);
    const registry = await this.getRegistry();

    try {
      const files = await fs.readdir(modsPath, { withFileTypes: true });

      const plugins = await Promise.all(files
        .filter(dirent => dirent.isFile() && (dirent.name.toLowerCase().endsWith('.jar') || dirent.name.toLowerCase().endsWith('.zip')))
        .map(async (dirent) => {
          try {
            const stats = await fs.stat(path.join(modsPath, dirent.name));
            const meta = registry[dirent.name] || {};

            return {
              name: dirent.name,
              fileName: dirent.name,
              size: stats.size,
              lastModified: stats.mtime,
              displayName: meta.name || dirent.name,
              logo: meta.logo || null,
              provider: meta.provider || 'manual',
              modId: meta.modId || null,
              description: meta.summary || null,
              websiteUrl: meta.websiteUrl || null
            };
          } catch (err) {
            console.error(`[PluginService] Error stating file ${dirent.name}:`, err);
            return null;
          }
        }));

      const validPlugins = plugins.filter(p => p !== null);
      return validPlugins;
    } catch (error) {
      console.error('[PluginService] Error listing plugins:', error);
      return [];
    }
  }

  async uploadPlugin(fileName, buffer, serverId = null) {
    const modsPath = await this.getModsPath(serverId);
    const filePath = path.join(modsPath, fileName);

    await fs.writeFile(filePath, buffer);
    console.log(`[PluginService] Uploaded plugin: ${fileName}`);

    return { success: true, name: fileName };
  }

  async deletePlugin(name, serverId = null) {
    const modsPath = await this.getModsPath(serverId);
    const filePath = path.join(modsPath, name);

    try {
      await fs.unlink(filePath);
      console.log(`[PluginService] Deleted plugin: ${name}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Plugin '${name}' not found`);
      }
      throw err;
    }

    return { success: true };
  }

  async installFromUrl(url, fileName, metadata = null, serverId = null) {
    const modsPath = await this.getModsPath(serverId);
    const filePath = path.join(modsPath, fileName);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.writeFile(filePath, response.data);

    if (metadata) {
      const registry = await this.getRegistry();
      registry[fileName] = metadata;
      await this.saveRegistry(registry);
    }

    return { success: true };
  }
}

export default new PluginService();
