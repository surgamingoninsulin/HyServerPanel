import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { X, Folder, ChevronRight, ChevronLeft, Home, HardDrive, Check, AlertCircle, Loader2, Plus } from 'lucide-react';

function FolderBrowser({ isOpen, onClose, onSelect, title = 'Select Folder', showFiles = false }) {
    const [currentPath, setCurrentPath] = useState('');
    const [directories, setDirectories] = useState([]);
    const [files, setFiles] = useState([]);
    const [commonPaths, setCommonPaths] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [validation, setValidation] = useState(null);
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadHomeDirectory();
        }
    }, [isOpen]);

    const loadHomeDirectory = async () => {
        let lastError = null;
        try {
            setLoading(true);
            setError(null);

            let discoveredCommonPaths = [];
            try {
                const commonRes = await api.get('/folders/common-paths');
                discoveredCommonPaths = commonRes.data?.paths || [];
                setCommonPaths(discoveredCommonPaths);
            } catch (commonErr) {
                console.error('Failed to load common paths:', commonErr);
            }

            const candidatePaths = [];

            try {
                const homeRes = await api.get('/folders/home');
                if (homeRes?.data?.path) {
                    candidatePaths.push(homeRes.data.path);
                }
            } catch (homeErr) {
                lastError = homeErr;
            }

            for (const commonPath of discoveredCommonPaths) {
                if (commonPath?.path) {
                    candidatePaths.push(commonPath.path);
                }
            }

            candidatePaths.push(null); // Backend default path fallback

            const attempted = new Set();
            for (const candidatePath of candidatePaths) {
                const key = candidatePath || '__default__';
                if (attempted.has(key)) continue;
                attempted.add(key);

                try {
                    await loadDirectory(candidatePath, { throwOnError: true });
                    return;
                } catch (err) {
                    lastError = err;
                }
            }

            throw lastError || new Error('Failed to load any accessible directory');
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to load home directory');
        } finally {
            setLoading(false);
        }
    };

    const loadDirectory = async (path, options = {}) => {
        const { throwOnError = false } = options;
        try {
            setLoading(true);
            setError(null);
            setValidation(null);
            const params = { showFiles: showFiles.toString() };
            if (path) {
                params.path = path;
            }
            const res = await api.get('/folders/browse', { params });
            setCurrentPath(res.data.currentPath);
            setDirectories(res.data.directories);
            if (showFiles) {
                setFiles(res.data.files);
            }
        } catch (err) {
            if (throwOnError) throw err;
            setError(err.response?.data?.error || 'Failed to browse directory');
        } finally {
            setLoading(false);
        }
    };

    const handleDirectoryClick = (dir) => {
        loadDirectory(dir.path);
    };

    const handleSelectFolder = (dir, e) => {
        if (e) e.stopPropagation();
        onSelect(dir.path, undefined);
        onClose();
    };

    const handleGoUp = () => {
        if (currentPath) {
            const parentPath = currentPath.split(/[/\\]/).slice(0, -1).join('/');
            if (parentPath) {
                loadDirectory(parentPath);
            }
        }
    };

    const handleSelect = async () => {
        if (!currentPath) return;

        // Validate the path for server selection
        try {
            setLoading(true);
            const res = await api.post('/folders/validate-server-path', { path: currentPath });
            setValidation(res.data);
            
            if (res.data.valid) {
                onSelect(currentPath, res.data.hasServerFiles);
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to validate path');
        } finally {
            setLoading(false);
        }
    };

    const handleCommonPathClick = (commonPath) => {
        loadDirectory(commonPath.path);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !currentPath) return;

        setCreatingFolder(true);
        setError(null);

        try {
            const folderPath = `${currentPath}/${newFolderName.trim()}`;
            await api.post('/files/mkdir-absolute', { path: folderPath });
            
            // Refresh directory listing
            await loadDirectory(currentPath);
            
            // Reset input
            setNewFolderName('');
            setShowCreateInput(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create folder');
        } finally {
            setCreatingFolder(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                background: '#0f172a',
                borderRadius: 'var(--radius-md)',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                color: '#f1f5f9'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #334155',
                    color: '#f1f5f9'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f1f5f9' }}>
                        <Folder size={22} color="#3b82f6" />
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#f1f5f9' }}>{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#94a3b8'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Common Paths */}
                {commonPaths.length > 0 && (
                    <div style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid #334155',
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        {commonPaths.map((commonPath) => (
                            <button
                                key={commonPath.path}
                                onClick={() => handleCommonPathClick(commonPath)}
                                type="button"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#f1f5f9',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                <HardDrive size={14} />
                                {commonPath.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Current Path Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: '#1e293b',
                    borderBottom: '1px solid #334155'
                }}>
                    <button
                        type="button"
                        onClick={handleGoUp}
                        disabled={!currentPath || currentPath === '/'}
                        style={{
                            padding: '6px',
                            background: '#334155',
                            border: '1px solid #475569',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: '#f1f5f9'
                        }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#e2e8f0'
                    }}>
                        {currentPath || 'Select a folder...'}
                    </div>

                    {/* Create New Folder UI */}
                    {!showCreateInput ? (
                        <button
                            type="button"
                            onClick={() => setShowCreateInput(true)}
                            title="Create New Folder"
                            style={{
                                padding: '6px',
                                background: '#334155',
                                border: '1px solid #475569',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                color: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Plus size={18} />
                        </button>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateFolder();
                                    } else if (e.key === 'Escape') {
                                        setShowCreateInput(false);
                                        setNewFolderName('');
                                    }
                                }}
                                placeholder="Folder name..."
                                autoFocus
                                style={{
                                    padding: '6px 10px',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#f1f5f9',
                                    fontSize: '14px',
                                    width: '150px',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim() || creatingFolder}
                                style={{
                                    padding: '6px 10px',
                                    background: '#3b82f6',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: !newFolderName.trim() || creatingFolder ? 'not-allowed' : 'pointer',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    opacity: !newFolderName.trim() || creatingFolder ? 0.6 : 1
                                }}
                            >
                                {creatingFolder ? '...' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateInput(false);
                                    setNewFolderName('');
                                }}
                                style={{
                                    padding: '6px 10px',
                                    background: '#334155',
                                    border: '1px solid #475569',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    color: '#f1f5f9',
                                    fontSize: '12px'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '14px'
                    }}>
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Validation Result */}
                {validation && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        background: validation.valid 
                            ? 'rgba(34, 197, 94, 0.1)' 
                            : 'rgba(239, 68, 68, 0.1)',
                        borderBottom: `1px solid ${validation.valid 
                            ? 'rgba(34, 197, 94, 0.3)' 
                            : 'rgba(239, 68, 68, 0.3)'}`,
                        color: validation.valid ? '#22c55e' : '#ef4444',
                        fontSize: '14px'
                    }}>
                        {validation.valid ? <Check size={18} /> : <AlertCircle size={18} />}
                        <span>{validation.message}</span>
                        {validation.hasServerFiles && (
                            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                                (Hytale server detected)
                            </span>
                        )}
                    </div>
                )}

                {/* Directory Listing */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '8px 0'
                }}>
                    {loading ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px',
                            gap: '12px',
                            color: '#94a3b8'
                        }}>
                            <Loader2 size={24} className="spinner" />
                            <span>Loading...</span>
                        </div>
                    ) : directories.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: '#94a3b8'
                        }}>
                            <Folder size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p>No folders found</p>
                        </div>
                    ) : (
                        directories.map((dir) => (
                            <div
                                key={dir.path}
                                onClick={() => handleDirectoryClick(dir)}
                                onDoubleClick={(e) => handleSelectFolder(dir, e)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 20px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    borderBottom: '1px solid #334155',
                                    color: '#f1f5f9'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#1e293b';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <Folder size={20} color="#3b82f6" />
                                <span style={{ flex: 1, fontSize: '14px', color: '#f1f5f9' }}>{dir.name}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleSelectFolder(dir, e)}
                                    title="Select this folder"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '6px 10px',
                                        background: '#3b82f6',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 500
                                    }}
                                >
                                    <Check size={14} />
                                </button>
                                <ChevronRight size={16} color="#94a3b8" />
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    padding: '16px 20px',
                    borderTop: '1px solid #334155'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 'var(--radius-sm)',
                            color: '#f1f5f9',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSelect}
                        disabled={!currentPath || loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            background: '#3b82f6',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            opacity: !currentPath || loading ? 0.6 : 1
                        }}
                    >
                        <Check size={18} />
                        Select This Folder
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FolderBrowser;
