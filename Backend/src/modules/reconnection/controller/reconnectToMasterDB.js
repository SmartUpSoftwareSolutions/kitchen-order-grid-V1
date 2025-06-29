import sql from 'mssql';
import { loadConfig } from '../../../../config/loadEnv';

let masterDB;
let currentConfig = loadConfig(); // Load initial config from file

export async function connectToMasterDB(config = currentConfig) {
  try {
    if (masterDB) {
      await masterDB.close();
      console.log('🔌 Closed previous DB connection');
    }

    currentConfig = config;
    masterDB = new sql.ConnectionPool(currentConfig);
    await masterDB.connect();
    console.log('✅ Connected to SQL Server');

    return masterDB;
  } catch (err) {
    console.error('❌ Connection failed:', err);
    throw err;
  }
}

export async function reconnectToMasterDB() {
  const newConfig = loadConfig();
  return await connectToMasterDB(newConfig);
}

export { masterDB, currentConfig };
