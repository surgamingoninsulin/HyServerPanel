import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import userService from './userService.js';
import settingsService from './settingsService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hytale-panel-secret-key-2026';

class AuthService {
    async login(username, password) {
        const user = await userService.findByUser(username);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.active) {
            throw new Error('Account is deactivated');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid credentials');
        }

        await userService.updateLoginDate(user.id);

        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.user, 
                role: user.role,
                permissions: user.permissions
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                user: user.user,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                mustChangePassword: user.mustChangePassword
            }
        };
    }

    async setup(data) {
        try {
            const { user: userData, settings: settingsData } = data;

            if (!userData) {
                throw new Error('User data is required');
            }

            if (!userData.user || !userData.password) {
                throw new Error('Username and password are required');
            }

            const needsSetup = await userService.needsSetup();
            if (!needsSetup) {
                throw new Error('Setup already completed');
            }

            if (settingsData) {
                try {
                    await settingsService.update(settingsData);
                } catch (settingsError) {
                    console.error('[AuthService] Failed to save settings during setup:', settingsError);
                }
            }

            const newUser = await userService.create({
                ...userData,
                role: 'admin'
            });

            return newUser;
        } catch (error) {
            console.error('[AuthService] Setup error:', error.message);
            throw error;
        }
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
}

export default new AuthService();
