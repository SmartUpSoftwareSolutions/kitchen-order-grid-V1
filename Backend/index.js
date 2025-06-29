import './config/loadEnv.js';
import express from "express";
import cors from "cors";
import { connectToMasterDB, masterDB } from "./DB/connection.js";
import initApp from './src/modules/app.router.js'; // This is your initApp from the previous discussion
import path from "path";

const app = express();

// Middleware that are NOT body parsers, or are shared (like CORS)
app.use(cors());

async function startServer() {
    try {
        // *** Add a very clear log here to confirm this file is running ***
        console.log(`--- Main server.js starting. Process ID: ${process.pid} ---`);

        await connectToMasterDB();

        // Store the master DB connection in app locals for global access
        app.locals.db = masterDB;
       
        // Initialize routes and app modules.
        // This is where app.use(express.json({ limit: '100mb' })) is called.
        initApp(app, express);

        // Start the server only after DB connection is ready
        const PORT =  3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to start server due to DB connection error:', err);
        process.exit(1); // Exit the process with failure code
    }
}

startServer();