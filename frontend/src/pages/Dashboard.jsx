import { useState } from 'react';
import { useServerStatus } from '../hooks/useServerStatus';
import { useServer } from '../contexts/ServerContext';
import ServerControls from '../components/server/ServerControls';
import ServerInfo from '../components/server/ServerInfo';
import PlayitPanel from '../components/PlayitPanel';
import CreateServerModal from '../components/servers/CreateServerModal';
import { Server, Plus } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
  const { status, stats, config, loading: statusLoading } = useServerStatus();
  const { currentServer, needsServer, loading: serverLoading } = useServer();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (serverLoading || statusLoading) {
    return (
      <div className="dashboard fade-in">
        <div className="dashboard-loading">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (needsServer || !currentServer) {
    return (
      <div className="dashboard-overlay">
        <div className="no-server-overlay">
          <div className="no-server-card">
            <Server className="no-server-icon" />
            <h2 className="no-server-title">No Server Configured</h2>
            <p className="no-server-description">
              You need to create or import a server to get started.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary no-server-button"
            >
              <Plus size={18} />
              Create New Server
            </button>
            <CreateServerModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard fade-in">
      <div className="dashboard-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Server overview and controls</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <ServerControls status={status} />
          <div style={{ marginTop: '24px' }}>
            <PlayitPanel />
          </div>
        </div>

        <div className="dashboard-section">
          <ServerInfo stats={stats} config={config} className="full-height" />
        </div>

        <div className="dashboard-section full-width">
          <div className="card">
            <h3 className="card-title">Quick Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Uptime</span>
                <span className="stat-value">{stats.uptime || '0d 00h 00m 00s'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CPU Usage</span>
                <span className="stat-value">{stats.cpu ?? '0'}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Memory</span>
                <span className="stat-value">{stats.memory || '0'} MB</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TPS</span>
                <span className="stat-value">{stats.tps || '20.0'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
