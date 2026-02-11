import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import { User, UserPlus, Shield, ShieldAlert, Edit2, Trash2, Power, PowerOff, Check, X, Mail, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import './UsersPage.css';

function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [tempPassword, setTempPassword] = useState('');
    const [formData, setFormData] = useState({
        user: '',
        email: '',
        password: '',
        role: 'collaborator',
        active: true
    });
    const [permissions, setPermissions] = useState({
        manageServers: false,
        deleteServer: false,
        managePlugins: false,
        manageFiles: false,
        manageUsers: false,
        viewConsole: true,
        sendCommands: false,
        manageSettings: false
    });
    const [error, setError] = useState('');
    const { user: currentUser } = useAuth();
    const { showAlert, showConfirm } = useDialog();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await userAPI.list();
            if (Array.isArray(response.data)) {
                setUsers(response.data);
            } else {
                setUsers([]);
                setError('Invalid server response format');
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingUser) {
                await userAPI.update(editingUser.id, formData);
            } else {
                await userAPI.create(formData);
            }
            closeModal();
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving user');
        }
    };

    const handleSavePermissions = async () => {
        try {
            await userAPI.updatePermissions(selectedUser.id, permissions);
            setShowPermissionsModal(false);
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Error saving permissions');
        }
    };

    const handleResetPassword = async () => {
        if (!tempPassword || tempPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        try {
            await userAPI.resetPassword(selectedUser.id, tempPassword);
            await showAlert(`Temporary password for ${selectedUser.user}: ${tempPassword}`, 'Password Reset');
            setShowPasswordModal(false);
            setTempPassword('');
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Error resetting password');
        }
    };

    const handleDelete = async (id) => {
        if (id === currentUser.id) {
            await showAlert('You cannot delete yourself', 'Error');
            return;
        }

        const confirmed = await showConfirm(
            'Are you sure you want to delete this user? This action cannot be undone.',
            'Delete User'
        );

        if (!confirmed) return;

        try {
            await userAPI.delete(id);
            fetchUsers();
        } catch (err) {
            await showAlert('Error deleting user', 'Error');
        }
    };

    const handleToggleActive = async (id) => {
        if (id === currentUser.id) {
            await showAlert('You cannot deactivate yourself', 'Error');
            return;
        }

        try {
            await userAPI.toggleActive(id);
            fetchUsers();
        } catch (err) {
            await showAlert('Error changing status', 'Error');
        }
    };

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                user: user.user,
                email: user.email || '',
                password: '',
                role: user.role,
                active: user.active
            });
        } else {
            setEditingUser(null);
            setFormData({ user: '', email: '', password: '', role: 'collaborator', active: true });
        }
        setShowModal(true);
        setError('');
    };

    const openPermissionsModal = (user) => {
        setSelectedUser(user);
        setPermissions(user.permissions || {
            manageServers: false,
            deleteServer: false,
            managePlugins: false,
            manageFiles: false,
            manageUsers: false,
            viewConsole: true,
            sendCommands: false,
            manageSettings: false
        });
        setShowPermissionsModal(true);
        setError('');
    };

    const openPasswordModal = (user) => {
        setSelectedUser(user);
        setTempPassword(generateTempPassword());
        setShowPasswordModal(true);
        setError('');
    };

    const generateTempPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

    const closeModal = () => {
        setShowModal(false);
        setShowPermissionsModal(false);
        setShowPasswordModal(false);
        setError('');
        setEditingUser(null);
        setSelectedUser(null);
    };

    if (loading) return <div className="page-loading">Loading users...</div>;

    if (currentUser.role !== 'admin') {
        return (
            <div className="users-page fade-in">
                <div className="page-header">
                    <h1 className="page-title">Access Denied</h1>
                </div>
                <div className="card">
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <ShieldAlert size={48} color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
                        <p>You do not have permission to view or manage users.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="users-page fade-in">
            <div className="page-header">
                <h1 className="page-title">Panel User Management</h1>
                <p className="page-subtitle">Manage panel administrators and collaborators</p>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <UserPlus size={18} />
                    Add User
                </button>
            </div>

            <div className="card">
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th>Last Login</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="user-info">
                                            <div className="user-avatar">
                                                <User size={16} />
                                            </div>
                                            <span>{u.user}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {u.email ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                                <Mail size={14} /> {u.email}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>No email</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`role-badge role-${u.role}`}>
                                            {u.role === 'admin' ? <Shield size={14} /> : <ShieldAlert size={14} />}
                                            {u.role === 'admin' ? 'Primary Admin' : 'Collaborator'}
                                        </span>
                                    </td>
                                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td>{u.loginDate ? new Date(u.loginDate).toLocaleString() : 'Never'}</td>
                                    <td>
                                        <span className={`status-badge ${u.active ? 'status-online' : 'status-offline'}`}>
                                            {u.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="actions-cell">
                                        <button className="action-btn" onClick={() => openModal(u)} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="action-btn" onClick={() => openPasswordModal(u)} title="Reset Password">
                                            <Key size={16} />
                                        </button>
                                        <button
                                            className={`action-btn ${u.active ? 'btn-deactivate' : 'btn-activate'}`}
                                            onClick={() => handleToggleActive(u.id)}
                                            title={u.active ? 'Deactivate' : 'Activate'}
                                            disabled={u.id === currentUser.id}
                                        >
                                            {u.active ? <PowerOff size={16} /> : <Power size={16} />}
                                        </button>
                                        <button
                                            className="action-btn btn-delete"
                                            onClick={() => handleDelete(u.id)}
                                            title="Delete"
                                            disabled={u.id === currentUser.id}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">
                            {editingUser ? 'Edit User' : 'New User'}
                        </h2>

                        <form onSubmit={handleSubmit} className="user-form">
                            {error && <div className="login-error"><ShieldAlert size={18} /> {error}</div>}

                            <div className="form-group">
                                <label>Username *</label>
                                <input
                                    type="text"
                                    value={formData.user}
                                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                                    required
                                    disabled={editingUser && editingUser.role === 'admin' && editingUser.id === currentUser.id}
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="user@example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    placeholder="********"
                                />
                            </div>

                            <div className="form-group">
                                <label>User Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    disabled={editingUser && editingUser.id === currentUser.id}
                                >
                                    <option value="collaborator">Collaborator</option>
                                    <option value="admin">Primary Admin</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                    <X size={18} /> Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Check size={18} /> {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPermissionsModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">Permissions for {selectedUser.user}</h2>

                        {error && <div className="login-error"><ShieldAlert size={18} /> {error}</div>}

                        <div className="permissions-grid">
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.manageServers}
                                    onChange={(e) => setPermissions({ ...permissions, manageServers: e.target.checked })}
                                />
                                <span>Manage Servers</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.deleteServer}
                                    onChange={(e) => setPermissions({ ...permissions, deleteServer: e.target.checked })}
                                />
                                <span>Delete Servers</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.managePlugins}
                                    onChange={(e) => setPermissions({ ...permissions, managePlugins: e.target.checked })}
                                />
                                <span>Manage Plugins/Mods</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.manageFiles}
                                    onChange={(e) => setPermissions({ ...permissions, manageFiles: e.target.checked })}
                                />
                                <span>Manage Files</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.manageUsers}
                                    onChange={(e) => setPermissions({ ...permissions, manageUsers: e.target.checked })}
                                />
                                <span>Manage Users</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.viewConsole}
                                    onChange={(e) => setPermissions({ ...permissions, viewConsole: e.target.checked })}
                                />
                                <span>View Console</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.sendCommands}
                                    onChange={(e) => setPermissions({ ...permissions, sendCommands: e.target.checked })}
                                />
                                <span>Send Commands</span>
                            </label>
                            <label className="permission-item">
                                <input
                                    type="checkbox"
                                    checked={permissions.manageSettings}
                                    onChange={(e) => setPermissions({ ...permissions, manageSettings: e.target.checked })}
                                />
                                <span>Manage Settings</span>
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                <X size={18} /> Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleSavePermissions}>
                                <Check size={18} /> Save Permissions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPasswordModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">Reset Password for {selectedUser.user}</h2>

                        {error && <div className="login-error"><ShieldAlert size={18} /> {error}</div>}

                        <div className="form-group">
                            <label>Temporary Password</label>
                            <input
                                type="text"
                                value={tempPassword}
                                onChange={(e) => setTempPassword(e.target.value)}
                                placeholder="Enter or generate password"
                            />
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ marginTop: '8px' }}
                                onClick={() => setTempPassword(generateTempPassword())}
                            >
                                Generate New Password
                            </button>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px' }}>
                            This temporary password will be shown to you after saving. Share it securely with the user.
                        </p>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                <X size={18} /> Cancel
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleResetPassword}>
                                <Check size={18} /> Reset Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UsersPage;
