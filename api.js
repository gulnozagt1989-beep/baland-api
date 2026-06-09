import express from 'express';
import { verifyPromo } from '../controllers/promoController.js';
import { createSession, getSession } from '../controllers/sessionController.js';
import { sendTelegram } from '../controllers/telegramController.js';

const router = express.Router();

router.post('/verify-promo', verifyPromo);
router.post('/create-session', createSession);
router.get('/session/:id', getSession);
router.post('/send-telegram', sendTelegram);

export default router;
