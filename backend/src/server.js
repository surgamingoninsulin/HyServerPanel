import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/config.js';
import { setupSocketHandlers } from './services/socketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('[Server] Created data directory');
  }
}

// Initialize services and check setup status
async function initializeServers() {
  console.log('[Server] Initializing server discovery...');
  
  // Import services
  const serversService = (await import('./services/serversService.js')).default;
  const userService = (await import('./services/userService.js')).default;
  
  // Check if setup is needed FIRST
  const needsSetup = await userService.needsSetup();
  console.log('[Server] Needs setup:', needsSetup);
  
  if (needsSetup) {
    console.log('[Server] No users found, setup required. Skipping server discovery.');
    return { needsSetup, serversService };
  }
  
  // Load servers - this triggers auto-discovery
  console.log('[Server] Loading servers service...');
  await serversService.load();
  
  const servers = await serversService.list();
  console.log('[Server] Found', servers.length, 'servers');
  
  const currentServer = await serversService.getCurrent();
  if (currentServer) {
    console.log('[Server] Current server:', currentServer.name, 'ID:', currentServer.id);
  }
  
  return { needsSetup: false, serversService };
}

// Start server
async function startServer() {
  await ensureDataDir();
  const initResult = await initializeServers();
  
  // Routes
  app.use('/api/auth', (await import('./routes/authRoutes.js')).default);
  app.use('/api/settings', (await import('./routes/settingsRoutes.js')).default);
  app.use('/api/files', (await import('./routes/fileRoutes.js')).default);
  app.use('/api/servers', (await import('./routes/serversRoutes.js')).default);
  app.use('/api/server', (await import('./routes/serverRoutes.js')).default);
  app.use('/api/installer', (await import('./routes/installerRoutes.js')).default);
  app.use('/api/players', (await import('./routes/playerRoutes.js')).default);
  app.use('/api/plugins', (await import('./routes/pluginRoutes.js')).default);
  app.use('/api/playit', (await import('./routes/playitRoutes.js')).default);
  app.use('/api/universe', (await import('./routes/universeRoutes.js')).default);
  app.use('/api/folders', (await import('./routes/folderRoutes.js')).default);
  app.use('/api/users', (await import('./routes/userRoutes.js')).default);
  
  // Setup status endpoint
  app.get('/api/setup-status', async (req, res) => {
    try {
      const userService = (await import('./services/userService.js')).default;
      const needsSetup = await userService.needsSetup();
      res.json({ needsSetup });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Setup Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
      credentials: true
    }
  });

  // Connect multiServerService to socket handlers
  const multiServerService = (await import('./services/multiServerService.js')).default;
  multiServerService.setSocket(io);
  setupSocketHandlers(io);

  // Start server
  const PORT = 3000;
  httpServer.listen(PORT, () => {
    console.log(`[Server] API server running on port ${PORT}`);
    console.log(`[Server] Frontend URL: ${config.get('frontendUrl') || 'http://localhost:5173'}`);
  });
}

// Start the server
startServer().catch(console.error);