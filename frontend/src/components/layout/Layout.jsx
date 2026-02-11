import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import ServerAuthDialog from '../ServerAuthDialog';
import { useServerStatus } from '../../hooks/useServerStatus';
import { useServer } from '../../contexts/ServerContext';
import socketService from '../../services/socket';
import './Layout.css';

import { useDialog } from '../../contexts/DialogContext';

function Layout() {
  const { status, stats } = useServerStatus();
  const { currentServer, needsServer } = useServer();
  const [authData, setAuthData] = useState(null);
  const { showAlert } = useDialog();

  useEffect(() => {
    const handleAuthRequest = (data) => {
      console.log('[Layout] Auth request received:', data);
      setAuthData(data);
    };

    const handleStartError = (message) => {
      console.log('[Layout] Server start error:', message);
      showAlert(message, 'Server Error');
    };

    socketService.on('authRequest', handleAuthRequest);
    socketService.on('startError', handleStartError);

    return () => {
      socketService.off('authRequest', handleAuthRequest);
      socketService.off('startError', handleStartError);
    };
  }, [showAlert]);

  const showNoServerOverlay = needsServer || !currentServer;

  return (
    <div className={`layout-root ${showNoServerOverlay ? 'no-server-layout' : ''}`}>
      <div className="layout-body">
        {!showNoServerOverlay && <Sidebar />}
        <div className={`main-content ${showNoServerOverlay ? 'main-content-full' : ''}`}>
          {!showNoServerOverlay && <Header />}
          <main className={`page-content ${showNoServerOverlay ? 'page-content-full' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
      {!showNoServerOverlay && <Footer />}

      {authData && status === 'online' && !stats.authFileExists && (
        <ServerAuthDialog
          authData={authData}
          onClose={() => setAuthData(null)}
        />
      )}
    </div>
  );
}

export default Layout;
