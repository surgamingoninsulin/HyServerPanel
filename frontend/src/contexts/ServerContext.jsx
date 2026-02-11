import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { setCurrentServerId } from '../services/api';

const ServerContext = createContext();

export function ServerProvider({ children }) {
    const [servers, setServers] = useState([]);
    const [currentServer, setCurrentServer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [needsServer, setNeedsServer] = useState(false);
    const previousServerRef = useRef(null);

    const loadServers = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const serversRes = await api.get('/servers');
            setServers(serversRes.data);
            
            if (serversRes.data.length === 0) {
                setNeedsServer(true);
                setCurrentServer(null);
                setError('No servers configured. Please create a server.');
                return;
            }
            
            try {
                const currentRes = await api.get('/servers/current');
                const current = currentRes.data;
                if (current) {
                    setCurrentServer(current);
                    setCurrentServerId(current.id);
                    setNeedsServer(false);
                } else if (serversRes.data.length > 0) {
                    const first = serversRes.data[0];
                    try {
                        await api.post('/servers/current', { id: first.id });
                    } catch {}
                    setCurrentServer(first);
                    setCurrentServerId(first.id);
                    setNeedsServer(false);
                } else {
                    setNeedsServer(true);
                    setCurrentServer(null);
                }
            } catch (err) {
                if (serversRes.data.length > 0) {
                    const first = serversRes.data[0];
                    setCurrentServer(first);
                    setCurrentServerId(first.id);
                    setNeedsServer(false);
                } else {
                    setNeedsServer(true);
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to load servers');
            console.error('Error loading servers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServers();
    }, []);

    const switchServer = useCallback(async (serverId) => {
        try {
            setLoading(true);
            previousServerRef.current = currentServer;
            const res = await api.post('/servers/current', { id: serverId });
            setCurrentServer(res.data);
            setCurrentServerId(serverId);
            setNeedsServer(false);
            return res.data;
        } catch (err) {
            setError(err.message || 'Failed to switch server');
            setCurrentServer(previousServerRef.current);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [currentServer]);

    const createServer = useCallback(async (serverData, onSuccess) => {
        try {
            setLoading(true);
            const res = await api.post('/servers', serverData);
            setServers(prev => [...prev, res.data]);
            setCurrentServer(res.data);
            setCurrentServerId(res.data.id);
            setNeedsServer(false);
            
            if (onSuccess) {
                onSuccess(res.data);
            }
            
            return res.data;
        } catch (err) {
            setError(err.message || 'Failed to create server');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const importServer = useCallback(async (importData) => {
        try {
            setLoading(true);
            const res = await api.post('/servers/import', importData);
            setServers(prev => [...prev, res.data]);
            
            if (servers.length === 0) {
                setCurrentServer(res.data);
                setCurrentServerId(res.data.id);
                setNeedsServer(false);
            }
            
            return res.data;
        } catch (err) {
            setError(err.message || 'Failed to import server');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [servers.length]);

    const updateServer = useCallback(async (serverId, updates) => {
        try {
            const res = await api.put(`/servers/${serverId}`, updates);
            setServers(prev => prev.map(s => s.id === serverId ? res.data : s));
            
            if (currentServer?.id === serverId) {
                setCurrentServer(res.data);
            }
            
            return res.data;
        } catch (err) {
            setError(err.message || 'Failed to update server');
            throw err;
        }
    }, [currentServer]);

    const deleteServer = useCallback(async (serverId, options = {}) => {
        try {
            const fallbackServerId = options.fallbackServerId
                || (currentServer?.id === serverId ? previousServerRef.current?.id : null);
            const deleteFiles = options.deleteFiles !== false;

            await api.delete(`/servers/${serverId}`, {
                data: {
                    ...options,
                    deleteFiles,
                    fallbackServerId
                }
            });
            await loadServers();
        } catch (err) {
            setError(err.message || 'Failed to delete server');
            throw err;
        }
    }, [currentServer, loadServers]);

    const duplicateServer = useCallback(async (serverId, newName) => {
        try {
            setLoading(true);
            const res = await api.post(`/servers/${serverId}/duplicate`, { name: newName });
            setServers(prev => [...prev, res.data]);
            return res.data;
        } catch (err) {
            setError(err.message || 'Failed to duplicate server');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const getServerPath = useCallback(async (serverId) => {
        try {
            const server = await api.get(`/servers/${serverId}`);
            return server.data.path;
        } catch (err) {
            return null;
        }
    }, []);

    const value = {
        servers,
        currentServer,
        loading,
        error,
        needsServer,
        loadServers,
        switchServer,
        createServer,
        importServer,
        updateServer,
        deleteServer,
        duplicateServer,
        getServerPath
    };

    return (
        <ServerContext.Provider value={value}>
            {children}
        </ServerContext.Provider>
    );
}

export function useServer() {
    const context = useContext(ServerContext);
    if (!context) {
        throw new Error('useServer must be used within a ServerProvider');
    }
    return context;
}
