import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.APP_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.APP_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-agent-key"]',
      'req.headers["cookie"]',
      'password',
      'token',
      'secret',
      'encryptedSecret',
      'upstreamCredential',
      'creditCard',
    ],
    censor: '[REDACTED_SECRET]',
  },
});
