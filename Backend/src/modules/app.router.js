import cookieParser from "cookie-parser";
import glopalErrHandling from "../utils/errorHandling.js";
import { AppError } from "../utils/appError.js";
import queryRouter from "./query/query.router.js";
import healthRouter from "./health/health.router.js";
import audioRouter from './audio/audio.router.js';
import path from "path";
import reconnectRoutes from '../modules/reconnection/reconnect.routes.js'
const initApp = (app, express) => {
  // Built-in Middleware
app.use(express.json());
app.use('/sounds', express.static(path.join(process.cwd(), 'public', 'sounds'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.mp3')) {
            res.setHeader('Content-Type', 'audio/mpeg');
        }
    }
}));
  app.use(cookieParser());

  // Routes
  app.use("/api/query", queryRouter);
  app.use("/api/health", healthRouter);
  app.use('/api/audio', audioRouter);
  app.use('/api/system', reconnectRoutes);

  // app.use("/api/query/master", masterQueryRouter);
  // Catch-all for undefined routes
  app.use((req, res, next) => {
    next(
      new AppError("Not Found", 404, {
        method: req.method,
        url: req.originalUrl,
      })
    );
  });

  // Global Error Handler
  app.use(glopalErrHandling);
};

export default initApp;