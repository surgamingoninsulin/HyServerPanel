import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

class UserService {
    async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    async getAll() {
        try {
            await this.ensureDataDir();
            const data = await fs.readFile(USERS_FILE, 'utf8');
            if (!data.trim()) return [];
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                try {
                    await this.ensureDataDir();
                    await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
                } catch (e) {
                    console.error('[UserService] Failed to initialize users file:', e.message);
                }
                return [];
            }
            if (error.code === 'EACCES') {
                console.error('[UserService] CRITICAL: Permission denied accessing users.json.');
                return [];
            }
            throw error;
        }
    }

    async saveAll(users) {
        await this.ensureDataDir();
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }

    async needsSetup() {
        const users = await this.getAll();
        return users.length === 0;
    }

    async findById(id) {
        const users = await this.getAll();
        return users.find(u => u.id === id);
    }

    async findByUser(username) {
        const users = await this.getAll();
        return users.find(u => u.user === username);
    }

    async findByEmail(email) {
        const users = await this.getAll();
        return users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    }

    async create(userData) {
        try {
            if (!userData.user || !userData.password) {
                throw new Error('Username and password are required');
            }

            const users = await this.getAll();

            const existingUser = users.find(u => u.user === userData.user);
            if (existingUser) {
                throw new Error('User with this username already exists');
            }

            if (userData.email) {
                const existingEmail = await this.findByEmail(userData.email);
                if (existingEmail) {
                    throw new Error('User with this email already exists');
                }
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(userData.password, salt);

            const newUser = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                user: userData.user,
                email: userData.email || null,
                password: hashedPassword,
                tempPassword: userData.tempPassword || null,
                role: userData.role || (users.length === 0 ? 'admin' : 'collaborator'),
                active: userData.active !== undefined ? userData.active : true,
                mustChangePassword: userData.mustChangePassword !== undefined ? userData.mustChangePassword : true,
                permissions: userData.permissions || {
                    manageServers: false,
                    deleteServer: false,
                    managePlugins: false,
                    manageFiles: false,
                    manageUsers: false,
                    viewConsole: true,
                    sendCommands: false,
                    manageSettings: false
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                loginDate: null,
                lastLogin: null
            };

            users.push(newUser);
            await this.saveAll(users);

            const { password, tempPassword, ...userWithoutPassword } = newUser;
            return userWithoutPassword;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async update(id, updates) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) {
            throw new Error('User not found');
        }

        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
            updates.mustChangePassword = false;
        }

        if (updates.email) {
            const existingEmail = await this.findByEmail(updates.email);
            if (existingEmail && existingEmail.id !== id) {
                throw new Error('User with this email already exists');
            }
        }

        users[index] = {
            ...users[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.saveAll(users);

        const { password, tempPassword, ...userWithoutPassword } = users[index];
        return userWithoutPassword;
    }

    async delete(id) {
        const users = await this.getAll();
        const user = users.find(u => u.id === id);
        
        if (!user) {
            throw new Error('User not found');
        }

        if (user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
            throw new Error('Cannot delete the last admin user');
        }

        const filtered = users.filter(u => u.id !== id);
        await this.saveAll(filtered);
        
        return { success: true };
    }

    async toggleActive(id) {
        const users = await this.getAll();
        const user = users.find(u => u.id === id);
        
        if (!user) {
            throw new Error('User not found');
        }

        if (user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1 && !user.active) {
            throw new Error('Cannot deactivate the last admin');
        }

        user.active = !user.active;
        user.updatedAt = new Date().toISOString();
        
        await this.saveAll(users);

        const { password, tempPassword, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async updateLoginDate(id) {
        const users = await this.getAll();
        const user = users.find(u => u.id === id);
        
        if (user) {
            user.loginDate = new Date().toISOString();
            user.lastLogin = user.loginDate;
            await this.saveAll(users);
        }
    }

    async resetPassword(id, tempPassword) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) {
            throw new Error('User not found');
        }

        const salt = await bcrypt.genSalt(10);
        users[index].password = await bcrypt.hash(tempPassword, salt);
        users[index].tempPassword = tempPassword;
        users[index].mustChangePassword = true;
        users[index].updatedAt = new Date().toISOString();
        
        await this.saveAll(users);

        return { success: true, tempPassword };
    }
}

export default new UserService();
