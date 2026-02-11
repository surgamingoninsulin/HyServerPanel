import { useState, useEffect } from 'react';
import * as settingsApi from '../../services/settingsApi';
import '../../styles/global.css';

// Build settings object from current server (used for command preview and save)
function serverToPanelSettings(server) {
    if (!server) return null;
    return {
        serverPath: server.path || '',
        javaPath: server.javaPath || 'java',
        jarFile: server.jarFile || 'HytaleServer.jar',
        assetsFile: server.assetsFile || 'Assets.zip',
        aotCacheFile: server.aotCacheFile ?? 'HytaleServer.aot',
        aotEnabled: server.aotEnabled !== false,
        minMemory: server.minMemory || '1G',
        maxMemory: server.maxMemory || '2G',
        port: server.port ?? 5520,
        os: server.os
    };
}

function PanelSettingsForm({ currentServer, updateServer, serverArgumentsForPreview, onServerUpdated }) {
    const [settings, setSettings] = useState(null);
    const [serverArguments, setServerArguments] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [aotEnabled, setAotEnabled] = useState(true);

    // Load from current server when it changes (per-server command config)
    useEffect(() => {
        if (currentServer) {
            const fromServer = serverToPanelSettings(currentServer);
            setSettings(fromServer);
            setAotEnabled(currentServer.aotEnabled !== false);
            setError(null);
        } else {
            // No server selected: load global defaults for reference
            settingsApi.getPanelSettings()
                .then((data) => {
                    setSettings({ ...data, serverPath: '' });
                    setAotEnabled(data.aotCacheFile != null && data.aotCacheFile !== '');
                })
                .catch(() => setSettings(null));
        }
        setLoading(false);
    }, [currentServer?.id]);

    useEffect(() => {
        if (settings) {
            setAotEnabled(settings.aotCacheFile !== null && settings.aotCacheFile !== undefined && settings.aotCacheFile !== '');
        }
    }, [settings?.aotCacheFile]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            if (currentServer) {
                setSettings(serverToPanelSettings(currentServer));
                setAotEnabled(currentServer.aotEnabled !== false);
            } else {
                const data = await settingsApi.getPanelSettings();
                setSettings(data);
                setAotEnabled(data.aotCacheFile != null && data.aotCacheFile !== '');
            }
            try {
                const serverId = currentServer?.id;
                const serverArgs = await settingsApi.getServerArguments(serverId);
                setServerArguments(serverArgs);
            } catch {
                setServerArguments(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to load panel configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDetect = async () => {
        setDetecting(true);
        setError(null);
        setSuccess(null);
        try {
            const info = await settingsApi.detectSystem();
            setSettings(prev => ({
                ...(prev || {}),
                os: info.os,
                javaPath: info.javaPath || (prev && prev.javaPath),
                serverPath: info.detectedPath || (prev && prev.serverPath)
            }));
            setSuccess('System detected! Review the updated fields below.');
        } catch (err) {
            setError('Detection failed: ' + err.message);
        } finally {
            setDetecting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        
        // Handle AOT checkbox - when unchecked, clear the aotCacheFile
        if (name === 'aotEnabled') {
            val = checked;
            setAotEnabled(val);
            setSettings(prev => ({ 
                ...prev, 
                aotCacheFile: val ? (prev.aotCacheFile || 'HytaleServer.aot') : null 
            }));
            return;
        }
        
        setSettings(prev => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (!currentServer || !updateServer) {
            setError('Select a server to save its startup command.');
            return;
        }
        try {
            const aotPart = (settings.aotCacheFile && aotEnabled) ? `-XX:AOTCache=${settings.aotCacheFile} ` : '';
            const javaCmd = (settings.javaPath && settings.javaPath.trim()) ? settings.javaPath.trim() : 'java';
            // Same formula as command preview — saved per-server and used when starting
            const startCommand = `${javaCmd} ${aotPart}-Xms${settings.minMemory} -Xmx${settings.maxMemory} -jar ${settings.jarFile} --assets ${settings.assetsFile}`;

            const normalizedPath = (settings.serverPath || '').trim() || currentServer.path;
            const payload = {
                path: normalizedPath,
                javaPath: settings.javaPath || 'java',
                jarFile: settings.jarFile || 'HytaleServer.jar',
                assetsFile: settings.assetsFile || 'Assets.zip',
                aotCacheFile: aotEnabled ? (settings.aotCacheFile || 'HytaleServer.aot') : null,
                aotEnabled: !!aotEnabled,
                minMemory: settings.minMemory || '1G',
                maxMemory: settings.maxMemory || '2G',
                port: Number.isFinite(Number(settings.port)) ? Number(settings.port) : 5520,
                startCommand
            };

            await updateServer(currentServer.id, payload);
            if (onServerUpdated) onServerUpdated();
            setSettings(prev => ({ ...prev, ...payload, serverPath: payload.path }));
            setSuccess('Startup command saved for this server. Start server to use it.');
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!currentServer && !settings) return (
        <div className="card">
            <h2 className="card-title">Panel Configuration</h2>
            <div className="status-badge status-offline" style={{ display: 'block', marginBottom: '1rem' }}>
                Select a server to configure its startup command. Each server can have a different command (path, JAR, memory, etc.).
            </div>
        </div>
    );
    if (error && !settings) return (
        <div className="card">
            <h2 className="card-title">Panel Configuration</h2>
            <div className="status-badge status-offline" style={{ display: 'block', marginBottom: '1rem' }}>Error: {error}</div>
            <button onClick={loadSettings} className="btn btn-secondary">Retry</button>
        </div>
    );
    if (!settings) return <div>No settings available</div>;

    // Use javaPath for preview if available
    const javaCmdDisplay = (settings.javaPath && settings.javaPath.trim()) ? settings.javaPath.trim() : 'java';
    const aotPartDisplay = (settings.aotCacheFile && aotEnabled) ? `-XX:AOTCache=${settings.aotCacheFile} ` : '';

    // Build server arguments for preview
    const buildServerArgumentsPreview = (serverArgs) => {
        if (!serverArgs) return '';
        
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

        return args.join(' ');
    };

    const serverArgsPreview = buildServerArgumentsPreview(serverArgumentsForPreview ?? serverArguments);

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h2 className="card-title" style={{ margin: 0 }}>Panel Configuration</h2>
                    {currentServer && (
                        <small style={{ color: 'var(--text-secondary)' }}>Startup command for: {currentServer.name}</small>
                    )}
                </div>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAutoDetect}
                    disabled={detecting}
                >
                    {detecting ? 'Detecting...' : 'Auto Detect System'}
                </button>
            </div>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Operating System</label>
                    <input
                        type="text"
                        name="os"
                        value={settings.os}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Auto-detected from the backend environment.</small>
                </div>

                <div className="form-group">
                    <label>Java Executable Path</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            name="javaPath"
                            value={settings.javaPath || ''}
                            onChange={handleChange}
                            className="input-field"
                            placeholder="/usr/bin/java or java"
                        />
                    </div>
                    <small>Absolute path to the Java executable. Required if 'java' is not in PATH (common on systemd services).</small>
                </div>

                <div className="form-group">
                    <label>Server Path</label>
                    <input
                        type="text"
                        name="serverPath"
                        value={settings.serverPath}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="/path/to/server or C:\path\to\server"
                    />
                    <small>Absolute path to the directory containing hytale-server.jar</small>
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label>Min Memory (RAM)</label>
                            <input
                                type="text"
                                name="minMemory"
                                value={settings.minMemory}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="1G"
                            />
                            {/^\d+$/.test(settings.minMemory) && <small style={{ color: 'var(--accent-gold)' }}>Warning: Missing unit (e.g., '1G' or '1024M')</small>}
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Max Memory (RAM)</label>
                            <input
                                type="text"
                                name="maxMemory"
                                value={settings.maxMemory}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="2G"
                            />
                            {/^\d+$/.test(settings.maxMemory) && <small style={{ color: 'var(--accent-gold)' }}>Warning: Missing unit (e.g., '2G' or '2048M')</small>}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>Server Files</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>Server JAR</small>
                            <input
                                type="text"
                                name="jarFile"
                                value={settings.jarFile}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="Server/HytaleServer.jar"
                            />
                        </div>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>Assets File</small>
                            <input
                                type="text"
                                name="assetsFile"
                                value={settings.assetsFile}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="Assets.zip"
                            />
                        </div>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>AOT Cache File</small>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type='checkbox'
                                    name='aotEnabled'
                                    checked={aotEnabled}
                                    onChange={handleChange}
                                    style={{ width: '30px' }}
                                />
                                <input
                                    type='text'
                                    name='aotCacheFile'
                                    value={settings.aotCacheFile || 'HytaleServer.aot'}
                                    onChange={handleChange}
                                    className='input-field'
                                    placeholder='HytaleServer.aot'
                                    disabled={!aotEnabled}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>Command Preview</label>
                    <div style={{
                        padding: '12px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        wordBreak: 'break-all',
                        cursor: 'pointer',
                        position: 'relative'
                    }}
                    onClick={() => {
                        const fullCommand = `${javaCmdDisplay} ${aotPartDisplay}-Xms${settings.minMemory} -Xmx${settings.maxMemory} -jar ${settings.jarFile} --assets ${settings.assetsFile}${serverArgsPreview ? ' ' + serverArgsPreview : ' '}`;
                        // Replace line breaks in server args with spaces for single-line copy
                        const singleLineCommand = fullCommand.replace(/\s+/g, ' ').trim();
                        navigator.clipboard.writeText(singleLineCommand);
                        setSuccess('Command copied to clipboard!');
                        setTimeout(() => setSuccess(null), 2000);
                    }}>
                        <div style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                            {javaCmdDisplay} {aotPartDisplay}-Xms{settings.minMemory} -Xmx{settings.maxMemory} -jar {settings.jarFile} --assets {settings.assetsFile}
                        </div>
                        {serverArgsPreview && (
                            <div style={{ color: '#64b5f6', marginTop: '8px' }}>
                                {serverArgsPreview}
                            </div>
                        )}
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            opacity: '0.6',
                            fontSize: '14px'
                        }}>
                            📋
                        </div>
                    </div>
                    <small>Click the preview box to copy the complete command • Base command (normal) + server arguments (blue).</small>
                </div>

                <div className="form-group">
                    <label>Server Port</label>
                    <input
                        type="number"
                        name="port"
                        value={settings.port}
                        onChange={handleChange}
                        className="input-field"
                        min="1"
                        max="65535"
                    />
                    <small>Saved per server in <code>Servers/&lt;server_name&gt;/.env</code> as <code>PANEL_PORT</code>.</small>
                </div>

                <button type="submit" className="btn btn-primary" disabled={!currentServer}>
                    {currentServer ? 'Save startup command for this server' : 'Select a server to save'}
                </button>
            </form>
        </div>
    );
}

export default PanelSettingsForm;
