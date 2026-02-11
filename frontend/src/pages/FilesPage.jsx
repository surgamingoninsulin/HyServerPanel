import { useState, useEffect, useCallback } from 'react';
import { fileAPI } from '../services/api';
import { useDialog } from '../contexts/DialogContext';
import { useServer } from '../contexts/ServerContext';
import {
    Folder, File as FileIcon, ArrowLeft, RefreshCw,
    Plus, Trash2, Upload, X, Save, FileText
} from 'lucide-react';
import '../styles/global.css';

function FilesPage() {
    const dialog = useDialog();
    const { currentServer } = useServer();
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingFile, setEditingFile] = useState(null); // { name, path }
    const [editorContent, setEditorContent] = useState('');
    const [saving, setSaving] = useState(false);

    const loadFiles = useCallback(async (path) => {
        if (!currentServer?.id) {
            setFiles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fileAPI.list(path, currentServer.id);
            const data = response.data;
            const sorted = data.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });
            setFiles(sorted);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, [currentServer]);

    // Reset to root when server changes
    useEffect(() => {
        if (currentServer?.id) {
            setCurrentPath('');
        }
    }, [currentServer?.id]);

    // Auto-refresh file list when path changes (folder click, back, or server switch)
    useEffect(() => {
        if (!currentServer?.id) return;
        loadFiles(currentPath);
    }, [currentServer?.id, currentPath, loadFiles]);

    const handleNavigate = (folderName) => {
        const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        setCurrentPath(newPath);
    };

    const handleBack = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleCreateFolder = async () => {
        const name = await dialog.showPrompt("Enter folder name:", "New Folder", "Create Folder");
        if (!name) return;
        try {
            const path = currentPath ? `${currentPath}/${name}` : name;
            await fileAPI.createDirectory(path, currentServer.id);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to create folder: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleCreateFile = async () => {
        const name = await dialog.showPrompt("Enter file name (e.g. notes.txt):", "new-file.txt", "Create File");
        if (!name) return;
        try {
            const path = currentPath ? `${currentPath}/${name}` : name;
            await fileAPI.write(path, "", currentServer.id); // Empty file
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to create file: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleDelete = async (file) => {
        const confirmDelete = await dialog.showConfirm(
            `Are you sure you want to delete ${file.name}?`,
            "Delete " + file.name
        );
        if (!confirmDelete) return;

        try {
            const path = currentPath ? `${currentPath}/${file.name}` : file.name;
            await fileAPI.delete(path, currentServer.id);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to delete: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const path = currentPath ? `${currentPath}/${file.name}` : file.name;
            await fileAPI.upload(path, file, currentServer.id);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to upload: " + (err.response?.data?.error || err.message), "Error");
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleOpenEditor = async (file) => {
        try {
            const path = currentPath ? `${currentPath}/${file.name}` : file.name;
            const res = await fileAPI.read(path, currentServer.id);
            setEditingFile({ name: file.name, path });
            setEditorContent(res.data.content);
            setEditorOpen(true);
            loadFiles(currentPath); // Refresh list when file is clicked
        } catch (err) {
            dialog.showAlert("Failed to read file: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleSaveFile = async () => {
        setSaving(true);
        try {
            await fileAPI.write(editingFile.path, editorContent, currentServer.id);
            setEditorOpen(false);
            setEditingFile(null);
            setEditorContent('');
            dialog.showAlert("File saved successfully!", "Success");
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to save file: " + (err.response?.data?.error || err.message), "Error");
        } finally {
            setSaving(false);
        }
    };

    if (!currentServer) {
        return (
            <div className="page fade-in">
                <h1 className="page-title">Server Files</h1>
                <div className="status-badge status-offline">No server selected. Please select a server first.</div>
            </div>
        );
    }

    return (
        <div className="page fade-in">
            <h1 className="page-title">Server Files - {currentServer.name}</h1>

            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={handleBack}
                    disabled={!currentPath}
                    className="btn btn-secondary"
                    style={{ opacity: !currentPath ? 0.5 : 1 }}
                >
                    <ArrowLeft size={18} /> Back
                </button>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {currentPath || currentServer.path}
                </span>
                <button onClick={() => loadFiles(currentPath)} className="btn btn-secondary">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="files-action-buttons">
                    <button onClick={handleCreateFolder} className="btn btn-secondary">
                        <Plus size={18} /> New Folder
                    </button>
                    <button onClick={handleCreateFile} className="btn btn-secondary">
                        <FileText size={18} /> New File
                    </button>
                    <label className="btn btn-secondary files-upload-btn">
                        <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload File'}
                        <input type="file" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                    </label>
                </div>
            </div>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div className="card">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <RefreshCw size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                        <p>Loading files...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Folder size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>This folder is empty</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Name</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file) => (
                                <tr key={file.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {file.isDirectory ? (
                                                <Folder size={20} color="var(--accent-color)" />
                                            ) : (
                                                <FileIcon size={20} color="var(--text-secondary)" />
                                            )}
                                            <span
                                                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleOpenEditor(file)}
                                                style={{ cursor: file.isDirectory ? 'pointer' : 'pointer', fontWeight: file.isDirectory ? 500 : 400 }}
                                            >
                                                {file.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleDelete(file)}
                                            className="btn-icon"
                                            style={{ color: 'var(--danger-color)' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* File Editor Modal */}
            {editorOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1001,
                    padding: '2rem'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{editingFile?.name}</h3>
                            <button onClick={() => setEditorOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ flex: 1, padding: '1rem', overflow: 'auto' }}>
                            <textarea
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '400px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    padding: '1rem',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button onClick={() => setEditorOpen(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleSaveFile} disabled={saving} className="btn btn-primary">
                                {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .files-action-buttons {
                    display: flex;
                    gap: 0.5rem;
                    align-items: stretch;
                }
                .files-upload-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    margin: 0;
                }
            `}</style>
        </div>
    );
}

export default FilesPage;
