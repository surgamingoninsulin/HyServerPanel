import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token and serverId to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add current server ID to header
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.currentServerId) {
          config.headers['X-Server-Id'] = user.currentServerId;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper to get current server ID
export function getCurrentServerId() {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      return user.currentServerId || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Helper to set current server ID
export function setCurrentServerId(serverId) {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      user.currentServerId = serverId;
      localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
      // Ignore
    }
  }
}

// Server API - uses current server from context/storage
export const serverAPI = {
  getStatus: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/server/status', { params: { serverId: id } });
  },
  getConfig: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/server/config', { params: { serverId: id } });
  },
  updateConfig: (config, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.put('/server/config', config, { params: { serverId: id } });
  },
  getPlayers: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/server/players', { params: { serverId: id } });
  },
  addToWhitelist: (player, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/server/players/whitelist', player, { params: { serverId: id } });
  },
  removeFromWhitelist: (name, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.delete(`/server/players/whitelist/${name}`, { params: { serverId: id } });
  },
  addToBlacklist: (player, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/server/players/blacklist', player, { params: { serverId: id } });
  },
  removeFromBlacklist: (name, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.delete(`/server/players/blacklist/${name}`, { params: { serverId: id } });
  },
  addOperator: (player, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/server/players/operators', player, { params: { serverId: id } });
  },
  removeOperator: (name, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.delete(`/server/players/operators/${name}`, { params: { serverId: id } });
  },
  getMods: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/server/mods', { params: { serverId: id } });
  },
  getPlugins: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/server/plugins', { params: { serverId: id } });
  },
  start: () => api.post('/server/start'),
  stop: () => api.post('/server/stop'),
  restart: () => api.post('/server/restart'),
  sendCommand: (command) => api.post('/server/command', { command }),
  getLogs: () => api.get('/server/logs')
};

// File API
export const fileAPI = {
  list: (directory = '', serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/files/list', { params: { directory, serverId: id } });
  },
  read: (path, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/files/read', { params: { path, serverId: id } });
  },
  write: (path, content, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/files/write', { path, content, serverId: id });
  },
  delete: (path, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.delete('/files/delete', { data: { path, serverId: id } });
  },
  createDirectory: (path, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/files/mkdir', { path, serverId: id });
  },
  upload: (path, file, serverId = null) => {
    const id = serverId || getCurrentServerId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    formData.append('serverId', id);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Plugin API
export const pluginAPI = {
  list: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/plugins/list', { params: { serverId: id } });
  },
  upload: (file, serverId = null) => {
    const id = serverId || getCurrentServerId();
    const formData = new FormData();
    formData.append('plugin', file);
    return api.post(`/plugins/upload?serverId=${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  delete: (name, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.delete('/plugins/delete', { data: { name, serverId: id } });
  },
  search: (provider, query) => api.get('/plugins/search', { params: { provider, query } }),
  getDownloadUrl: (provider, modId, fileId) => api.get('/plugins/download-url', { params: { provider, modId, fileId } }),
  installRemote: (url, filename, metadata, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/plugins/install-remote', { url, filename, metadata, serverId: id });
  }
};

// Playit API (fallback is per-server: Servers/<name>/panel/playit.json)
export const playitAPI = {
  getStatus: () => api.get('/playit/status'),
  start: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/playit/start', {}, { params: id ? { serverId: id } : {} });
  },
  stop: () => api.post('/playit/stop'),
  getUrl: () => api.get('/playit/url'),
  getFallback: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/playit/fallback', { params: id ? { serverId: id } : {} });
  },
  setFallback: (domain, port, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.post('/playit/fallback', { domain, port, serverId: id });
  }
};

// Universe API
export const universeAPI = {
  list: () => api.get('/universes')
};

// User API
export const userAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.post(`/users/${id}/toggle-active`),
  resetPassword: (id, tempPassword) => api.post(`/users/${id}/reset-password`, { tempPassword }),
  updatePermissions: (id, permissions) => api.put(`/users/${id}/permissions`, { permissions })
};

// Player API
export const playerAPI = {
  list: (serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get('/players/list', { params: { serverId: id } });
  },
  get: (uuid, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.get(`/players/${uuid}`, { params: { serverId: id } });
  },
  update: (uuid, data, serverId = null) => {
    const id = serverId || getCurrentServerId();
    return api.put(`/players/${uuid}`, { data, serverId: id });
  }
};

// Servers API
export const serversAPI = {
  list: () => api.get('/servers'),
  get: (id) => api.get(`/servers/${id}`),
  getCurrent: () => api.get('/servers/current'),
  setCurrent: (id) => api.post('/servers/current', { id }),
  create: (data) => api.post('/servers', data),
  import: (data) => api.post('/servers/import', data),
  update: (id, data) => api.put(`/servers/${id}`, data),
  delete: (id, options = {}) => api.delete(`/servers/${id}`, { data: options }),
  duplicate: (id, name) => api.post(`/servers/${id}/duplicate`, { name }),
  discover: () => api.post('/servers/discover')
};

export default api;
