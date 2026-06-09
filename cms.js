import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'baland_residence_super_secret';

// Ensure uploads and thumbnails directories exist (in the root uploads/ folder)
const uploadDir = path.resolve(__dirname, '../../uploads');
const thumbDir  = path.resolve(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(thumbDir))  fs.mkdirSync(thumbDir,  { recursive: true });

async function optimizeImage(buffer, originalName) {
  const baseName = path.basename(originalName, path.extname(originalName));
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const webpFilename  = `${uniqueId}-${baseName}.webp`;
  const thumbFilename = `${uniqueId}-${baseName}_thumb.webp`;
  const webpPath  = path.join(uploadDir, webpFilename);
  const thumbPath = path.join(thumbDir,  thumbFilename);

  await sharp(buffer)
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(webpPath);

  await sharp(buffer)
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbPath);

  return { webpFilename, thumbFilename, webpPath, thumbPath };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const ADMIN_USER = 'atokhtakhozdheav';
const BOT_TOKEN = '8927051645:AAElAEQMlHVENsNYi0ceOnTf_qXc5f5uPDU';
const PERSONAL_CHAT_ID = '1973751873';

const initAdmin = () => {
  const getPass = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get();
  if (!getPass) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('admin_password', 'Alisher86438(')").run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('admin_require_password_change', 'false')").run();
  }
};
initAdmin();

// Middleware to protect routes (Reads from HttpOnly Cookie)
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.admin_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 failed attempts
  message: { error: 'Too many login attempts. Blocked for 1 hour.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const currentPass = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get().value;
  const requireChange = db.prepare("SELECT value FROM settings WHERE key='admin_require_password_change'").get().value === 'true';

  if (username === ADMIN_USER && password === currentPass) {
    if (requireChange) {
      const tempToken = jwt.sign({ role: 'admin_reset' }, JWT_SECRET, { expiresIn: '15m' });
      return res.json({ requireChange: true, tempToken });
    } else {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      
      // Set HttpOnly, Secure, SameSite=None cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      sendAuditLog(req, "Tizimga kirildi", "Admin Panel", `Login: ${ADMIN_USER}`);
      return res.json({ success: true }); // We no longer return the token in JSON body
    }
  }
  return res.status(401).json({ error: 'Xato login yoki parol' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

router.get('/check-auth', authMiddleware, (req, res) => {
  res.json({ authenticated: true });
});

router.post('/forgot-password', async (req, res) => {
  const newPass = Math.floor(100000 + Math.random() * 900000).toString();
  db.prepare("UPDATE settings SET value=? WHERE key='admin_password'").run(newPass);
  db.prepare("UPDATE settings SET value='true' WHERE key='admin_require_password_change'").run();

  const msg = `⚠️ <b>Diqqat! Admin panelga kirish uchun yangi (vaqtinchalik) parol so'raldi.</b>\n\n👤 <b>Login:</b> <code>${ADMIN_USER}</code>\n🔑 <b>Vaqtinchalik parol:</b> <code>${newPass}</code>\n\nBu parolni kiritganingizdan so'ng, tizim sizdan doimiy yangi parol o'rnatishni so'raydi.`;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: PERSONAL_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });
  } catch(e) { console.error(e); }
  res.json({ success: true });
});

router.post('/reset-password', (req, res) => {
  const { tempToken, newPassword } = req.body;
  if (!tempToken || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
  
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.role !== 'admin_reset') throw new Error('Invalid role');
    
    db.prepare("UPDATE settings SET value=? WHERE key='admin_password'").run(newPassword);
    db.prepare("UPDATE settings SET value='false' WHERE key='admin_require_password_change'").run();
    
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('admin_token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Yaroqsiz token yoki vaqt tugagan' });
  }
});

async function sendAuditLog(req, action, section, details = '') {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Noma'lum";
    const userAgent = req.headers['user-agent'] || "Noma'lum";
    const d = new Date();
    const dateStr = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU');
    
    const msg = `⚠️ <b>Saytda o'zgarish qilindi!</b>\n\n` +
      `📂 <b>Bo'lim:</b> ${section}\n` +
      `🛠 <b>Harakat:</b> ${action}\n` +
      (details ? `📄 <b>Tafsilot:</b> ${details}\n` : '') +
      `💻 <b>Qurilma IP:</b> ${ip}\n` +
      `🌐 <b>Brauzer:</b> ${userAgent}\n` +
      `🕒 <b>Vaqt:</b> ${dateStr}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: PERSONAL_CHAT_ID, text: msg, parse_mode: 'HTML' })
    });
  } catch (err) { console.error('Audit log failed:', err); }
};

router.get('/settings', (req, res) => {
  const stmt = db.prepare('SELECT * FROM settings');
  const rows = stmt.all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.post('/settings', authMiddleware, (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  sendAuditLog(req, "O'zgartirildi/Qo'shildi", "Sozlamalar", `Kalit: ${key}`);
  res.json({ success: true });
});

router.get('/plans', (req, res) => {
  res.json(db.prepare('SELECT * FROM plans ORDER BY sort_order ASC, id ASC').all());
});

function parsePlanFilename(originalname) {
  const name = originalname.replace(/\.[^/.]+$/, '');
  const blockMatch = name.match(/^([A-Za-z][^\s]*\s*-?\s*blok)/i);
  const block = blockMatch ? blockMatch[1].trim() : '';
  const roomsMatch = name.match(/(\d+)\s*-?\s*xonali/i);
  const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null;
  const areaMatch = name.match(/([\d]+\.?[\d]*)\s*m2/i);
  const area = areaMatch ? parseFloat(areaMatch[1]) : null;
  return { block, rooms, area };
}

const planUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else cb(new Error('Faqat JPG, PNG, WEBP formatlar qabul qilinadi'));
  }
});

router.post('/plans/upload', authMiddleware, planUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
  const { block, rooms, area } = parsePlanFilename(req.file.originalname);
  if (!rooms || !area) return res.status(400).json({ error: "Fayl nomidan ma'lumot o'qilmadi." });

  try {
    const { webpFilename, thumbFilename } = await optimizeImage(req.file.buffer, req.file.originalname);
    const imageUrl = '/uploads/' + webpFilename;
    const thumbUrl = '/uploads/thumbnails/' + thumbFilename;
    const info = db.prepare('INSERT INTO plans (rooms, area, floor, block, image) VALUES (?, ?, ?, ?, ?)').run(rooms, area, '2-11', block, imageUrl);
    sendAuditLog(req, "Auto-parse qo'shildi", "Planirovkalar", `${block} | ${rooms} xona | ${area} m²`);
    res.json({ id: info.lastInsertRowid, rooms, area, block, image: imageUrl, thumbnail: thumbUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/plans/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/plans/:id', authMiddleware, (req, res) => {
  const { price } = req.body;
  const result = db.prepare('UPDATE plans SET price = ? WHERE id = ?').run(price, req.params.id);
  res.json({ success: result.changes > 0 });
});

router.get('/hero-images', (req, res) => res.json(db.prepare('SELECT * FROM hero_images ORDER BY sort_order ASC, id ASC').all()));
router.post('/hero-images', authMiddleware, (req, res) => res.json({ id: db.prepare('INSERT INTO hero_images (url) VALUES (?)').run(req.body.url).lastInsertRowid }));
router.delete('/hero-images/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM hero_images WHERE id = ?').run(req.params.id).changes > 0 }));

router.get('/documents', (req, res) => res.json(db.prepare('SELECT * FROM documents ORDER BY sort_order ASC, id ASC').all()));
router.post('/documents', authMiddleware, (req, res) => res.json({ id: db.prepare('INSERT INTO documents (title, date, url) VALUES (?, ?, ?)').run(req.body.title, req.body.date, req.body.url).lastInsertRowid }));
router.delete('/documents/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id).changes > 0 }));

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

  if (isImage) {
    try {
      const { webpFilename, thumbFilename } = await optimizeImage(req.file.buffer, req.file.originalname);
      res.json({ url: `/uploads/${webpFilename}`, thumbnail: `/uploads/thumbnails/${thumbFilename}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else {
    const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    res.json({ url: `/uploads/${filename}` });
  }
});

router.get('/news', (req, res) => res.json(db.prepare('SELECT * FROM news ORDER BY created_at DESC').all()));
router.post('/news', authMiddleware, (req, res) => res.json({ id: db.prepare('INSERT INTO news (image, link, description) VALUES (?, ?, ?)').run(req.body.image, req.body.link, req.body.description).lastInsertRowid }));
router.delete('/news/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id).changes > 0 }));

router.get('/media', authMiddleware, (req, res) => {
  const media = [];
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach(f => {
      if (f.match(/\.(jpg|jpeg|png|gif|webp)$/i)) media.push({ url: `/uploads/${f}`, type: 'uploaded' });
    });
  }
  res.json(media);
});

router.post('/stats', (req, res) => {
  db.prepare('INSERT INTO statistics (event_type, event_source) VALUES (?, ?)').run(req.body.type, req.body.source || null);
  res.json({ success: true });
});
router.get('/stats', authMiddleware, (req, res) => {
  const stats = { visits: 0, calls: 0, submissions: 0, sources: {}, leadsCount: 0 };
  db.prepare('SELECT event_type, event_source, COUNT(*) as count FROM statistics GROUP BY event_type, event_source').all().forEach(row => {
    if (row.event_type === 'visit') stats.visits += row.count;
    else if (row.event_type === 'call') stats.calls += row.count;
    else if (row.event_type === 'submit') {
      stats.submissions += row.count;
      if (row.event_source) stats.sources[row.event_source] = (stats.sources[row.event_source] || 0) + row.count;
    }
  });
  
  try {
    const leadsRow = db.prepare('SELECT COUNT(*) as count FROM leads').get();
    stats.leadsCount = leadsRow ? leadsRow.count : 0;
  } catch (err) {}

  res.json(stats);
});

// --- LEADS ROUTE ---
router.get('/leads', authMiddleware, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/about-images', (req, res) => res.json(db.prepare('SELECT * FROM about_images ORDER BY sort_order ASC, id ASC').all()));
router.post('/about-images', authMiddleware, (req, res) => res.json({ id: db.prepare('INSERT INTO about_images (url) VALUES (?)').run(req.body.url).lastInsertRowid }));
router.put('/about-images/:id/order', authMiddleware, (req, res) => { db.prepare('UPDATE about_images SET sort_order=? WHERE id=?').run(req.body.sort_order, req.params.id); res.json({ success: true }); });
router.delete('/about-images/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM about_images WHERE id=?').run(req.params.id).changes > 0 }));

router.get('/about-texts', (req, res) => res.json(db.prepare('SELECT * FROM about_texts ORDER BY lang ASC, sort_order ASC, id ASC').all()));
router.post('/about-texts', authMiddleware, (req, res) => res.json({ id: db.prepare('INSERT INTO about_texts (lang, content) VALUES (?, ?)').run(req.body.lang, req.body.content).lastInsertRowid }));
router.put('/about-texts/:id', authMiddleware, (req, res) => { db.prepare('UPDATE about_texts SET content=? WHERE id=?').run(req.body.content, req.params.id); res.json({ success: true }); });
router.delete('/about-texts/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM about_texts WHERE id=?').run(req.params.id).changes > 0 }));

// --- EVENTS ROUTES ---
router.get('/events', (req, res) => res.json(db.prepare('SELECT * FROM events ORDER BY priority DESC, id ASC').all()));

router.post('/events', authMiddleware, (req, res) => {
  const { name, image, position, link, animation, priority, start_date, end_date, enabled, show_desktop, show_mobile, size } = req.body;
  const info = db.prepare(`
    INSERT INTO events (name, image, position, link, animation, priority, start_date, end_date, enabled, show_desktop, show_mobile, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, image, position || 'right', link, animation || 'none', priority || 0, start_date, end_date, enabled !== undefined ? enabled : 1, show_desktop !== undefined ? show_desktop : 1, show_mobile !== undefined ? show_mobile : 1, size || 'medium');
  res.json({ id: info.lastInsertRowid });
});

router.put('/events/:id', authMiddleware, (req, res) => {
  const { name, image, position, link, animation, priority, start_date, end_date, enabled, show_desktop, show_mobile, size } = req.body;
  db.prepare(`
    UPDATE events SET name=?, image=?, position=?, link=?, animation=?, priority=?, start_date=?, end_date=?, enabled=?, show_desktop=?, show_mobile=?, size=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, image, position, link, animation, priority, start_date, end_date, enabled, show_desktop, show_mobile, size, req.params.id);
  res.json({ success: true });
});

router.delete('/events/:id', authMiddleware, (req, res) => res.json({ success: db.prepare('DELETE FROM events WHERE id=?').run(req.params.id).changes > 0 }));

export default router;
