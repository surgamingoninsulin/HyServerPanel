import multiServerService from './multiServerService.js';
import hytaleConfigService from './hytaleConfigService.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    let currentInstance = null;

    const getCurrentInstance = async () => {
      try {
        return await multiServerService.getCurrentInstance();
      } catch (error) {
        console.error('Failed to get current instance:', error.message);
        return null;
      }
    };

    const sendStatus = async () => {
      try {
        const instance = await getCurrentInstance();
        if (!instance) {
          socket.emit('status', {
            status: 'offline',
            stats: {
              uptime: 0,
              cpu: 0,
              memory: 0,
              tps: 20.0,
              players: { online: 0, max: 20 }
            }
          });
          return;
        }

        const status = instance.getStatus();
        try {
          const config = await hytaleConfigService.get();
          status.config = {
            motd: config.MOTD,
            maxPlayers: config.MaxPlayers,
            worldName: config.Defaults?.World || 'default',
            serverName: config.ServerName,
            version: `v${config.Version}`
          };
          if (status.stats && status.stats.players) {
            status.stats.players.max = config.MaxPlayers;
          }
        } catch (err) {
          // Silently skip config if it fails
        }
        socket.emit('status', status);
      } catch (error) {
        console.error('Error sending status:', error);
      }
    };

    const sendLogs = async () => {
      try {
        const instance = await getCurrentInstance();
        if (instance) {
          socket.emit('consoleHistory', instance.logs);
        } else {
          socket.emit('consoleHistory', []);
        }
      } catch (error) {
        console.error('Error sending logs:', error);
      }
    };

    const statusHandler = (data) => {
      sendStatus();
    };

    const consoleHandler = (data) => {
      socket.emit('console', data);
    };

    const statsHandler = (stats) => {
      socket.emit('stats', stats);
    };

    const authRequestHandler = (data) => {
      socket.emit('authRequest', data);
    };

    const startErrorHandler = (error) => {
      socket.emit('startError', error);
    };

    multiServerService.on('statusChange', statusHandler);
    multiServerService.on('console', consoleHandler);
    multiServerService.on('stats', statsHandler);
    multiServerService.on('authRequest', authRequestHandler);
    multiServerService.on('startError', startErrorHandler);

    sendStatus();
    sendLogs();

    socket.on('command', async (command) => {
      try {
        const instance = await getCurrentInstance();
        if (instance) {
          instance.sendCommand(command);
        } else {
          socket.emit('error', 'No server instance available');
        }
      } catch (error) {
        socket.emit('error', error.message);
      }
    });

    socket.on('getConsoleHistory', async () => {
      await sendLogs();
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      multiServerService.off('statusChange', statusHandler);
      multiServerService.off('console', consoleHandler);
      multiServerService.off('stats', statsHandler);
      multiServerService.off('authRequest', authRequestHandler);
      multiServerService.off('startError', startErrorHandler);
    });
  });
}