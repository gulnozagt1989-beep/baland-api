import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new database file or connect to an existing one
const dbPath = path.resolve(__dirname, 'sessions.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('Connected to SQLite database using better-sqlite3');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS hero_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rooms INTEGER,
    area INTEGER,
    floor TEXT,
    block TEXT,
    image TEXT,
    price INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    date TEXT,
    url TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    link TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS about_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS about_texts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lang TEXT NOT NULL DEFAULT 'uz',
    content TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    image TEXT NOT NULL,
    position TEXT DEFAULT 'right',
    link TEXT,
    animation TEXT DEFAULT 'none',
    priority INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    enabled INTEGER DEFAULT 1,
    show_desktop INTEGER DEFAULT 1,
    show_mobile INTEGER DEFAULT 1,
    size TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    phone TEXT,
    message TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    telegram_sent INTEGER DEFAULT 0
  );
`);

// Insert default admin if not exists (username: admin, password: password123)
// password123 hash generated via bcrypt (assuming we will use plain or bcrypt. Let's use plain for MVP locally, but JWT is better.
// Actually, let's use a very simple crypto hash for MVP to avoid adding bcrypt dependency if we don't have it).
// Wait, the user is running this on their machine. I can just use a hardcoded token or simple hash.
// For now, let's just insert default settings if they are empty.
const stmt = db.prepare('SELECT COUNT(*) AS count FROM settings');
const { count } = stmt.get();
if (count === 0) {
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('phone', '+998 90 123 45 67');
  insertSetting.run('theme', 'default'); // default, winter, new_year
  insertSetting.run('privacy_policy', 'Baland Residence foydalanish shartlari...');
}

const heroCount = db.prepare('SELECT COUNT(*) AS count FROM hero_images').get().count;
if (heroCount === 0) {
  const insertHero = db.prepare('INSERT INTO hero_images (url, sort_order) VALUES (?, ?)');
  insertHero.run('/boshsahifa1.png', 0);
  insertHero.run('/boshsahifa2.png', 1);
  insertHero.run('/boshsahifa3.png', 2);
}

const aboutCount = db.prepare('SELECT COUNT(*) AS count FROM about_images').get().count;
if (aboutCount === 0) {
  const insertAbout = db.prepare('INSERT INTO about_images (url, sort_order) VALUES (?, ?)');
  insertAbout.run('/render1.png', 0);
  insertAbout.run('/render2.png', 1);
  insertAbout.run('/render3.png', 2);
  insertAbout.run('/render4.png', 3);
  insertAbout.run('/render5.png', 4);
}

export default db;
