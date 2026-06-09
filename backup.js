import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../sessions.db');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const SETTINGS_FILE = path.join(__dirname, '../.env'); // Backup .env as settings

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_BACKUP_DIR = path.join(BACKUP_DIR, 'database');
const UPLOADS_BACKUP_DIR = path.join(BACKUP_DIR, 'uploads');
const SETTINGS_BACKUP_DIR = path.join(BACKUP_DIR, 'settings');

[DB_BACKUP_DIR, UPLOADS_BACKUP_DIR, SETTINGS_BACKUP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// 1. Backup Database
if (fs.existsSync(DB_PATH)) {
  fs.copyFileSync(DB_PATH, path.join(DB_BACKUP_DIR, `sessions-${timestamp}.db`));
  console.log(`✅ Database backed up for ${timestamp}`);
}

// 2. Backup Settings (.env)
if (fs.existsSync(SETTINGS_FILE)) {
  fs.copyFileSync(SETTINGS_FILE, path.join(SETTINGS_BACKUP_DIR, `env-${timestamp}.txt`));
  console.log(`✅ Settings (.env) backed up for ${timestamp}`);
}

// 3. Backup Uploads (Copy directory recursively)
const currentUploadsBackup = path.join(UPLOADS_BACKUP_DIR, `uploads-${timestamp}`);
if (!fs.existsSync(currentUploadsBackup)) {
  fs.cpSync(UPLOADS_DIR, currentUploadsBackup, { recursive: true });
  console.log(`✅ Uploads backed up for ${timestamp}`);
}

console.log('🎉 All backups completed successfully.');
