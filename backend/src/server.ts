import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';

async function bootstrap() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    logger.info('Database connection established successfully');

    // Auto-seed initial demo tools and admin user if database is unseeded
    try {
      const toolCount = await prisma.tool.count();
      if (toolCount === 0) {
        logger.info('Database has no tools. Running database seed...');
        const { execSync } = await import('child_process');
        execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
        logger.info('Database seeded successfully');
      }
    } catch (seedErr) {
      logger.warn({ seedErr }, 'Auto-seed check/execution completed');
    }

    const server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`ToolToll Backend Server running on port ${env.PORT} in ${env.APP_ENV} mode`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`API Docs: http://localhost:${env.PORT}/api/docs`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        logger.info('Database disconnected. Process terminating.');
        process.exit(0);
      });

      // Force shutdown if taking longer than 10s
      setTimeout(() => {
        logger.error('Force shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.fatal(error, 'Failed to boot ToolToll backend server');
    process.exit(1);
  }
}

bootstrap();
