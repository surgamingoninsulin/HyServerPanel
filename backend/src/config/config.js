const config = {
  server: {
    // Path to Hytale server directory
    serverPath: process.env.SERVER_PATH || '/opt/hytale-server',
    
    // Command to start server
    startCommand: process.env.START_COMMAND || 'java -Xmx2G -Xms1G -jar hytale-server.jar nogui',
    
    // Server JAR file name
    jarFile: process.env.JAR_FILE || 'Server/hytale-server.jar',
    
    // Plugins directory
    pluginsDir: process.env.PLUGINS_DIR || 'plugins',
    
    // Worlds directory
    worldsDir: process.env.WORLDS_DIR || 'worlds',
    
    // Backup directory
    backupDir: process.env.BACKUP_DIR || 'backups',
    
    // Max memory allocation
    maxMemory: process.env.MAX_MEMORY || '16G',
    
    // Min memory allocation
    minMemory: process.env.MIN_MEMORY || '6G'
  },
  
  // File upload settings
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['.jar', '.yml', '.yaml', '.txt', '.json', '.properties']
  },
  
  // Auto-shutdown settings
  autoShutdown: {
    enabled: process.env.AUTO_SHUTDOWN === 'true',
    idleTime: parseInt(process.env.IDLE_TIME) || 300000 // 5 minutes
  },
  
  // Get method for accessing config values
  get(key) {
    const keys = key.split('.');
    let value = this;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    return value;
  }
};

export default config;
