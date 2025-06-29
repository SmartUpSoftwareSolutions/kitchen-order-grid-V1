import express from 'express';
import fs from 'fs';
import path from 'path';
import { connectToMasterDB, masterDB } from '../../../DB/connection.js';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../../'); // Adjust if needed
const CONFIG_PATH = path.join(projectRoot, 'config.json');

router.post('/reconnect', async (req, res) => {
  try {
    const { server, database, user, password } = req.body;

    if (!server || !database || !user || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: server, database, user, password',
      });
    }

    const existingRaw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const existingConfig = JSON.parse(existingRaw);

    const newConfig = {
      ...existingConfig,
      server,
      database,
      user,
      password,
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    console.log('📝 Updated config.json with new DB credentials');

    await connectToMasterDB(newConfig);
    req.app.locals.db = masterDB;

    res.json({
      success: true,
      message: '✅ Reconnected to DB and updated config.json',
    });
  } catch (err) {
    console.error('❌ Reconnection failed:', err);
    res.status(500).json({
      success: false,
      message: '❌ Failed to reconnect to database.',
      error: err.message,
    });
  }
});

export default router;
