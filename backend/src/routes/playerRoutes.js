import express from 'express';
import playerService from '../services/playerService.js';
import { validateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(validateToken);

router.get('/list', async (req, res) => {
    try {
        const { serverId } = req.query;
        const players = await playerService.listPlayers(serverId);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:uuid', async (req, res) => {
    try {
        const { serverId } = req.query;
        const player = await playerService.getPlayer(req.params.uuid, serverId);
        res.json(player);
    } catch (error) {
        res.status(404).json({ error: 'Player not found' });
    }
});

router.put('/:uuid', isAdmin, async (req, res) => {
    try {
        const { serverId } = req.query;
        const { data } = req.body;
        const updated = await playerService.updatePlayer(req.params.uuid, data, serverId);
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:uuid/kick', async (req, res) => {
    try {
        const { serverId } = req.query;
        await playerService.kickPlayer(req.params.uuid, serverId);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
