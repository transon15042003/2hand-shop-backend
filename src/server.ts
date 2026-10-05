import { createApp } from './app.js';
import { appConfig } from './configs/app.config.js';
import { pool } from './configs/database.js';
import { startHoldExpireScheduler } from './jobs/hold-expire.job.js';
import { Logger } from './utils/logger.util.js';

async function startServer() {
  try {
    // Test PostgreSQL database connection
    await pool.query('SELECT 1');
    Logger.info('Connected successfully to PostgreSQL database!');

    const app = createApp();

    app.listen(appConfig.port, '0.0.0.0', () => {
      Logger.info(`Backend Server is running at http://localhost:${appConfig.port}`);
      Logger.info(`API Endpoints available at http://localhost:${appConfig.port}/api`);
      startHoldExpireScheduler(appConfig.holdExpireIntervalMs);
    });
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
