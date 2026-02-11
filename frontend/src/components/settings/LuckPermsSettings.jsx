import { useState, useEffect, useCallback, useRef } from 'react';
import { useServer } from '../../contexts/ServerContext';
import { useServerStatus } from '../../hooks/useServerStatus';
import { pluginAPI } from '../../services/api';
import socketService from '../../services/socket';
import { useDialog } from '../../contexts/DialogContext';
import {
    Shield, ExternalLink, RefreshCw, Link, CheckCircle, AlertCircle,
    Loader2, Users, Crown, Settings
} from 'lucide-react';

function LuckPermsSettings() {
    const { currentServer } = useServer();
    const { status: serverStatus } = useServerStatus();
    const dialog = useDialog();
    const autoRequestedRef = useRef(false);
    const editorTimeoutRef = useRef(null);

    const [luckPermsInstalled, setLuckPermsInstalled] = useState(false);
    const [loadingPlugins, setLoadingPlugins] = useState(true);
    const [editorUrl, setEditorUrl] = useState(null);
    const [generatingUrl, setGeneratingUrl] = useState(false);

    const isSocketConnected = socketService.socket?.connected;

    const clearEditorTimeout = useCallback(() => {
        if (editorTimeoutRef.current) {
            clearTimeout(editorTimeoutRef.current);
            editorTimeoutRef.current = null;
        }
    }, []);

    const checkLuckPerms = useCallback(async () => {
        if (!currentServer?.id) {
            setLoadingPlugins(false);
            setLuckPermsInstalled(false);
            return;
        }

        setLoadingPlugins(true);
        try {
            const response = await pluginAPI.list(currentServer.id);
            const plugins = response.data || [];

            const luckPermsPatterns = [
                /luckperms/i,
                /lp-editor/i,
                /luckperms-hytale/i
            ];

            const hasLuckPerms = plugins.some(plugin => {
                const name = plugin.name?.toLowerCase() || '';
                const fileName = plugin.fileName?.toLowerCase() || '';
                return luckPermsPatterns.some(pattern =>
                    pattern.test(name) || pattern.test(fileName)
                );
            });

            setLuckPermsInstalled(hasLuckPerms);
        } catch (err) {
            console.error('Failed to check LuckPerms:', err);
            setLuckPermsInstalled(false);
        } finally {
            setLoadingPlugins(false);
        }
    }, [currentServer?.id]);

    const ensureCommandReady = useCallback(() => {
        if (serverStatus !== 'online') {
            dialog.showAlert('Server must be online', 'Error');
            return false;
        }

        if (!isSocketConnected) {
            dialog.showAlert('Socket not connected. Please wait and try again.', 'Error');
            return false;
        }

        return true;
    }, [dialog, isSocketConnected, serverStatus]);

    const sendQuickCommand = useCallback((command, message, title = 'Success') => {
        if (!ensureCommandReady()) return;

        try {
            socketService.sendCommand(command);
            dialog.showAlert(message, title);
        } catch (err) {
            dialog.showAlert(`Failed to send command: ${err.message}`, 'Error');
        }
    }, [dialog, ensureCommandReady]);

    const generateEditorUrl = useCallback(() => {
        if (!currentServer?.id) {
            dialog.showAlert('No server selected', 'Error');
            return;
        }

        if (!ensureCommandReady()) return;

        clearEditorTimeout();
        setGeneratingUrl(true);
        setEditorUrl(null);

        try {
            socketService.sendCommand('lp editor');
            dialog.showAlert('Editor command sent! Waiting for URL...', 'Info');

            editorTimeoutRef.current = setTimeout(() => {
                editorTimeoutRef.current = null;
                setGeneratingUrl(false);
                dialog.showAlert('Timeout waiting for editor URL. Make sure LuckPerms is properly loaded.', 'Error');
            }, 30000);
        } catch (err) {
            setGeneratingUrl(false);
            clearEditorTimeout();
            dialog.showAlert(`Failed to generate editor URL: ${err.message}`, 'Error');
        }
    }, [clearEditorTimeout, currentServer?.id, dialog, ensureCommandReady]);

    useEffect(() => {
        checkLuckPerms();
    }, [checkLuckPerms]);

    useEffect(() => () => {
        clearEditorTimeout();
    }, [clearEditorTimeout]);

    useEffect(() => {
        setEditorUrl(null);
        setGeneratingUrl(false);
        clearEditorTimeout();
        autoRequestedRef.current = false;
    }, [currentServer?.id, clearEditorTimeout]);

    useEffect(() => {
        if (!currentServer?.id) return undefined;

        const handleConsole = (data) => {
            let line = '';

            if (typeof data === 'string') {
                line = data;
            } else if (data && typeof data === 'object') {
                if (data.serverId && data.serverId !== currentServer.id) {
                    return;
                }
                line = data.line || '';
            } else {
                return;
            }

            const urlPatterns = [
                /https:\/\/luckperms\.net\/editor\/[^\s\n]+/i,
                /https:\/\/luckperms\.net\/view\/[^\s\n]+/i,
                /https:\/\/lp\.net\/editor\/[^\s\n]+/i
            ];

            for (const pattern of urlPatterns) {
                const urlMatch = line.match(pattern);
                if (!urlMatch) continue;

                clearEditorTimeout();
                setEditorUrl(urlMatch[0]);
                setGeneratingUrl(false);
                return;
            }
        };

        socketService.on('console', handleConsole);

        return () => {
            socketService.off('console', handleConsole);
        };
    }, [clearEditorTimeout, currentServer?.id]);

    useEffect(() => {
        if (!currentServer?.id || !luckPermsInstalled || serverStatus !== 'online') return undefined;
        if (!isSocketConnected || autoRequestedRef.current) return undefined;

        const timer = setTimeout(() => {
            autoRequestedRef.current = true;
            try {
                socketService.sendCommand('lp editor');
            } catch (err) {
                console.error('Failed to auto-request LuckPerms editor URL:', err);
            }
        }, 4000);

        return () => clearTimeout(timer);
    }, [currentServer?.id, isSocketConnected, luckPermsInstalled, serverStatus]);

    useEffect(() => {
        if (serverStatus !== 'online') {
            autoRequestedRef.current = false;
        }
    }, [serverStatus]);

    if (!currentServer) {
        return (
            <div className="card">
                <div className="status-badge status-offline" style={{ display: 'block' }}>
                    No server selected. Please select a server first.
                </div>
            </div>
        );
    }

    if (loadingPlugins) {
        return (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Checking for LuckPerms...</p>
            </div>
        );
    }

    if (!luckPermsInstalled) {
        return (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <Shield size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>LuckPerms Not Detected</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Install LuckPerms plugin to manage permissions through the web editor.
                </p>
                <a
                    href="https://luckperms.net/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                    <ExternalLink size={18} />
                    Download LuckPerms
                </a>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Shield size={24} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>LuckPerms</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                            Permission management for Hytale
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSocketConnected ? (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '20px',
                                fontSize: '13px',
                                color: '#22c55e'
                            }}>
                                <CheckCircle size={14} />
                                Connected
                            </span>
                        ) : (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '20px',
                                fontSize: '13px',
                                color: '#ef4444'
                            }}>
                                <AlertCircle size={14} />
                                Disconnected
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link size={18} color="var(--accent-color)" />
                    Web Editor
                </h4>

                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                    Open the LuckPerms web editor to manage permissions, groups, and users.
                    The editor opens in a new tab where you can make changes and sync them back to the server.
                </p>

                {editorUrl ? (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '8px',
                        padding: '16px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '12px'
                        }}>
                            <CheckCircle size={20} color="#22c55e" />
                            <span style={{ color: '#22c55e', fontWeight: 500 }}>Editor URL Generated!</span>
                        </div>
                        <code style={{
                            display: 'block',
                            background: 'var(--bg-secondary)',
                            padding: '12px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            wordBreak: 'break-all',
                            marginBottom: '12px',
                            fontFamily: 'monospace'
                        }}>
                            {editorUrl}
                        </code>
                        <a
                            href={editorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                            <ExternalLink size={16} />
                            Open Editor
                        </a>
                        <button
                            onClick={() => {
                                clearEditorTimeout();
                                setEditorUrl(null);
                                setGeneratingUrl(false);
                                autoRequestedRef.current = false;
                            }}
                            style={{
                                marginLeft: '8px',
                                padding: '10px 16px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Generate New Link
                        </button>
                    </div>
                ) : (
                    <div>
                        {serverStatus !== 'online' ? (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <AlertCircle size={20} color="#ef4444" />
                                <div>
                                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Server must be online</span>
                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        Start the server to generate the editor URL.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={generateEditorUrl}
                                disabled={generatingUrl}
                                className="btn btn-primary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: generatingUrl ? 0.6 : 1
                                }}
                            >
                                {generatingUrl ? (
                                    <><Loader2 size={18} className="animate-spin" /> Generating URL...</>
                                ) : (
                                    <><Link size={18} /> Generate Editor URL</>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {editorUrl && (
                <div className="card" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
                    <h4 style={{
                        margin: 0,
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-tertiary)'
                    }}>
                        <Shield size={18} color="var(--accent-green)" />
                        Web Permissions Editor
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            (token from console - new link each server start)
                        </span>
                    </h4>
                    <div style={{
                        background: 'var(--bg-primary)',
                        minHeight: '560px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0 0 var(--radius-md) var(--radius-md)'
                    }}>
                        <iframe
                            title="LuckPerms Web Editor"
                            src={editorUrl}
                            style={{
                                width: '100%',
                                height: '560px',
                                border: 'none',
                                display: 'block'
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="card">
                <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} color="var(--accent-color)" />
                    Quick Commands
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '12px', textAlign: 'left' }}
                        onClick={() => sendQuickCommand(
                            'lp group default permission set *',
                            'Default group permissions updated',
                            'Success'
                        )}
                    >
                        <Crown size={16} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: '13px' }}>Setup Default Group</div>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Configure default permissions</small>
                    </button>

                    <button
                        className="btn btn-secondary"
                        style={{ padding: '12px', textAlign: 'left' }}
                        onClick={() => sendQuickCommand(
                            'lp sync',
                            'Permission cache synced',
                            'Success'
                        )}
                    >
                        <RefreshCw size={16} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: '13px' }}>Sync Permissions</div>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Refresh permission cache</small>
                    </button>

                    <button
                        className="btn btn-secondary"
                        style={{ padding: '12px', textAlign: 'left' }}
                        onClick={() => sendQuickCommand(
                            'lp info',
                            'LuckPerms info sent to console',
                            'Info'
                        )}
                    >
                        <Users size={16} style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: '13px' }}>View Info</div>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Check LuckPerms status</small>
                    </button>
                </div>
            </div>

            <style>{`
                .card {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 1.5rem;
                }

                .btn {
                    padding: 10px 20px;
                    border-radius: var(--radius-sm);
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn-primary {
                    background: var(--accent-color);
                    color: white;
                }

                .btn-secondary {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 500;
                }

                .status-offline {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }
            `}</style>
        </div>
    );
}

export default LuckPermsSettings;
