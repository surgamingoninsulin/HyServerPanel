import express from 'express';
import userService from '../services/userService.js';
import { validateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(validateToken);

router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await userService.getAll();
        if (!Array.isArray(users)) {
            return res.json([]);
        }
        const safeUsers = users.map(({ password, tempPassword, ...rest }) => rest);
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', isAdmin, async (req, res) => {
    try {
        const user = await userService.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { password, tempPassword, ...safeUser } = user;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', isAdmin, async (req, res) => {
    try {
        const user = await userService.create(req.body);
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/:id', isAdmin, async (req, res) => {
    try {
        const user = await userService.update(req.params.id, req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await userService.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:id/toggle-active', isAdmin, async (req, res) => {
    try {
        const user = await userService.toggleActive(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:id/reset-password', isAdmin, async (req, res) => {
    try {
        const { tempPassword } = req.body;
        if (!tempPassword) {
            return res.status(400).json({ error: 'Temporary password is required' });
        }
        const result = await userService.resetPassword(req.params.id, tempPassword);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/:id/permissions', isAdmin, async (req, res) => {
    try {
        const { permissions } = req.body;
        if (!permissions || typeof permissions !== 'object') {
            return res.status(400).json({ error: 'Valid permissions object is required' });
        }
        const user = await userService.update(req.params.id, { permissions });
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
