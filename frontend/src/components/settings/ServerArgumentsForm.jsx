import { useState, useEffect } from 'react';
import { useServer } from '../../contexts/ServerContext';
import * as settingsApi from '../../services/settingsApi';
import { Save, HelpCircle } from 'lucide-react';

function ServerArgumentsForm({ onSaved }) {
    const { currentServer } = useServer();
    const [serverArguments, setServerArguments] = useState({
        // Basic flags
        acceptEarlyPlugins: false,
        allowOp: false,
        backup: false,
        bare: false,
        disableAssetCompare: false,
        disableCpbBuild: false,
        disableFileWatcher: false,
        disableSentry: false,
        eventDebug: false,
        generateSchema: false,
        singleplayer: false,
        validateAssets: false,
        validateWorldGen: false,
        shutdownAfterValidate: false,
        
        // Flags with values
        assets: '',
        authMode: 'authenticated',
        bind: '',
        backupDir: '',
        backupFrequency: 30,
        backupMaxCount: 5,
        bootCommand: '',
        clientPid: '',
        earlyPlugins: '',
        forceNetworkFlush: true,
        identityToken: '',
        log: '',
        migrateWorlds: '',
        mods: '',
        ownerName: '',
        ownerUuid: '',
        prefabCache: '',
        sessionToken: '',
        transport: 'QUIC',
        universe: '',
        worldGen: '',
        validatePrefabs: ''
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        if (currentServer?.id) {
            loadArguments();
        }
    }, [currentServer?.id]);

    const loadArguments = async () => {
        if (!currentServer?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            const data = await settingsApi.getServerArguments(currentServer.id);
            setServerArguments(prev => ({ ...prev, ...data }));
        } catch (err) {
            setError('Failed to load server arguments');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setServerArguments(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentServer?.id) {
            setError('No server selected. Please select a server first.');
            return;
        }

        setError(null);
        setSuccess(null);
        setSaving(true);
        
        try {
            await settingsApi.saveServerArguments(serverArguments, currentServer.id);
            setSuccess(`Server arguments saved for "${currentServer.name}"! Restart server to apply changes.`);
            onSaved?.();
        } catch (err) {
            setError('Failed to save server arguments: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!currentServer) {
        return (
            <div className="card">
                <div className="status-badge status-offline" style={{ display: 'block' }}>
                    No server selected. Please select a server from the dropdown above.
                </div>
            </div>
        );
    }

    if (loading) return <div>Loading server arguments...</div>;

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <h2 className="card-title">
                    Server Startup Arguments
                    {currentServer && (
                        <span style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--text-muted)', 
                            fontWeight: 'normal',
                            marginLeft: '10px'
                        }}>
                            for {currentServer.name}
                        </span>
                    )}
                </h2>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    color: 'var(--text-muted)',
                    fontSize: '14px'
                }}>
                    <HelpCircle size={16} />
                    <span>Configure additional startup flags for the Hytale server</span>
                </div>
            </div>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                {/* Basic Toggle Flags */}
                <div className="settings-section">
                    <h3>Basic Options</h3>
                    <div className="checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.acceptEarlyPlugins}
                                onChange={(e) => handleChange('acceptEarlyPlugins', e.target.checked)}
                            />
                            <span>Accept Early Plugins</span>
                            <small>Load early plugins (unsupported, may cause issues)</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.allowOp}
                                onChange={(e) => handleChange('allowOp', e.target.checked)}
                            />
                            <span>Allow OP</span>
                            <small>Allow operator commands</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.backup}
                                onChange={(e) => handleChange('backup', e.target.checked)}
                            />
                            <span>Enable Backups</span>
                            <small>Enable server backup functionality</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.bare}
                                onChange={(e) => handleChange('bare', e.target.checked)}
                            />
                            <span>Bare Mode</span>
                            <small>Run server without loading worlds or binding ports</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.disableAssetCompare}
                                onChange={(e) => handleChange('disableAssetCompare', e.target.checked)}
                            />
                            <span>Disable Asset Compare</span>
                            <small>Skip asset comparison on startup</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.disableCpbBuild}
                                onChange={(e) => handleChange('disableCpbBuild', e.target.checked)}
                            />
                            <span>Disable CPB Build</span>
                            <small>Disable compact prefab buffer building</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.disableFileWatcher}
                                onChange={(e) => handleChange('disableFileWatcher', e.target.checked)}
                            />
                            <span>Disable File Watcher</span>
                            <small>Disable automatic file watching</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.disableSentry}
                                onChange={(e) => handleChange('disableSentry', e.target.checked)}
                            />
                            <span>Disable Sentry</span>
                            <small>Disable error reporting to Sentry</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.eventDebug}
                                onChange={(e) => handleChange('eventDebug', e.target.checked)}
                            />
                            <span>Event Debug</span>
                            <small>Enable event debugging output</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.generateSchema}
                                onChange={(e) => handleChange('generateSchema', e.target.checked)}
                            />
                            <span>Generate Schema</span>
                            <small>Generate schema and exit</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.singleplayer}
                                onChange={(e) => handleChange('singleplayer', e.target.checked)}
                            />
                            <span>Singleplayer Mode</span>
                            <small>Run in singleplayer mode</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.validateAssets}
                                onChange={(e) => handleChange('validateAssets', e.target.checked)}
                            />
                            <span>Validate Assets</span>
                            <small>Exit with error if assets are invalid</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.validateWorldGen}
                                onChange={(e) => handleChange('validateWorldGen', e.target.checked)}
                            />
                            <span>Validate World Gen</span>
                            <small>Exit with error if world generation is invalid</small>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={serverArguments.shutdownAfterValidate}
                                onChange={(e) => handleChange('shutdownAfterValidate', e.target.checked)}
                            />
                            <span>Shutdown After Validate</span>
                            <small>Auto-shutdown after validation</small>
                        </label>
                    </div>
                </div>

                {/* Configuration Values */}
                <div className="settings-section">
                    <h3>Configuration Values</h3>
                    <div className="form-group">
                        <label>Bind Address</label>
                        <input
                            type="text"
                            value={serverArguments.bind}
                            onChange={(e) => handleChange('bind', e.target.value)}
                            className="input-field"
                            placeholder="0.0.0.0:5520 (default)"
                        />
                    </div>

                    <div className="form-group">
                        <label>Backup Directory</label>
                        <input
                            type="text"
                            value={serverArguments.backupDir}
                            onChange={(e) => handleChange('backupDir', e.target.value)}
                            className="input-field"
                            placeholder="e.g., ./backups or /opt/hytale/backups"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Backup Frequency (minutes)</label>
                            <input
                                type="number"
                                value={serverArguments.backupFrequency}
                                onChange={(e) => handleChange('backupFrequency', parseInt(e.target.value) || 30)}
                                className="input-field"
                                min="1"
                            />
                        </div>

                        <div className="form-group">
                            <label>Max Backup Count</label>
                            <input
                                type="number"
                                value={serverArguments.backupMaxCount}
                                onChange={(e) => handleChange('backupMaxCount', parseInt(e.target.value) || 5)}
                                className="input-field"
                                min="1"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Early Plugins Directory</label>
                        <input
                            type="text"
                            value={serverArguments.earlyPlugins}
                            onChange={(e) => handleChange('earlyPlugins', e.target.value)}
                            className="input-field"
                            placeholder="Path to additional early plugin directory"
                        />
                    </div>

                    <div className="form-group">
                        <label>Force Network Flush</label>
                        <select
                            value={serverArguments.forceNetworkFlush.toString()}
                            onChange={(e) => handleChange('forceNetworkFlush', e.target.value === 'true')}
                            className="input-field"
                        >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Log Level</label>
                        <input
                            type="text"
                            value={serverArguments.log}
                            onChange={(e) => handleChange('log', e.target.value)}
                            className="input-field"
                            placeholder="Logger level (e.g., INFO, DEBUG)"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Owner Name</label>
                            <input
                                type="text"
                                value={serverArguments.ownerName}
                                onChange={(e) => handleChange('ownerName', e.target.value)}
                                className="input-field"
                                placeholder="Server owner name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Owner UUID</label>
                            <input
                                type="text"
                                value={serverArguments.ownerUuid}
                                onChange={(e) => handleChange('ownerUuid', e.target.value)}
                                className="input-field"
                                placeholder="Server owner UUID"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Transport Type</label>
                        <select
                            value={serverArguments.transport}
                            onChange={(e) => handleChange('transport', e.target.value)}
                            className="input-field"
                        >
                            <option value="QUIC">QUIC</option>
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                        </select>
                    </div>

                </div>

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '1rem' }}>
                    {saving ? (
                        <>
                            <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            Save Changes
                        </>
                    )}
                </button>
            </form>

            <style jsx>{`
                .settings-section {
                    margin-bottom: 2rem;
                }

                .settings-section h3 {
                    margin-bottom: 1rem;
                    color: var(--text-primary);
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 0.5rem;
                }

                .checkbox-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                }

                .checkbox-label {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    cursor: pointer;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    transition: all 0.2s ease;
                }

                .checkbox-label:hover {
                    background: var(--bg-tertiary);
                    border-color: var(--accent-color);
                }

                .checkbox-label input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    margin-right: 0.5rem;
                }

                .checkbox-label span {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .checkbox-label small {
                    color: var(--text-muted);
                    font-size: 12px;
                    line-height: 1.3;
                    margin-left: 1.75rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: var(--text-primary);
                    font-weight: 500;
                }

                .input-field {
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                    font-size: 14px;
                    transition: border-color 0.2s ease;
                }

                .input-field:focus {
                    outline: none;
                    border-color: var(--accent-color);
                }

                .spinner {
                    border: 2px solid var(--border-color);
                    border-top: 2px solid var(--accent-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    display: inline-block;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default ServerArgumentsForm;
