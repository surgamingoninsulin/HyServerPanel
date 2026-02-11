import { useState, useEffect } from 'react';
import {
    Server, FolderOpen, ArrowRight, ArrowLeft,
    Download, CheckCircle2, Loader2, Search,
    AlertCircle, Globe, Cpu, Database
} from 'lucide-react';
import api from '../services/api';
import { useServer } from '../contexts/ServerContext';
import FolderBrowser from '../components/common/FolderBrowser';
import './CreateServerPage.css';

function CreateServerPage({ onComplete }) {
    const { createServer } = useServer();
    const [step, setStep] = useState(1);
    const [installMode, setInstallMode] = useState(null);
    const [serverData, setServerData] = useState({
        name: 'My Server',
        serverPath: '',
        javaPath: 'java',
        jarFile: 'Server/HytaleServer.jar',
        assetsFile: 'Assets.zip',
        maxMemory: '2G',
        minMemory: '1G',
        port: 5520,
        patToken: ''
    });
    const [detection, setDetection] = useState({
        loading: false,
        results: null
    });
    const [installStatus, setInstallStatus] = useState({
        state: 'idle',
        progress: 0,
        error: null,
        logs: []
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [prerequisites, setPrerequisites] = useState({
        checking: false,
        available: true,
        error: null
    });
    const [showFolderBrowser, setShowFolderBrowser] = useState(false);
    const [createdServerPath, setCreatedServerPath] = useState(null);

    useEffect(() => {
        let interval;
        const activeStates = ['authenticating', 'downloading_tool', 'extracting_tool', 'downloading_game', 'extracting', 'starting'];

        if (activeStates.includes(installStatus.state)) {
            interval = setInterval(async () => {
                try {
                    const response = await api.get('/installer/status');
                    setInstallStatus(response.data);

                    if (response.data.state === 'finished') {
                        clearInterval(interval);
                    }
                    if (response.data.state === 'tool_installed') {
                        clearInterval(interval);
                        setTimeout(() => {
                            setInstallStatus(prev => ({ ...prev, state: 'idle' }));
                        }, 2000);
                    }
                    if (response.data.state === 'error') {
                        clearInterval(interval);
                        setError(response.data.error);
                    }
                } catch (err) {
                    console.error('Failed to poll installer status');
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [installStatus.state]);

    const handleNext = () => {
        if (step === 1 && !serverData.name.trim()) {
            return setError('Please enter a server name');
        }
        if (step === 1 && !serverData.serverPath.trim()) {
            return setError('Please enter or select a server location');
        }
        if (step === 2 && installMode === 'manual' && !serverData.serverPath) {
            return setError('Please provide a server path');
        }
        setError('');
        setStep(step + 1);
    };

    const handleBack = () => {
        setError('');
        if (step === 3 && installMode === 'manual') {
            setStep(2);
            return;
        }
        setStep(step - 1);
    };

    const detectSystem = async () => {
        setDetection({ ...detection, loading: true });
        try {
            const response = await api.get('/auth/detect-system');
            const { os, detectedPath, defaultPath, javaVersion } = response.data;

            setServerData(prev => ({
                ...prev,
                os,
                serverPath: defaultPath || detectedPath || prev.serverPath,
                javaPath: javaVersion !== 'Not Found' ? 'java' : prev.javaPath
            }));
            setDetection({ loading: false, results: { javaVersion, detectedPath } });
        } catch (err) {
            setDetection({ loading: false, results: { error: 'Failed' } });
        }
    };

    const checkPrerequisites = async () => {
        setPrerequisites({ ...prerequisites, checking: true });
        try {
            const response = await api.get('/installer/prerequisites');
            setPrerequisites({
                checking: false,
                available: response.data.available,
                error: response.data.error
            });
        } catch (err) {
            setPrerequisites({ checking: false, available: false, error: 'Failed to check' });
        }
    };

    useEffect(() => {
        if (step === 2 && installMode === 'auto') {
            checkPrerequisites();
        }
    }, [step, installMode]);

    const startAutoInstall = async () => {
        if (!serverData.name?.trim()) {
            return setError('Please enter a server name');
        }
        if (!prerequisites.available) {
            return setError('Hytale Downloader is missing. Please download it first.');
        }
        setError('');
        setLoading(true);
        try {
            const newServer = await createServer({
                name: serverData.name.trim(),
                path: '',
                javaPath: serverData.javaPath,
                jarFile: serverData.jarFile,
                assetsFile: serverData.assetsFile,
                maxMemory: serverData.maxMemory,
                minMemory: serverData.minMemory,
                port: serverData.port,
                skipFolderBootstrap: true
            });
            setCreatedServerPath(newServer.path);
            await api.post('/installer/start', { targetPath: newServer.path });
            setInstallStatus({ ...installStatus, state: 'starting' });
            setStep(4);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to create server or start installation');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateServer = async () => {
        setError('');
        if (installMode === 'auto') {
            if (onComplete) onComplete();
            else window.location.href = '/';
            return;
        }
        setLoading(true);
        try {
            const pathToUse = serverData.serverPath || '';
            await createServer({
                name: serverData.name,
                path: pathToUse,
                javaPath: serverData.javaPath,
                jarFile: serverData.jarFile,
                assetsFile: serverData.assetsFile,
                maxMemory: serverData.maxMemory,
                minMemory: serverData.minMemory,
                port: serverData.port
            });
            if (onComplete) onComplete();
            else window.location.href = '/';
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create server');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setServerData({ ...serverData, [e.target.name]: e.target.value });
    };

    const steps = [
        { n: 1, label: 'Name' },
        { n: 2, label: 'Method' },
        { n: 3, label: 'Location' },
        { n: 4, label: 'Summary' }
    ];

    return (
        <>
        <div className="login-page">
            <div className="login-overlay"></div>
            <div className="login-container fade-in">
                <div className="login-card">
                    {/* Header - same style as Import Server */}
                    <div className="create-server-header">
                        <div className="create-server-header-left">
                            <Server size={24} color="var(--accent-color)" />
                            <h2>Create Server</h2>
                        </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                    <div className="setup-progress">
                        {steps.map((s, idx) => (
                            <div key={s.n} className="setup-progress-item">
                                <div className={`progress-dot ${step === s.n ? 'active' : (step > s.n ? 'completed' : '')}`}>
                                    {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                                </div>
                                {idx < steps.length - 1 && <div className={`progress-line ${step > s.n ? 'active' : ''}`}></div>}
                            </div>
                        ))}
                    </div>

                    <div className="login-header">
                        {step === 1 && (
                            <>
                                <h1>Server Name</h1>
                                <p>Give your server a unique name</p>
                            </>
                        )}
                        {step === 2 && (
                            <>
                                <h1>Installation Method</h1>
                                <p>How would you like to set up the server?</p>
                            </>
                        )}
                        {step === 3 && (
                            <>
                                <h1>Server Location</h1>
                                <p>{installMode === 'auto' ? `Server folder Servers/${serverData.name || '…'} will be created and game files (HytaleServer.jar, AOT, etc.) will be downloaded and extracted there.` : 'Specify where your server is located'}</p>
                            </>
                        )}
                        {step === 4 && (
                            <>
                                <h1>Ready to Create!</h1>
                                <p>Verify your settings and create the server</p>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="login-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="login-form">
                            <div className="form-group">
                                <label>Server Name</label>
                                <div className="input-with-icon">
                                    <Database className="input-icon" size={18} />
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="My Hytale Server"
                                        value={serverData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <small>The server folder will be created with this name</small>
                            </div>

                            <div className="form-group">
                                <label>Server Location</label>
                                <div className="input-with-action">
                                    <div className="input-with-icon">
                                        <FolderOpen className="input-icon" size={18} />
                                        <input
                                            type="text"
                                            name="serverPath"
                                            placeholder="C:\Hytale\Servers\My Server"
                                            value={serverData.serverPath}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowFolderBrowser(true)}
                                        className="btn-icon-action"
                                        title="Browse for folder"
                                    >
                                        <FolderOpen size={18} />
                                    </button>
                                </div>
                                <small>Full path where the server will be installed or where existing files are</small>
                            </div>

                            <div className="multi-step-buttons">
                                <button onClick={handleNext} className="btn btn-primary">
                                    Next Step <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="install-mode-grid">
                            <button
                                className={`install-mode-card ${installMode === 'auto' ? 'selected' : ''}`}
                                onClick={() => { setInstallMode('auto'); handleNext(); }}
                            >
                                <div className="mode-icon"><Download size={32} /></div>
                                <h3>Automatic Download</h3>
                                <p>We'll download and set up Hytale for you</p>
                            </button>

                            <button
                                className={`install-mode-card ${installMode === 'manual' ? 'selected' : ''}`}
                                onClick={() => { setInstallMode('manual'); handleNext(); }}
                            >
                                <div className="mode-icon"><FolderOpen size={32} /></div>
                                <h3>Manual Mode</h3>
                                <p>Point us to your existing server files</p>
                            </button>

                            <div className="multi-step-buttons" style={{ gridColumn: 'span 2' }}>
                                <button onClick={handleBack} className="btn btn-secondary">
                                    <ArrowLeft size={18} /> Back
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="login-form">
                            {installMode === 'auto' && (
                                <div style={{ marginTop: '1rem' }}>
                                    {prerequisites.checking ? (
                                        <div className="status-pill"><Loader2 className="animate-spin" size={14} /> Checking requirements...</div>
                                    ) : !prerequisites.available ? (
                                        <div className="java-status-card" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
                                            <div className="card-header" style={{ color: '#ef4444' }}>
                                                <AlertCircle size={20} />
                                                <h4>Downloader Tool Missing</h4>
                                            </div>
                                            <div className="card-body">
                                                <button
                                                    onClick={async () => {
                                                        setInstallStatus(prev => ({
                                                            ...prev,
                                                            state: 'downloading_tool',
                                                            progress: 0,
                                                            logs: ['Initiating download...']
                                                        }));
                                                        try {
                                                            await api.post('/installer/download-tool');
                                                        } catch (err) {
                                                            setError('Failed to start download');
                                                            setInstallStatus(prev => ({ ...prev, state: 'error' }));
                                                        }
                                                    }}
                                                    className="btn btn-primary"
                                                    style={{ width: '100%', justifyContent: 'center' }}
                                                >
                                                    <Download size={18} /> Download Tool Automatically
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="detection-tag tag-success">
                                            <CheckCircle2 size={14} /> Installer tool ready
                                        </div>
                                    )}
                                </div>
                            )}

                            {installMode === 'manual' && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label>Existing Server Path</label>
                                        <div className="input-with-action">
                                            <div className="input-with-icon">
                                                <FolderOpen className="input-icon" size={18} />
                                                <input
                                                    type="text"
                                                    name="serverPath"
                                                    placeholder="C:\Hytale\Servers\My Server"
                                                    value={serverData.serverPath}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowFolderBrowser(true)}
                                                className="btn-icon-action"
                                                title="Select Folder"
                                            >
                                                <FolderOpen size={18} />
                                            </button>
                                        </div>
                                        <small>Full path to your existing Hytale server folder</small>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!serverData.serverPath) {
                                                return setError('Please enter or select a server path');
                                            }
                                            try {
                                                const response = await api.post('/servers/validate-import', { 
                                                    path: serverData.serverPath 
                                                });
                                                setDetection(prev => ({
                                                    ...prev,
                                                    loading: false,
                                                    results: { valid: true, message: response.data.message }
                                                }));
                                            } catch (err) {
                                                setDetection(prev => ({
                                                    ...prev,
                                                    loading: false,
                                                    results: { valid: false, message: err.response?.data?.error || 'Invalid path' }
                                                }));
                                            }
                                        }}
                                        className="btn btn-secondary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        <Search size={18} /> Validate Server Path
                                    </button>
                                    {detection.results && (
                                        <div className={`detection-tag ${detection.results.valid ? 'tag-success' : 'tag-error'}`} style={{ marginTop: '10px' }}>
                                            {detection.results.valid ? (
                                                <>
                                                    <CheckCircle2 size={14} /> {detection.results.message}
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle size={14} /> {detection.results.message}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="multi-step-buttons">
                                <button onClick={handleBack} className="btn btn-secondary">
                                    <ArrowLeft size={18} /> Back
                                </button>
                                {installMode === 'auto' ? (
                                <button
                                    onClick={startAutoInstall}
                                    className="btn btn-primary"
                                    disabled={!prerequisites.available || prerequisites.checking || loading}
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                    {loading ? 'Creating server...' : 'Create Server & Download'}
                                </button>
                                ) : (
                                    <button 
                                        onClick={async () => {
                                            if (!serverData.serverPath) {
                                                return setError('Please enter a server path');
                                            }
                                            try {
                                                await api.post('/servers/validate-import', { 
                                                    path: serverData.serverPath 
                                                });
                                                handleNext();
                                            } catch (err) {
                                                setError('Invalid server path. Please check and try again.');
                                            }
                                        }} 
                                        className="btn btn-primary"
                                    >
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="server-summary">
                            <div className="summary-section">
                                <h3>Review Settings</h3>
                                <div className="summary-item">
                                    <div className="summary-label"><Database size={14} /> PAT Token</div>
                                    <div className="summary-value">{serverData.patToken || 'Not Set'}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><FolderOpen size={14} /> Server Path</div>
                                    <div className="summary-value">{installMode === 'auto' ? (createdServerPath || `Servers/${serverData.name}`) : serverData.serverPath}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Cpu size={14} /> Memory</div>
                                    <div className="summary-value">Min: {serverData.minMemory} | Max: {serverData.maxMemory}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Globe size={14} /> Port</div>
                                    <div className="summary-value">{serverData.port}</div>
                                </div>
                            </div>

                            {(installStatus.state !== 'idle' && installStatus.state !== 'finished' && installStatus.state !== 'error') && (
                                <div className="download-step fade-in" style={{ marginTop: '20px' }}>
                                    {installStatus.state === 'authenticating' && (installStatus.verificationUrl || installStatus.deviceCode) && (
                                        <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                            <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Authorize with Hytale:</p>
                                            {installStatus.verificationUrl && (
                                                <a href={installStatus.verificationUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '14px', wordBreak: 'break-all' }}>
                                                    {installStatus.verificationUrl}
                                                </a>
                                            )}
                                            {installStatus.deviceCode && (
                                                <p style={{ margin: '8px 0 0', fontSize: '13px', fontFamily: 'monospace' }}>Code: {installStatus.deviceCode}</p>
                                            )}
                                        </div>
                                    )}
                                    <div className="progress-container">
                                        <div className="progress-label">
                                            <span>{installStatus.state === 'extracting' ? 'Extracting...' : installStatus.state === 'authenticating' ? 'Waiting for auth...' : 'Downloading...'}</span>
                                            <span>{installStatus.progress}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${installStatus.progress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="multi-step-buttons" style={{ marginTop: '30px' }}>
                                <button
                                    onClick={handleBack}
                                    className="btn btn-secondary"
                                    disabled={loading || (installStatus.state !== 'idle' && installStatus.state !== 'error')}
                                >
                                    <ArrowLeft size={18} /> Back
                                </button>
                                <button
                                    onClick={handleCreateServer}
                                    className="btn btn-primary"
                                    disabled={loading || (installMode === 'auto' && installStatus.state !== 'finished')}
                                >
                                    {loading ? 'Creating...' : 'Create Server'}
                                    {!loading && <CheckCircle2 size={18} />}
                                </button>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>

        <FolderBrowser
            isOpen={showFolderBrowser}
            onClose={() => setShowFolderBrowser(false)}
            onSelect={(selectedPath) => {
                setServerData(prev => ({ ...prev, serverPath: selectedPath }));
                setShowFolderBrowser(false);
            }}
            title="Select Server Folder"
        />
        </>
    );
}

export default CreateServerPage;
