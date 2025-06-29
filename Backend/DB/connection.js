// import sql from 'mssql';

// let masterDB;
// let currentConfig = {
//   server: 'DESKTOP-PG5CDRB',
//   database: 'Mashwiz',
//   user: 'sa',
//   password: '123@123qw',
//   options: {
//     encrypt: true,
//     trustServerCertificate: true,
//   },
//   requestTimeout: 60000,
// };

// export async function connectToMasterDB(config = currentConfig) {
//   try {
//     // If a pool already exists, close it first
//     if (masterDB) {
//       await masterDB.close();
//       console.log('Closed previous DB connection');
//     }

//     // Save new config to currentConfig
//     currentConfig = config;

//     // Create new pool with updated config
//     masterDB = new sql.ConnectionPool(currentConfig);

//     // Connect
//     await masterDB.connect();
//     console.log('✅ Connected to SQL Server');

//     return masterDB;
//   } catch (err) {
//     console.error('❌ Connection failed:', err);
//     throw err;
//   }
// }

// export { masterDB, currentConfig };
import sql from 'mssql';
import { loadConfig } from '../config/loadEnv.js';

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
