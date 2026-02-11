import { useState } from 'react';
import { useServerStatus } from '../../hooks/useServerStatus';
import { useServer } from '../../contexts/ServerContext';
import ServerSelector from '../servers/ServerSelector';
import CreateServerModal from '../servers/CreateServerModal';
import ImportServerModal from '../servers/ImportServerModal';
import './Header.css';

function Header() {
  const { status, players } = useServerStatus();
  const { currentServer, needsServer, servers, switchServer, loading } = useServer();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const getStatusInfo = () => {
    switch (status) {
      case 'online':
        return { text: 'Online', class: 'status-online' };
      case 'offline':
        return { text: 'Offline', class: 'status-offline' };
      case 'starting':
        return { text: 'Starting', class: 'status-starting' };
      default:
        return { text: 'Unknown', class: 'status-offline' };
    }
  };

  const handleServerSelect = async (serverId) => {
    if (serverId === currentServer?.id) return;
    await switchServer(serverId);
  };

  const statusInfo = getStatusInfo();

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="server-info">
              <h2 className="server-name">
                {needsServer || !currentServer ? 'No Server' : currentServer.name}
              </h2>
              <div className="server-stats">
                <span className={`status-badge ${statusInfo.class}`}>
                  <span className="status-dot"></span>
                  {statusInfo.text}
                </span>
                {status === 'online' && (
                  <span className="player-count">
                    {players.online}/{players.max} players
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="header-right">
            <ServerSelector 
              servers={servers}
              currentServer={currentServer}
              onServerSelect={handleServerSelect}
              onCreateClick={() => setShowCreateModal(true)}
              onImportClick={() => setShowImportModal(true)}
              loading={loading}
            />
          </div>
        </div>
      </header>

      {/* Modals */}
      <CreateServerModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      <ImportServerModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </>
  );
}

export default Header;
