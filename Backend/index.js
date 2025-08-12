import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';
import { connectToMasterDB, masterDB, reconnectToMasterDB } from './DB/connection.js';
import initApp from './src/modules/app.router.js';

const app = express();

// Middleware
app.use(cors());

// Function to handle database connection with exponential backoff retries
async function connectWithRetry() {
    const maxRetries = 10; // Maximum retry attempts
    const baseDelay = 1000; // Initial delay in milliseconds (1 second)
    const maxDelay = 30000; // Maximum delay in milliseconds (30 seconds)
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries})...`);
            await reconnectToMasterDB(); // Use reconnectToMasterDB to refresh config
            console.log('Database connection successful.');
            return true; // Success, exit retry loop
        } catch (err) {
            retries++;
            console.error(`Connection failed (attempt ${retries}/${maxRetries}):`, err.message);

            if (retries >= maxRetries) {
                console.error('Max retries reached. Unable to connect to database.');
                throw new Error('Database connection failed after max retries');
            }

            // Calculate exponential backoff delay with jitter
            const delay = Math.min(baseDelay * 2 ** retries + Math.random() * 100, maxDelay);
            console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Function to monitor and maintain database connection
async function maintainConnection() {
    while (true) {
        try {
            // Perform a simple query to check connection health
            if (masterDB && masterDB.connected) {
                await masterDB.request().query('SELECT 1');
                // Connection is healthy, wait before next check
                await new Promise(resolve => setTimeout(resolve, 60000)); // Check every 60 seconds
            } else {
                console.log('Connection lost or not established. Attempting to reconnect...');
                await connectWithRetry();
            }
        } catch (err) {
            console.error('Connection health check failed:', err.message);
            await connectWithRetry();
            // Wait before retrying health check to avoid rapid loops
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
    }
}

// Function to start the server
async function startServer() {
    try {
        console.log(`--- Starting server.js (Process ID: ${process.pid}) ---`);

        // Attempt initial database connection
        await connectWithRetry();

        // Store DB connection in app locals
        app.locals.db = masterDB;

        // Initialize routes
        initApp(app, express);

        // Start server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Start background connection monitoring
        maintainConnection().catch(err => {
            console.error('Connection maintenance failed:', err.message);
            process.exit(1); // Exit if connection maintenance fails repeatedly
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1); // Exit with failure
    }
}

// Start the server
startServer();