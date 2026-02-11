import api from './api';

export const getPanelSettings = async () => {
    const response = await api.get('/settings/panel');
    return response.data;
};

export const detectSystem = async () => {
    const response = await api.get('/settings/detect');
    return response.data;
};

export const savePanelSettings = async (settings) => {
    const response = await api.post('/settings/panel', settings);
    return response.data;
};

// Server settings - now accept serverId to support multiple servers
export const getServerSettings = async (serverId) => {
    const url = serverId ? `/settings/server?serverId=${serverId}` : '/settings/server';
    const response = await api.get(url);
    return response.data;
};

export const saveServerSettings = async (settings, serverId) => {
    const url = serverId ? `/settings/server?serverId=${serverId}` : '/settings/server';
    const response = await api.post(url, settings);
    return response.data;
};

export const getFileSettings = async (filename, serverId) => {
    const url = serverId ? `/settings/files/${filename}?serverId=${serverId}` : `/settings/files/${filename}`;
    const response = await api.get(url);
    return response.data;
};

export const saveFileSettings = async (filename, content, serverId) => {
    const url = serverId ? `/settings/files/${filename}?serverId=${serverId}` : `/settings/files/${filename}`;
    const response = await api.post(url, content);
    return response.data;
};

export const getServerArguments = async (serverId) => {
    const url = serverId ? `/settings/server-arguments?serverId=${serverId}` : '/settings/server-arguments';
    const response = await api.get(url);
    return response.data;
};

export const saveServerArguments = async (serverArguments, serverId) => {
    const url = serverId ? `/settings/server-arguments?serverId=${serverId}` : '/settings/server-arguments';
    const response = await api.post(url, serverArguments);
    return response.data;
};
