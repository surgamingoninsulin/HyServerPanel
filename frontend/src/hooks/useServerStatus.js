import { useState, useEffect, useCallback } from 'react';
import { serverAPI } from '../services/api';
import socketService from '../services/socket';
import { useServer } from '../contexts/ServerContext';

export function useServerStatus() {
  const { currentServer, needsServer } = useServer();
  const [status, setStatus] = useState('offline');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    uptime: '0d 00h 00m 00s',
    cpu: 0,
    memory: 0,
    tps: 20.0,
    players: { online: 0, max: 20 },
    version: 'Hytale 1.0.0',
    worldSize: '0 MB',
    playersOnline: 0,
    playersMax: 20
  });

  const fetchStatus = useCallback(async () => {
    if (needsServer || !currentServer) {
      setStatus('offline');
      setLoading(false);
      setError('No server configured');
      return;
    }

    try {
      setLoading(true);
      const response = await serverAPI.getStatus();
      
      if (response.data.code === 'NO_SERVER_CONFIGURED') {
        setStatus('offline');
        setError('No server configured');
      } else {
        setStatus(response.data.status || 'offline');
        if (response.data.config) {
          setConfig(response.data.config);
        }
        if (response.data.stats) {
          setStats(prev => ({ ...prev, ...response.data.stats }));
        }
        setError(null);
      }
    } catch (err) {
      const code = err.response?.data?.code;
      const isNotFound = err.response?.status === 404 || code === 'SERVER_NOT_FOUND' || code === 'NO_SERVER_CONFIGURED';
      if (isNotFound) {
        setStatus('offline');
        setError(err.response?.data?.error || 'No server configured');
      } else {
        setError(err.response?.data?.error || 'Failed to load status');
      }
    } finally {
      setLoading(false);
    }
  }, [currentServer, needsServer]);

  useEffect(() => {
    // Connect socket
    socketService.connect();

    // Get initial status
    fetchStatus();

    // Listen for status updates
    const handleStatus = (data) => {
      if (data.status) {
        setStatus(data.status);
      }
      if (data.config) {
        setConfig(data.config);
      }
    };

    const handleStats = (newStats) => {
      setStats(prev => ({ ...prev, ...newStats }));
    };

    socketService.on('status', handleStatus);
    socketService.on('stats', handleStats);

    // Cleanup
    return () => {
      socketService.off('status', handleStatus);
      socketService.off('stats', handleStats);
    };
  }, [fetchStatus]);

  return {
    status,
    stats,
    config,
    loading,
    error,
    players: stats.players,
    refreshStatus: fetchStatus
  };
}
