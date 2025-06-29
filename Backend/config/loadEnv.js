// utils/loadConfig.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../../config.json'); // adjust based on folder structure

export function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log(`✅ Loaded DB config from ${CONFIG_PATH}`);
    return parsed;
  } catch (err) {
    console.error('❌ Failed to load config.json:', err);
    throw err;
  }
}
