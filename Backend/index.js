import './config/loadEnv.js';
import express from "express";
import cors from "cors";
import { connectToMasterDB, masterDB } from "./DB/connection.js";
import initApp from './src/modules/app.router.js';
import path from "path";

const app = express();

// Middleware that are NOT body parsers, or are shared (like CORS)
app.use(cors());

// Function to handle database connection with retries
async function connectWithRetry() {
    let retries = 0;
    const maxRetries = 1000; // Maximum number of retry attempts
    const retryDelay = 15000; // 15 seconds in milliseconds

    while (retries < maxRetries) {
        try {
            console.log(`Attempting to connect to database (attempt ${retries + 1}/${maxRetries})...`);
            await connectToMasterDB();
            console.log('Database connection successful.');
            return; // Exit the function if connection is successful
        } catch (err) {
            retries++;
            console.error(`Database connection failed (attempt ${retries}/${maxRetries}):`, err);

            if (retries < maxRetries) {
                console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                // Wait for 15 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                console.error('Max retries reached. Unable to connect to database.');
                throw new Error('Database connection failed after max retries');
            }
        }
    }
}

async function startServer() {
    try {
        // Clear log to confirm this file is running
        console.log(`--- Main server.js starting. Process ID: ${process.pid} ---`);

        // Attempt to connect to the database with retries
        await connectWithRetry();

        // Store the master DB connection in app locals for global access
        app.locals.db = masterDB;

        // Initialize routes and app modules
        initApp(app, express);

        // Start the server only after DB connection is ready
        const PORT = 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1); // Exit the process with failure code
    }
}

startServer();