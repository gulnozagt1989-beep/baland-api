import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

export const createSession = (req, res) => {
  try {
    const sessionData = req.body;
    const sessionId = 'baland-session-' + uuidv4().substring(0, 8).toUpperCase();
    
    // Set expiration to 1 hour from now
    const expiresAt = Date.now() + 60 * 60 * 1000;
    
    const stmt = db.prepare('INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)');
    stmt.run(sessionId, JSON.stringify(sessionData), expiresAt);
    
    res.status(200).json({ success: true, sessionId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

export const getSession = (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('SELECT data, expires_at FROM sessions WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) {
      return res.status(404).json({ success: false, error: 'Sessiya topilmadi yoki allaqachon foydalanilgan' });
    }
    
    if (Date.now() > row.expires_at) {
      const delStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
      delStmt.run(id);
      return res.status(400).json({ success: false, error: 'Sessiya muddati tugagan' });
    }
    
    // Delete session after use for security (one-time use)
    const delStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    delStmt.run(id);
    
    return res.status(200).json({ success: true, data: JSON.parse(row.data) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
