import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const PORT = process.env.PORT || 4000;
  const BASE_URL = `http://127.0.0.1:${PORT}`;

  // Passwords for demo accounts (clearly documented for local dev only)
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tooltoll.com' },
    update: {
      passwordHash,
      isAdmin: true,
      isCreator: true,
      isConsumer: true,
    },
    create: {
      email: 'admin@tooltoll.com',
      name: 'System Administrator',
      passwordHash,
      isAdmin: true,
      isCreator: true,
      isConsumer: true,
    },
  });

  let adminWallet = await prisma.wallet.findUnique({ where: { userId: admin.id } });
  if (!adminWallet) {
    adminWallet = await prisma.wallet.create({
      data: {
        userId: admin.id,
        balance: 100_000_000n, // $100.00
        reservedBalance: 0n,
        currency: 'USD',
      },
    });
  }

  // Double-entry record for admin seed balance
  const existingAdminLedger = await prisma.ledgerEntry.findFirst({
    where: { walletId: adminWallet.id, referenceType: 'SEED' },
  });
  if (!existingAdminLedger) {
    await prisma.ledgerEntry.create({
      data: {
        walletId: adminWallet.id,
        account: 'USER_WALLET',
        entryType: 'CREDIT',
        amount: 100_000_000n,
        balanceAfter: adminWallet.balance,
        description: 'Initial seed balance for admin',
        referenceType: 'SEED',
        referenceId: 'seed_admin_init',
      },
    });
  }
  console.log('✅ Created/verified Admin user and wallet:', admin.email);

  // 2. Creator User
  const creator = await prisma.user.upsert({
    where: { email: 'creator@tooltoll.com' },
    update: {
      passwordHash,
      isAdmin: false,
      isCreator: true,
      isConsumer: true,
    },
    create: {
      email: 'creator@tooltoll.com',
      name: 'Alice Creator',
      passwordHash,
      isAdmin: false,
      isCreator: true,
      isConsumer: true,
    },
  });

  let creatorWallet = await prisma.wallet.findUnique({ where: { userId: creator.id } });
  if (!creatorWallet) {
    creatorWallet = await prisma.wallet.create({
      data: {
        userId: creator.id,
        balance: 25_000_000n, // $25.00
        reservedBalance: 0n,
        currency: 'USD',
      },
    });
  }

  // Double-entry record for creator seed balance
  const existingCreatorLedger = await prisma.ledgerEntry.findFirst({
    where: { walletId: creatorWallet.id, referenceType: 'SEED' },
  });
  if (!existingCreatorLedger) {
    await prisma.ledgerEntry.create({
      data: {
        walletId: creatorWallet.id,
        account: 'USER_WALLET',
        entryType: 'CREDIT',
        amount: 25_000_000n,
        balanceAfter: creatorWallet.balance,
        description: 'Initial seed balance for creator',
        referenceType: 'SEED',
        referenceId: 'seed_creator_init',
      },
    });
  }
  console.log('✅ Created/verified Creator user and wallet:', creator.email);

  // 3. Consumer User
  const consumer = await prisma.user.upsert({
    where: { email: 'consumer@tooltoll.com' },
    update: {
      passwordHash,
      isAdmin: false,
      isCreator: false,
      isConsumer: true,
    },
    create: {
      email: 'consumer@tooltoll.com',
      name: 'Bob Consumer',
      passwordHash,
      isAdmin: false,
      isCreator: false,
      isConsumer: true,
    },
  });

  let consumerWallet = await prisma.wallet.findUnique({ where: { userId: consumer.id } });
  if (!consumerWallet) {
    consumerWallet = await prisma.wallet.create({
      data: {
        userId: consumer.id,
        balance: 50_000_000n, // $50.00 initial balance for immediate testing
        reservedBalance: 0n,
        currency: 'USD',
      },
    });
  }

  // Double-entry record for consumer seed balance
  const existingConsumerLedger = await prisma.ledgerEntry.findFirst({
    where: { walletId: consumerWallet.id, referenceType: 'SEED' },
  });
  if (!existingConsumerLedger) {
    await prisma.ledgerEntry.create({
      data: {
        walletId: consumerWallet.id,
        account: 'USER_WALLET',
        entryType: 'CREDIT',
        amount: 50_000_000n,
        balanceAfter: consumerWallet.balance,
        description: 'Initial seed balance for local testing',
        referenceType: 'SEED',
        referenceId: 'seed_init',
      },
    });
  }
  console.log('✅ Created/verified Consumer user and wallet:', consumer.email);

  // 4. Default Agent for Consumer
  const existingAgent = await prisma.agent.findFirst({
    where: { userId: consumer.id, name: 'Default Research Agent' },
  });

  const agent = existingAgent || await prisma.agent.create({
    data: {
      userId: consumer.id,
      name: 'Default Research Agent',
      description: 'Autonomous research and analysis agent with spend limits',
      maxPerCallMicroUsd: 10_000_000n, // $10.00 max per call
      dailyBudgetMicroUsd: 50_000_000n, // $50.00 daily
      monthlyBudgetMicroUsd: 500_000_000n, // $500.00 monthly
      approvalThresholdMicroUsd: 5_000_000n, // $5.00 threshold
      autoApproveTags: ['demo', 'translation', 'nlp', 'security'],
    },
  });

  // Fixed demo token for predictable testing: "tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  const demoToken = 'tt_live_demo1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const demoHash = crypto.createHash('sha256').update(demoToken).digest('hex');

  const existingCred = await prisma.agentCredential.findUnique({
    where: { tokenHash: demoHash },
  });

  if (!existingCred) {
    await prisma.agentCredential.create({
      data: {
        agentId: agent.id,
        prefix: 'tt_live_demo1234',
        tokenHash: demoHash,
        name: 'Demo Integration Key',
        scopes: ['tools:execute', 'tools:read'],
      },
    });
    console.log('✅ Created Demo Agent credential: tt_live_demo1234...');
  } else {
    await prisma.agentCredential.update({
      where: { tokenHash: demoHash },
      data: {
        agentId: agent.id,
        revokedAt: null,
      },
    });
    console.log('✅ Verified Demo Agent credential: tt_live_demo1234...');
  }

  // 5. Seed Local Demo Tools (PRD 11)
  const demoTools = [
    {
      slug: 'demo-text-translator',
      name: 'Text Translator (Demo)',
      shortDescription: 'Multi-language phrase translation demo with local dictionary',
      detailedDescription:
        'Translates common phrases into Spanish, French, German, and Hindi. Clearly labeled local demo implementation.',
      category: 'Translation',
      tags: ['translation', 'multilingual', 'demo', 'language'],
      baseUrl: BASE_URL,
      endpointPath: '/api/demo/translate',
      httpMethod: 'POST',
      inputSchema: {
        type: 'object',
        required: ['text', 'targetLanguage'],
        properties: {
          text: { type: 'string', description: 'The text to translate' },
          targetLanguage: { type: 'string', description: 'Target 2-letter language code: es, fr, de, hi, it' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          originalText: { type: 'string' },
          translatedText: { type: 'string' },
          targetLanguage: { type: 'string' },
        },
      },
      priceMicroUsd: 2000n, // $0.002
      timeoutMs: 5000,
      status: 'APPROVED',
      isDemo: true,
    },
    {
      slug: 'demo-scam-risk-analyzer',
      name: 'Scam Message Risk Analyzer (Demo)',
      shortDescription: 'Heuristic risk score and indicators for suspicious messages',
      detailedDescription:
        'Analyzes text messages or emails for urgency tactics, credential harvesting, lottery scams, and suspicious links. Outputs an advisory risk score (not a legal determination).',
      category: 'Security',
      tags: ['security', 'scam', 'phishing', 'fraud', 'demo'],
      baseUrl: BASE_URL,
      endpointPath: '/api/demo/scam-risk',
      httpMethod: 'POST',
      inputSchema: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', description: 'The text message to evaluate for risk heuristics' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          riskScore: { type: 'number' },
          riskLevel: { type: 'string' },
          reasons: { type: 'array', items: { type: 'string' } },
        },
      },
      priceMicroUsd: 5000n, // $0.005
      timeoutMs: 5000,
      status: 'APPROVED',
      isDemo: true,
    },
    {
      slug: 'demo-sentiment-analyzer',
      name: 'Sentiment Analyzer (Demo)',
      shortDescription: 'Lexicon-based sentiment polarity evaluation for text',
      detailedDescription:
        'Evaluates customer reviews, social commentary, or feedback using a curated polarity lexicon, returning positive, neutral, or negative sentiment and score.',
      category: 'NLP',
      tags: ['nlp', 'sentiment', 'text-analysis', 'demo'],
      baseUrl: BASE_URL,
      endpointPath: '/api/demo/sentiment',
      httpMethod: 'POST',
      inputSchema: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'The text content to analyze' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          sentiment: { type: 'string' },
          score: { type: 'number' },
          keywordsMatched: { type: 'array', items: { type: 'string' } },
        },
      },
      priceMicroUsd: 1500n, // $0.0015
      timeoutMs: 5000,
      status: 'APPROVED',
      isDemo: true,
    },
  ];

  for (const t of demoTools) {
    const tool = await prisma.tool.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        shortDescription: t.shortDescription,
        detailedDescription: t.detailedDescription,
        category: t.category,
        tags: t.tags,
        baseUrl: t.baseUrl,
        endpointPath: t.endpointPath,
        httpMethod: t.httpMethod,
        inputSchema: t.inputSchema as object,
        outputSchema: t.outputSchema as object,
        priceMicroUsd: t.priceMicroUsd,
        timeoutMs: t.timeoutMs,
        status: t.status,
        isDemo: t.isDemo,
      },
      create: {
        creatorId: creator.id,
        slug: t.slug,
        name: t.name,
        shortDescription: t.shortDescription,
        detailedDescription: t.detailedDescription,
        category: t.category,
        tags: t.tags,
        baseUrl: t.baseUrl,
        endpointPath: t.endpointPath,
        httpMethod: t.httpMethod,
        inputSchema: t.inputSchema as object,
        outputSchema: t.outputSchema as object,
        authMethod: 'NONE',
        priceMicroUsd: t.priceMicroUsd,
        timeoutMs: t.timeoutMs,
        status: t.status,
        isDemo: t.isDemo,
      },
    });

    const existingVersion = await prisma.toolVersion.findUnique({
      where: { toolId_version: { toolId: tool.id, version: 1 } },
    });

    if (!existingVersion) {
      await prisma.toolVersion.create({
        data: {
          toolId: tool.id,
          version: 1,
          inputSchema: t.inputSchema as object,
          outputSchema: t.outputSchema as object,
          priceMicroUsd: t.priceMicroUsd,
          endpointPath: t.endpointPath,
          httpMethod: t.httpMethod,
          authMethod: 'NONE',
        },
      });
    }

    console.log(`✅ Seeded demo tool: ${tool.name} (${tool.slug})`);
  }

  // 6. Platform Settings
  await prisma.platformSetting.upsert({
    where: { key: 'PLATFORM_FEE_BPS' },
    update: {},
    create: {
      key: 'PLATFORM_FEE_BPS',
      value: '1000',
      description: 'Default platform commission in basis points (1000 = 10%)',
    },
  });

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

