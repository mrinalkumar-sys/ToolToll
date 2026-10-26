export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ToolToll API Marketplace',
    version: '1.0.0',
    description: 'Pay-per-use API marketplace for AI agents, developers, and creators.',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'Server is healthy' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                  isCreator: { type: 'boolean' },
                  isConsumer: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User registered' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'User logged in' },
        },
      },
    },
    '/api/tools': {
      get: {
        summary: 'List available marketplace tools',
        responses: {
          '200': { description: 'List of tools' },
        },
      },
      post: {
        summary: 'Register a new tool',
        responses: {
          '201': { description: 'Tool created in DRAFT' },
        },
      },
    },
    '/api/agent/plan': {
      post: {
        summary: 'Generate deterministic agent plan for task',
        responses: {
          '200': { description: 'Ranked plan with cost estimates' },
        },
      },
    },
  },
};
