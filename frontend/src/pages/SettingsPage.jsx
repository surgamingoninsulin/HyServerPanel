import { useState, useEffect, useCallback } from 'react';
import { useServer } from '../contexts/ServerContext';
import PanelSettingsForm from '../components/settings/PanelSettingsForm';
import ServerSettingsForm from '../components/settings/ServerSettingsForm';
import ServerArgumentsForm from '../components/settings/ServerArgumentsForm';
import LuckPermsSettings from '../components/settings/LuckPermsSettings';
import JsonFileEditor from '../components/settings/JsonFileEditor';
import * as settingsApi from '../services/settingsApi';
import { AlertCircle } from 'lucide-react';

function SettingsPage() {
    const { currentServer, needsServer, updateServer, loadServers } = useServer();
    const [activeTab, setActiveTab] = useState('panel');
    const [activeFile, setActiveFile] = useState('whitelist.json');
    const [serverArgumentsForPreview, setServerArgumentsForPreview] = useState(null);

    const loadServerArgumentsForPreview = useCallback(async () => {
        if (!currentServer?.id) {
            setServerArgumentsForPreview(null);
            return;
        }
        try {
            const args = await settingsApi.getServerArguments(currentServer.id);
            setServerArgumentsForPreview(args);
        } catch {
            setServerArgumentsForPreview(null);
        }
    }, [currentServer?.id]);

    useEffect(() => {
        loadServerArgumentsForPreview();
    }, [loadServerArgumentsForPreview]);

    return (
        <div className="fade-in">
            <h1 className="page-title">Settings</h1>

            <div className="tabs">
                <button
                    className={`tab-btn ${activeTab === 'panel' ? 'active' : ''}`}
                    onClick={() => setActiveTab('panel')}
                >
                    Panel Configuration
                </button>
                <button
                    className={`tab-btn ${activeTab === 'server' ? 'active' : ''}`}
                    onClick={() => setActiveTab('server')}
                >
                    Server Configuration
                </button>
                <button
                    className={`tab-btn ${activeTab === 'arguments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('arguments')}
                >
                    Server Arguments
                </button>
                <button
                    className={`tab-btn ${activeTab === 'luckperms' ? 'active' : ''}`}
                    onClick={() => setActiveTab('luckperms')}
                >
                    LuckPerms
                </button>
                <button
                    className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
                    onClick={() => setActiveTab('files')}
                >
                    Configuration Files
                </button>
            </div>

            <div className="tab-content" style={{ marginTop: '1rem' }}>
                {activeTab === 'panel' && (
                    <PanelSettingsForm
                        currentServer={currentServer}
                        updateServer={updateServer}
                        serverArgumentsForPreview={serverArgumentsForPreview}
                        onServerUpdated={loadServers}
                    />
                )}
                {activeTab === 'server' && (
                    needsServer || !currentServer ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                            <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                            <h2 style={{ marginBottom: '8px' }}>No Server Selected</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Please create or select a server to manage its configuration.
                            </p>
                        </div>
                    ) : (
                        <ServerSettingsForm />
                    )
                )}
                {activeTab === 'arguments' && (
                    needsServer || !currentServer ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                            <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                            <h2 style={{ marginBottom: '8px' }}>No Server Selected</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Please create or select a server to manage server arguments.
                            </p>
                        </div>
                    ) : (
                        <ServerArgumentsForm onSaved={loadServerArgumentsForPreview} />
                    )
                )}
                {activeTab === 'luckperms' && (
                    needsServer || !currentServer ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                            <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                            <h2 style={{ marginBottom: '8px' }}>No Server Selected</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Please create or select a server to use LuckPerms.
                            </p>
                        </div>
                    ) : (
                        <LuckPermsSettings />
                    )
                )}
                {activeTab === 'files' && (
                    needsServer || !currentServer ? (
                        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                            <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                            <h2 style={{ marginBottom: '8px' }}>No Server Selected</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Please create or select a server to edit configuration files.
                            </p>
                        </div>
                    ) : (
                        <div className="fade-in">
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'inline-block', marginRight: '10px' }}>Select File:</label>
                                <select
                                    value={activeFile}
                                    onChange={(e) => setActiveFile(e.target.value)}
                                    className="input-field"
                                    style={{ width: 'auto', display: 'inline-block' }}
                                >
                                    <option value="bans.json">bans.json</option>
                                    <option value="permissions.json">permissions.json</option>
                                    <option value="whitelist.json">whitelist.json</option>
                                </select>
                            </div>
                            <JsonFileEditor filename={activeFile} />
                        </div>
                    )
                )}
            </div>

            <style>{`
                .tabs {
                    display: flex;
                    gap: 1rem;
                    border-bottom: 2px solid var(--border-color);
                    margin-bottom: 1.5rem;
                }
                .tab-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 1rem;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                    transition: all 0.2s;
                }
                .tab-btn:hover {
                    color: var(--text-primary);
                }
                .tab-btn.active {
                    color: var(--accent-color);
                    border-bottom-color: var(--accent-color);
                }
            `}</style>
        </div>
    );
}

export default SettingsPage;
