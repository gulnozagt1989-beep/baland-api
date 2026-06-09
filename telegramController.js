import 'dotenv/config';
import db from '../database.js';

export const sendTelegram = async (req, res) => {
  try {
    const { name, phone, comment, text: clientText, source } = req.body;

    const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '8927051645:AAElAEQMlHVENsNYi0ceOnTf_qXc5f5uPDU';
    const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID || '-1003985041329';
    const PERSONAL_CHAT_ID = '1973751873';

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({ success: false, error: 'Bot token yoki chat ID topilmadi' });
    }

    let text;
    if (clientText) {
      text = clientText;
    } else {
      const vaqt = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
      text = `Ism: ${name}\nTelefon: ${phone}\nIzoh: ${comment || "Yo'q"}\nVaqt: ${vaqt}`;
    }

    // Insert into DB
    let leadId = null;
    try {
      const stmt = db.prepare('INSERT INTO leads (full_name, phone, message, source) VALUES (?, ?, ?, ?)');
      const info = stmt.run(name || 'Noma`lum', phone || 'Noma`lum', clientText || comment || '', source || 'Vebsayt');
      leadId = info.lastInsertRowid;
    } catch (dbErr) {
      console.error('Database insert error:', dbErr);
    }

    const chatIds = [CHAT_ID, PERSONAL_CHAT_ID];
    const payload = req.body.parseMode ? { text, parse_mode: req.body.parseMode } : { text };

    let allSuccess = true;
    for (const id of chatIds) {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: id, ...payload })
      });
      const result = await response.json();
      if (!result.ok) {
        console.error(`Telegram error for chat ${id}:`, result);
        allSuccess = false;
      }
    }

    // Update DB status
    if (allSuccess && leadId) {
      try {
        db.prepare('UPDATE leads SET telegram_sent = 1 WHERE id = ?').run(leadId);
      } catch (dbErr) {}
    }

    if (!allSuccess) {
      return res.status(500).json({ success: false, error: 'Failed to send to one or more chats' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
