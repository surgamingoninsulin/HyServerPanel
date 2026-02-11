import userService from '../backend/src/services/userService.js';
import settingsService from '../backend/src/services/settingsService.js';
import authService from '../backend/src/services/authService.js';

async function setupAdmin() {
    try {
        console.log('[Setup] Starting initial setup...');
        
        // Check if setup is needed
        const needsSetup = await userService.needsSetup();
        console.log('[Setup] Needs setup:', needsSetup);
        
        if (!needsSetup) {
            console.log('[Setup] Setup already completed, exiting.');
            return;
        }
        
        // Create admin user
        const userData = {
            user: 'admin',
            password: 'admin123',
            role: 'admin'
        };
        
        console.log('[Setup] Creating admin user...');
        const user = await userService.create(userData);
        console.log('[Setup] Admin user created:', user);
        
        // Create default settings
        const settingsData = {
            os: process.platform,
            serverPath: process.cwd(),
            javaPath: 'java',
            jarFile: 'Server/HytaleServer.jar',
            assetsFile: 'Assets.zip',
            maxMemory: '16G',
            minMemory: '6G',
            port: 5520
        };
        
        console.log('[Setup] Creating default settings...');
        await settingsService.update(settingsData);
        console.log('[Setup] Default settings created');
        
        console.log('[Setup] Setup completed successfully!');
        console.log('[Setup] Use these credentials to login:');
        console.log('[Setup] Username: admin');
        console.log('[Setup] Password: admin123');
        
    } catch (error) {
        console.error('[Setup] Error during setup:', error.message);
        console.error('[Setup] Stack trace:', error.stack);
    }
}

// Run setup
setupAdmin();