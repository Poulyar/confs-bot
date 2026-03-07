import { AppDataSource } from './database/data-source';
import { startBot } from './bot';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
    try {
        // 1. Initialize Database
        logger.info('Initializing Postgres Database...');
        await AppDataSource.initialize();
        logger.info('Database Initialization Complete.');

        // 2. Start Scheduled Jobs
        // logger.info('Starting Cron Jobs...');
        // await startJobs();

        // 3. Launch Bot
        logger.info('Launching Telegraf Bot...');
        startBot();

    } catch (error) {
        logger.error('Error during startup:', error);
        process.exit(1);
    }
}

bootstrap();
