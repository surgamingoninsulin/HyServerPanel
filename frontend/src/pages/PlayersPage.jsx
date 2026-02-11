import { useState, useEffect, useCallback } from 'react';
import { useServer } from '../contexts/ServerContext';
import { serverAPI } from '../services/api';
import { useDialog } from '../contexts/DialogContext';
import { Users, Shield, ShieldOff, UserPlus, UserMinus, AlertCircle, RefreshCw, Check, X } from 'lucide-react';

function PlayersPage() {
    const { currentServer, needsServer } = useServer();
    const { showAlert, showConfirm } = useDialog();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [players, setPlayers] = useState({
        whitelist: [],
        blacklist: [],
        operators: []
    });
    const [activeTab, setActiveTab] = useState('whitelist');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        uuid: '',
        reason: ''
    });

    const loadPlayers = useCallback(async () => {
        if (needsServer || !currentServer) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await serverAPI.getPlayers();
            setPlayers(response.data || { whitelist: [], blacklist: [], operators: [] });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load players');
            console.error('Failed to load players:', err);
        } finally {
            setLoading(false);
        }
    }, [currentServer, needsServer]);

    useEffect(() => {
        loadPlayers();
    }, [loadPlayers]);

    const handleAddToWhitelist = async () => {
        if (!addForm.name || !addForm.uuid) {
            showAlert('Name and UUID are required');
            return;
        }

        try {
            setSaving(true);
            await serverAPI.addToWhitelist({ name: addForm.name, uuid: addForm.uuid });
            showAlert('Player added to whitelist successfully!', 'Success');
            setShowAddModal(false);
            setAddForm({ name: '', uuid: '', reason: '' });
            loadPlayers();
        } catch (err) {
            showAlert(err.response?.data?.error || 'Failed to add player');
        } finally {
            setSaving(false);
        }
    };

    const handleAddToBlacklist = async () => {
        if (!addForm.name || !addForm.uuid) {
            showAlert('Name and UUID are required');
            return;
        }

        try {
            setSaving(true);
            await serverAPI.addToBlacklist({ 
                name: addForm.name, 
                uuid: addForm.uuid, 
                reason: addForm.reason || 'No reason provided' 
            });
            showAlert('Player added to blacklist successfully!', 'Success');
            setShowAddModal(false);
            setAddForm({ name: '', uuid: '', reason: '' });
            loadPlayers();
        } catch (err) {
            showAlert(err.response?.data?.error || 'Failed to add player');
        } finally {
            setSaving(false);
        }
    };

    const handleAddOperator = async () => {
        if (!addForm.name || !addForm.uuid) {
            showAlert('Name and UUID are required');
            return;
        }

        try {
            setSaving(true);
            await serverAPI.addOperator({ name: addForm.name, uuid: addForm.uuid });
            showAlert('Player promoted to operator successfully!', 'Success');
            setShowAddModal(false);
            setAddForm({ name: '', uuid: '', reason: '' });
            loadPlayers();
        } catch (err) {
            showAlert(err.response?.data?.error || 'Failed to promote player');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (name, listType) => {
        const confirmed = await showConfirm(
            `Are you sure you want to remove ${name} from the ${listType}?`,
            'Confirm Removal'
        );
        if (!confirmed) return;

        try {
            if (listType === 'whitelist') {
                await serverAPI.removeFromWhitelist(name);
            } else if (listType === 'blacklist') {
                await serverAPI.removeFromBlacklist(name);
            } else if (listType === 'operators') {
                await serverAPI.removeOperator(name);
            }
            showAlert(`${name} removed successfully!`, 'Success');
            loadPlayers();
        } catch (err) {
            showAlert(err.response?.data?.error || 'Failed to remove player');
        }
    };

    if (needsServer || !currentServer) {
        return (
            <div className="fade-in">
                <h1 className="page-title">Player Management</h1>
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                    <h2 style={{ marginBottom: '8px' }}>No Server Selected</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Please create or select a server to manage players.
                    </p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'whitelist', label: 'Whitelist', count: players.whitelist.length, icon: <Shield size={16} /> },
        { id: 'blacklist', label: 'Blacklist', count: players.blacklist.length, icon: <ShieldOff size={16} /> },
        { id: 'operators', label: 'Operators', count: players.operators.length, icon: <Users size={16} /> }
    ];

    const currentList = players[activeTab] || [];

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 className="page-title">Player Management</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <UserPlus size={16} />
                    Add Player
                </button>
            </div>

            {error && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ef4444',
                    marginBottom: '20px'
                }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <span style={{ 
                            marginLeft: '8px',
                            padding: '2px 8px',
                            background: activeTab === tab.id ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                            borderRadius: '10px',
                            fontSize: '12px'
                        }}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <RefreshCw size={32} className="animate-spin" style={{ marginBottom: '16px' }} />
                        <p>Loading players...</p>
                    </div>
                ) : currentList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <Users size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>
                            No players in {activeTab}
                        </p>
                    </div>
                ) : (
                    <div className="players-table-container">
                        <table className="players-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>UUID</th>
                                    <th>Added</th>
                                    {activeTab === 'operators' && <th>Level</th>}
                                    {activeTab === 'blacklist' && <th>Reason</th>}
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentList.map((player, idx) => (
                                    <tr key={player.uuid || idx}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Users size={18} color="var(--accent-color)" />
                                                <span style={{ fontWeight: 500 }}>{player.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {player.uuid || 'N/A'}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            {player.addedAt || player.bannedAt || player.addedAt ? new Date(player.addedAt || player.bannedAt || player.addedAt).toLocaleDateString() : 'Unknown'}
                                        </td>
                                        {activeTab === 'operators' && (
                                            <td>
                                                <span style={{ 
                                                    padding: '2px 8px', 
                                                    background: 'rgba(234, 179, 8, 0.1)', 
                                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                                    borderRadius: '4px',
                                                    color: '#facc15',
                                                    fontSize: '12px'
                                                }}>
                                                    Level {player.level || 4}
                                                </span>
                                            </td>
                                        )}
                                        {activeTab === 'blacklist' && (
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {player.reason || 'No reason'}
                                            </td>
                                        )}
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleRemove(player.name, activeTab)}
                                                className="action-btn btn-delete"
                                                title="Remove"
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Player Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">
                            Add to {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                        </h2>

                        <div className="form-group">
                            <label>Player Name *</label>
                            <input
                                type="text"
                                value={addForm.name}
                                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                placeholder="PlayerName"
                                className="input-field"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Player UUID *</label>
                            <input
                                type="text"
                                value={addForm.uuid}
                                onChange={(e) => setAddForm({ ...addForm, uuid: e.target.value })}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                className="input-field"
                                required
                            />
                        </div>

                        {activeTab === 'blacklist' && (
                            <div className="form-group">
                                <label>Ban Reason</label>
                                <input
                                    type="text"
                                    value={addForm.reason}
                                    onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                                    placeholder="Reason for ban"
                                    className="input-field"
                                />
                            </div>
                        )}

                        <div className="modal-actions">
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => {
                                    setShowAddModal(false);
                                    setAddForm({ name: '', uuid: '', reason: '' });
                                }}
                            >
                                <X size={18} /> Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (activeTab === 'whitelist') handleAddToWhitelist();
                                    else if (activeTab === 'blacklist') handleAddToBlacklist();
                                    else if (activeTab === 'operators') handleAddOperator();
                                }}
                                disabled={saving}
                                className="btn btn-primary"
                            >
                                {saving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                                {saving ? 'Adding...' : 'Add Player'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    border-bottom: 2px solid var(--border-color);
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .tab-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.9rem;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .tab-btn:hover {
                    color: var(--text-primary);
                }
                .tab-btn.active {
                    color: var(--accent-color);
                    border-bottom-color: var(--accent-color);
                }
                .players-table-container {
                    overflow-x: auto;
                }
                .players-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .players-table th {
                    padding: 12px 16px;
                    text-align: left;
                    background: rgba(0, 0, 0, 0.2);
                    color: var(--text-muted);
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .players-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                }
                .players-table tr:hover {
                    background: rgba(255, 255, 255, 0.02);
                }
                .action-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .action-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                }
                .btn-delete:hover {
                    background: rgba(239, 68, 68, 0.1) !important;
                    color: #ef4444 !important;
                    border-color: rgba(239, 68, 68, 0.3) !important;
                }
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }
                .modal-content {
                    width: 100%;
                    max-width: 450px;
                    animation: modalIn 0.3s ease-out;
                }
                @keyframes modalIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }
                .input-field {
                    width: 100%;
                    padding: 10px 14px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-sm);
                    color: var(--text-primary);
                    font-size: 14px;
                    outline: none;
                }
                .input-field:focus {
                    border-color: var(--accent-green);
                }
                .form-group {
                    margin-bottom: 16px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    color: var(--text-primary);
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
}

export default PlayersPage;
