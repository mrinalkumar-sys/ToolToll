--
-- PostgreSQL database dump
--

\restrict q3HWRQ4yH3nFXBwIPvBb8DTTVWucWKaGnMvhX39ZqXWS2LOYQZaa9c8xfdfygJR

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abuse_reports; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.abuse_reports (
    id text NOT NULL,
    "reporterId" text,
    "toolId" text NOT NULL,
    "callId" text,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.abuse_reports OWNER TO tooltoll;

--
-- Name: admin_reviews; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.admin_reviews (
    id text NOT NULL,
    "toolId" text NOT NULL,
    "adminId" text NOT NULL,
    decision text NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.admin_reviews OWNER TO tooltoll;

--
-- Name: agent_credentials; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.agent_credentials (
    id text NOT NULL,
    "agentId" text NOT NULL,
    prefix text NOT NULL,
    "tokenHash" text NOT NULL,
    name text DEFAULT 'Default Key'::text NOT NULL,
    scopes text[] DEFAULT ARRAY['tools:execute'::text, 'tools:read'::text],
    "expiresAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.agent_credentials OWNER TO tooltoll;

--
-- Name: agent_permissions; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.agent_permissions (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "toolId" text,
    category text,
    "isAllowed" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agent_permissions OWNER TO tooltoll;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.agents (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "maxPerCallMicroUsd" bigint DEFAULT 1000000 NOT NULL,
    "dailyBudgetMicroUsd" bigint DEFAULT 50000000 NOT NULL,
    "monthlyBudgetMicroUsd" bigint DEFAULT 500000000 NOT NULL,
    "approvalThresholdMicroUsd" bigint DEFAULT 5000000 NOT NULL,
    "autoApproveTags" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agents OWNER TO tooltoll;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    "agentId" text,
    action text NOT NULL,
    "resourceType" text NOT NULL,
    "resourceId" text,
    metadata jsonb,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO tooltoll;

--
-- Name: creator_earnings; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.creator_earnings (
    id text NOT NULL,
    "creatorId" text NOT NULL,
    "toolCallId" text,
    "toolId" text NOT NULL,
    "grossMicroUsd" bigint NOT NULL,
    "platformFeeMicroUsd" bigint NOT NULL,
    "netMicroUsd" bigint NOT NULL,
    status text DEFAULT 'PAYABLE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.creator_earnings OWNER TO tooltoll;

--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.ledger_entries (
    id text NOT NULL,
    "walletId" text,
    "callId" text,
    account text NOT NULL,
    "entryType" text NOT NULL,
    amount bigint NOT NULL,
    "balanceAfter" bigint,
    description text NOT NULL,
    "referenceType" text,
    "referenceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ledger_entries OWNER TO tooltoll;

--
-- Name: payout_requests; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.payout_requests (
    id text NOT NULL,
    "creatorId" text NOT NULL,
    "amountMicroUsd" bigint NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "payoutMethod" text DEFAULT 'PAYPAL'::text NOT NULL,
    destination text NOT NULL,
    "externalBatchId" text,
    "isSimulated" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payout_requests OWNER TO tooltoll;

--
-- Name: paypal_orders; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.paypal_orders (
    id text NOT NULL,
    "userId" text NOT NULL,
    "walletId" text NOT NULL,
    "orderId" text NOT NULL,
    "amountUsd" text NOT NULL,
    "amountMicroUsd" bigint NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text NOT NULL,
    "rawCapture" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.paypal_orders OWNER TO tooltoll;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.platform_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.platform_settings OWNER TO tooltoll;

--
-- Name: quality_reviews; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.quality_reviews (
    id text NOT NULL,
    "toolId" text NOT NULL,
    "callId" text,
    layer text NOT NULL,
    passed boolean NOT NULL,
    score double precision,
    reason text NOT NULL,
    evidence jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.quality_reviews OWNER TO tooltoll;

--
-- Name: tool_calls; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.tool_calls (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "toolId" text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "priceMicroUsd" bigint NOT NULL,
    "platformFeeBps" integer NOT NULL,
    "platformFeeMicroUsd" bigint NOT NULL,
    "creatorEarningsMicroUsd" bigint NOT NULL,
    status text NOT NULL,
    "sanitizedInput" jsonb NOT NULL,
    "sanitizedOutput" jsonb,
    "httpStatus" integer,
    "latencyMs" integer,
    "failureReason" text,
    "isReversed" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public.tool_calls OWNER TO tooltoll;

--
-- Name: tool_test_runs; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.tool_test_runs (
    id text NOT NULL,
    "toolId" text NOT NULL,
    "sampleInput" jsonb NOT NULL,
    "responseStatus" integer,
    "responseBody" jsonb,
    "latencyMs" integer,
    "isSuccess" boolean NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tool_test_runs OWNER TO tooltoll;

--
-- Name: tool_versions; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.tool_versions (
    id text NOT NULL,
    "toolId" text NOT NULL,
    version integer NOT NULL,
    "inputSchema" jsonb NOT NULL,
    "outputSchema" jsonb,
    "priceMicroUsd" bigint NOT NULL,
    "endpointPath" text NOT NULL,
    "httpMethod" text NOT NULL,
    "authMethod" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tool_versions OWNER TO tooltoll;

--
-- Name: tools; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.tools (
    id text NOT NULL,
    "creatorId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "shortDescription" text NOT NULL,
    "detailedDescription" text NOT NULL,
    category text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    "baseUrl" text NOT NULL,
    "endpointPath" text NOT NULL,
    "httpMethod" text DEFAULT 'POST'::text NOT NULL,
    "inputSchema" jsonb NOT NULL,
    "outputSchema" jsonb,
    "authMethod" text DEFAULT 'NONE'::text NOT NULL,
    "authHeaderName" text,
    "encryptedSecret" text,
    "secretKeyVersion" text,
    "priceMicroUsd" bigint DEFAULT 1000 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "timeoutMs" integer DEFAULT 15000 NOT NULL,
    "rateLimitPerMinute" integer DEFAULT 60 NOT NULL,
    terms text,
    "supportContact" text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tools OWNER TO tooltoll;

--
-- Name: topups; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.topups (
    id text NOT NULL,
    "walletId" text NOT NULL,
    "amountMicroUsd" bigint NOT NULL,
    provider text NOT NULL,
    status text NOT NULL,
    "paypalOrderId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.topups OWNER TO tooltoll;

--
-- Name: users; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    "isCreator" boolean DEFAULT false NOT NULL,
    "isConsumer" boolean DEFAULT true NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO tooltoll;

--
-- Name: wallet_reservations; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.wallet_reservations (
    id text NOT NULL,
    "walletId" text NOT NULL,
    "agentId" text,
    "toolId" text,
    "callId" text,
    amount bigint NOT NULL,
    status text DEFAULT 'RESERVED'::text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.wallet_reservations OWNER TO tooltoll;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.wallets (
    id text NOT NULL,
    "userId" text NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    "reservedBalance" bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.wallets OWNER TO tooltoll;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: tooltoll
--

CREATE TABLE public.webhook_events (
    id text NOT NULL,
    provider text DEFAULT 'PAYPAL'::text NOT NULL,
    "eventId" text NOT NULL,
    "eventType" text NOT NULL,
    "resourceType" text,
    payload jsonb NOT NULL,
    status text DEFAULT 'PROCESSED'::text NOT NULL,
    "processedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.webhook_events OWNER TO tooltoll;

--
-- Data for Name: abuse_reports; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.abuse_reports (id, "reporterId", "toolId", "callId", reason, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: admin_reviews; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.admin_reviews (id, "toolId", "adminId", decision, reason, "createdAt") FROM stdin;
\.


--
-- Data for Name: agent_credentials; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.agent_credentials (id, "agentId", prefix, "tokenHash", name, scopes, "expiresAt", "revokedAt", "lastUsedAt", "createdAt") FROM stdin;
28db38f9-0d8d-44bd-96f5-8c5f5a5dbfa1	91858741-81d7-4ef3-86a2-2ed5c5a88465	tt_live_demo1234	fb2dc3697632287489a9dc44216520d8387f4d935e0239b526b6e9388864abce	Demo Integration Key	{tools:execute,tools:read}	\N	\N	\N	2026-10-27 18:38:24.343
\.


--
-- Data for Name: agent_permissions; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.agent_permissions (id, "agentId", "toolId", category, "isAllowed", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.agents (id, "userId", name, description, "isActive", "maxPerCallMicroUsd", "dailyBudgetMicroUsd", "monthlyBudgetMicroUsd", "approvalThresholdMicroUsd", "autoApproveTags", "createdAt", "updatedAt") FROM stdin;
91858741-81d7-4ef3-86a2-2ed5c5a88465	7e6ad831-f03a-497a-b3ea-e09e0770f688	Default Research Agent	Autonomous research and analysis agent with spend limits	t	10000000	50000000	500000000	5000000	{demo,translation,nlp,security}	2026-10-27 18:38:24.334	2026-10-27 18:38:24.334
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.audit_logs (id, "userId", "agentId", action, "resourceType", "resourceId", metadata, "ipAddress", "createdAt") FROM stdin;
077e646c-8ba4-4c41-8563-2a5b8844e2c4	75c09933-2477-4199-9278-8b0942217579	\N	COMMISSION_UPDATED	PLATFORM_SETTING	PLATFORM_FEE_BPS	{"platformFeeBps": 1000}	::ffff:172.19.0.1	2026-10-27 19:23:12.274
\.


--
-- Data for Name: creator_earnings; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.creator_earnings (id, "creatorId", "toolCallId", "toolId", "grossMicroUsd", "platformFeeMicroUsd", "netMicroUsd", status, "createdAt", "updatedAt") FROM stdin;
03e4b686-1118-4206-a5df-b17c2f932ef2	c0155105-bb5e-49ca-a0e1-82d984d01dff	3d95f013-a9c8-44f8-9824-793799fde4fc	7279c3ee-800c-4895-883c-fc3df5412e50	1500	150	1350	PAYABLE	2026-10-27 18:51:13.431	2026-10-27 18:51:13.431
b641b00d-a268-4fe9-961e-ae3bd4c1dd6e	c0155105-bb5e-49ca-a0e1-82d984d01dff	94669224-1245-44ff-8c08-0438edb1377a	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	2000	200	1800	PAYABLE	2026-10-27 19:21:25.106	2026-10-27 19:21:25.106
4b87e85d-9bfa-4416-8f21-50c366579553	c0155105-bb5e-49ca-a0e1-82d984d01dff	566e42aa-54d6-41da-a308-1303ac8b1772	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	2000	200	1800	PAYABLE	2026-10-27 19:22:03.228	2026-10-27 19:22:03.228
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.ledger_entries (id, "walletId", "callId", account, "entryType", amount, "balanceAfter", description, "referenceType", "referenceId", "createdAt") FROM stdin;
ca291aa7-cc7a-4f66-b42a-9db67315876f	d661ea26-d2b2-4f53-895c-356d61ec5d7f	\N	USER_WALLET	CREDIT	100000000	100000000	Initial seed balance for admin	SEED	seed_admin_init	2026-10-27 18:38:24.288
cb2c5a25-2527-4674-bed2-0a67575741ce	cbb2c726-9cdf-436f-b187-1cd66c708146	\N	USER_WALLET	CREDIT	25000000	25000000	Initial seed balance for creator	SEED	seed_creator_init	2026-10-27 18:38:24.308
4bef389d-341e-4b72-8061-2fb4d7de7003	27f650bb-2453-486e-885c-99f2effad3a9	\N	USER_WALLET	CREDIT	50000000	50000000	Initial seed balance for local testing	SEED	seed_init	2026-10-27 18:38:24.325
0eadda98-da2d-4710-8f6c-db4b3b8c7aac	27f650bb-2453-486e-885c-99f2effad3a9	3d95f013-a9c8-44f8-9824-793799fde4fc	USER_WALLET	DEBIT	1500	49998500	Hold funds for tool call 3d95f013-a9c8-44f8-9824-793799fde4fc	CALL_RESERVE	3d95f013-a9c8-44f8-9824-793799fde4fc	2026-10-27 18:51:13.357
4a153bd9-ea0f-4481-a419-318e9e1bf1c0	27f650bb-2453-486e-885c-99f2effad3a9	3d95f013-a9c8-44f8-9824-793799fde4fc	WALLET_RESERVED	CREDIT	1500	1500	Escrow reserved funds for call 3d95f013-a9c8-44f8-9824-793799fde4fc	CALL_RESERVE	3d95f013-a9c8-44f8-9824-793799fde4fc	2026-10-27 18:51:13.357
1803772f-5436-4a61-ba1d-b96068169fc5	27f650bb-2453-486e-885c-99f2effad3a9	3d95f013-a9c8-44f8-9824-793799fde4fc	WALLET_RESERVED	DEBIT	1500	\N	Release escrow for captured call 3d95f013-a9c8-44f8-9824-793799fde4fc	CALL_CAPTURE	3d95f013-a9c8-44f8-9824-793799fde4fc	2026-10-27 18:51:13.438
61908418-854e-4a27-a7fa-b9874c0d20b2	27f650bb-2453-486e-885c-99f2effad3a9	3d95f013-a9c8-44f8-9824-793799fde4fc	CREATOR_PAYABLE	CREDIT	1350	\N	Earnings credited for creator c0155105-bb5e-49ca-a0e1-82d984d01dff	CALL_CAPTURE	3d95f013-a9c8-44f8-9824-793799fde4fc	2026-10-27 18:51:13.438
8395bc7c-31bf-4b32-8a67-e4ddaf532302	27f650bb-2453-486e-885c-99f2effad3a9	3d95f013-a9c8-44f8-9824-793799fde4fc	PLATFORM_REVENUE	CREDIT	150	\N	Platform fee (1000 bps) on call 3d95f013-a9c8-44f8-9824-793799fde4fc	CALL_CAPTURE	3d95f013-a9c8-44f8-9824-793799fde4fc	2026-10-27 18:51:13.438
9e676e19-1b70-40fb-901e-340946fef1ea	27f650bb-2453-486e-885c-99f2effad3a9	\N	EXTERNAL_PAYPAL	DEBIT	10000000	\N	External deposit via MOCK: mock_topup_1793127649855	TOPUP	mock_topup_1793127649855	2026-10-27 19:00:49.868
1ecf84aa-084b-4c56-9eaf-81bafb75301d	27f650bb-2453-486e-885c-99f2effad3a9	\N	USER_WALLET	CREDIT	10000000	59998500	Wallet funded via MOCK	TOPUP	mock_topup_1793127649855	2026-10-27 19:00:49.868
73c73bd6-c161-475f-9e3a-25bc9bf42425	27f650bb-2453-486e-885c-99f2effad3a9	\N	EXTERNAL_PAYPAL	DEBIT	5000000	\N	External deposit via MOCK: mock_topup_1793128884941	TOPUP	mock_topup_1793128884941	2026-10-27 19:21:24.949
fe7380dd-2a14-4c20-bf89-12e40d48126b	27f650bb-2453-486e-885c-99f2effad3a9	\N	USER_WALLET	CREDIT	5000000	64998500	Wallet funded via MOCK	TOPUP	mock_topup_1793128884941	2026-10-27 19:21:24.949
be9bb088-fb2d-401b-9ffc-d816e568c57f	27f650bb-2453-486e-885c-99f2effad3a9	94669224-1245-44ff-8c08-0438edb1377a	USER_WALLET	DEBIT	2000	64996500	Hold funds for tool call 94669224-1245-44ff-8c08-0438edb1377a	CALL_RESERVE	94669224-1245-44ff-8c08-0438edb1377a	2026-10-27 19:21:25.065
0e04e67b-634d-441f-947d-cf9490e6ec32	27f650bb-2453-486e-885c-99f2effad3a9	94669224-1245-44ff-8c08-0438edb1377a	WALLET_RESERVED	CREDIT	2000	2000	Escrow reserved funds for call 94669224-1245-44ff-8c08-0438edb1377a	CALL_RESERVE	94669224-1245-44ff-8c08-0438edb1377a	2026-10-27 19:21:25.065
8fde03b9-c53e-4ee2-9633-a55334e5c3db	27f650bb-2453-486e-885c-99f2effad3a9	94669224-1245-44ff-8c08-0438edb1377a	WALLET_RESERVED	DEBIT	2000	\N	Release escrow for captured call 94669224-1245-44ff-8c08-0438edb1377a	CALL_CAPTURE	94669224-1245-44ff-8c08-0438edb1377a	2026-10-27 19:21:25.111
bceff7fc-1196-499c-8d4b-6cc45f4a1d05	27f650bb-2453-486e-885c-99f2effad3a9	94669224-1245-44ff-8c08-0438edb1377a	CREATOR_PAYABLE	CREDIT	1800	\N	Earnings credited for creator c0155105-bb5e-49ca-a0e1-82d984d01dff	CALL_CAPTURE	94669224-1245-44ff-8c08-0438edb1377a	2026-10-27 19:21:25.111
e56aaaa3-5f93-4cb2-bc64-7d5b05bd317a	27f650bb-2453-486e-885c-99f2effad3a9	94669224-1245-44ff-8c08-0438edb1377a	PLATFORM_REVENUE	CREDIT	200	\N	Platform fee (1000 bps) on call 94669224-1245-44ff-8c08-0438edb1377a	CALL_CAPTURE	94669224-1245-44ff-8c08-0438edb1377a	2026-10-27 19:21:25.111
2929511b-c328-4220-b58c-1b134ffc865e	27f650bb-2453-486e-885c-99f2effad3a9	566e42aa-54d6-41da-a308-1303ac8b1772	USER_WALLET	DEBIT	2000	64994500	Hold funds for tool call 566e42aa-54d6-41da-a308-1303ac8b1772	CALL_RESERVE	566e42aa-54d6-41da-a308-1303ac8b1772	2026-10-27 19:22:03.199
e2d65fbc-585c-4c70-9095-5a2af40b349e	27f650bb-2453-486e-885c-99f2effad3a9	566e42aa-54d6-41da-a308-1303ac8b1772	WALLET_RESERVED	CREDIT	2000	2000	Escrow reserved funds for call 566e42aa-54d6-41da-a308-1303ac8b1772	CALL_RESERVE	566e42aa-54d6-41da-a308-1303ac8b1772	2026-10-27 19:22:03.199
8ac58733-ccc7-4341-86a4-cd967be64dc1	27f650bb-2453-486e-885c-99f2effad3a9	566e42aa-54d6-41da-a308-1303ac8b1772	WALLET_RESERVED	DEBIT	2000	\N	Release escrow for captured call 566e42aa-54d6-41da-a308-1303ac8b1772	CALL_CAPTURE	566e42aa-54d6-41da-a308-1303ac8b1772	2026-10-27 19:22:03.233
c5c5848f-8283-4914-ac9a-aab1c5c9a41d	27f650bb-2453-486e-885c-99f2effad3a9	566e42aa-54d6-41da-a308-1303ac8b1772	CREATOR_PAYABLE	CREDIT	1800	\N	Earnings credited for creator c0155105-bb5e-49ca-a0e1-82d984d01dff	CALL_CAPTURE	566e42aa-54d6-41da-a308-1303ac8b1772	2026-10-27 19:22:03.233
583ff197-54b9-435a-8c5e-4765a27ba5cd	27f650bb-2453-486e-885c-99f2effad3a9	566e42aa-54d6-41da-a308-1303ac8b1772	PLATFORM_REVENUE	CREDIT	200	\N	Platform fee (1000 bps) on call 566e42aa-54d6-41da-a308-1303ac8b1772	CALL_CAPTURE	566e42aa-54d6-41da-a308-1303ac8b1772	2026-10-27 19:22:03.233
\.


--
-- Data for Name: payout_requests; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.payout_requests (id, "creatorId", "amountMicroUsd", status, "payoutMethod", destination, "externalBatchId", "isSimulated", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: paypal_orders; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.paypal_orders (id, "userId", "walletId", "orderId", "amountUsd", "amountMicroUsd", currency, status, "rawCapture", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.platform_settings (key, value, description, "updatedAt") FROM stdin;
PLATFORM_FEE_BPS	1000	Default platform commission in basis points (1000 = 10%)	2026-10-27 19:23:12.257
\.


--
-- Data for Name: quality_reviews; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.quality_reviews (id, "toolId", "callId", layer, passed, score, reason, evidence, "createdAt") FROM stdin;
\.


--
-- Data for Name: tool_calls; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.tool_calls (id, "agentId", "toolId", "idempotencyKey", "priceMicroUsd", "platformFeeBps", "platformFeeMicroUsd", "creatorEarningsMicroUsd", status, "sanitizedInput", "sanitizedOutput", "httpStatus", "latencyMs", "failureReason", "isReversed", "createdAt", "completedAt") FROM stdin;
3d95f013-a9c8-44f8-9824-793799fde4fc	91858741-81d7-4ef3-86a2-2ed5c5a88465	7279c3ee-800c-4895-883c-fc3df5412e50	381f653f-dde6-4d35-8700-163761ce7c42	1500	1000	150	1350	SUCCESS	{"text": "ToolToll is an absolutely amazing API platform! I love how fast and seamless it is."}	{"data": {"score": 3, "isDemo": true, "sentiment": "positive", "keywordsMatched": ["+amazing", "+love", "+fast"], "analyzedWordCount": 15}, "success": true}	200	45	\N	f	2026-10-27 18:51:13.365	2026-10-27 18:51:13.443
94669224-1245-44ff-8c08-0438edb1377a	91858741-81d7-4ef3-86a2-2ed5c5a88465	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	d70de1b7-b0e5-4e1b-99c2-475b1d0734fe	2000	1000	200	1800	SUCCESS	{"text": "hello world", "targetLanguage": "fr"}	{"data": {"originalText": "hello world", "providerNote": "Demo translation: uses local dictionary with limited vocabulary", "targetLanguage": "fr", "translatedText": "bonjour monde", "detectedSourceLanguage": "en"}, "success": true}	200	8	\N	f	2026-10-27 19:21:25.076	2026-10-27 19:21:25.117
566e42aa-54d6-41da-a308-1303ac8b1772	91858741-81d7-4ef3-86a2-2ed5c5a88465	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	plan_25090521-84c2-4dcb-b8a1-90679bda289c	2000	1000	200	1800	SUCCESS	{"text": "hello world", "targetLanguage": "es"}	{"data": {"originalText": "hello world", "providerNote": "Demo translation: uses local dictionary with limited vocabulary", "targetLanguage": "es", "translatedText": "hola mundo", "detectedSourceLanguage": "en"}, "success": true}	200	2	\N	f	2026-10-27 19:22:03.216	2026-10-27 19:22:03.236
\.


--
-- Data for Name: tool_test_runs; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.tool_test_runs (id, "toolId", "sampleInput", "responseStatus", "responseBody", "latencyMs", "isSuccess", "errorMessage", "createdAt") FROM stdin;
\.


--
-- Data for Name: tool_versions; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.tool_versions (id, "toolId", version, "inputSchema", "outputSchema", "priceMicroUsd", "endpointPath", "httpMethod", "authMethod", "createdAt") FROM stdin;
0ef3d425-c13c-4fda-9730-41c30b378a64	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	1	{"type": "object", "required": ["text", "targetLanguage"], "properties": {"text": {"type": "string", "description": "The text to translate"}, "targetLanguage": {"type": "string", "description": "Target 2-letter language code: es, fr, de, hi, it"}}}	{"type": "object", "properties": {"originalText": {"type": "string"}, "targetLanguage": {"type": "string"}, "translatedText": {"type": "string"}}}	2000	/api/demo/translate	POST	NONE	2026-10-27 18:38:24.364
740bdd20-1faf-49b2-b297-0e37ba7afc1b	1559fcfb-26ad-4dd2-8aa5-4ddc99b14dbd	1	{"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "The text message to evaluate for risk heuristics"}}}	{"type": "object", "properties": {"reasons": {"type": "array", "items": {"type": "string"}}, "riskLevel": {"type": "string"}, "riskScore": {"type": "number"}}}	5000	/api/demo/scam-risk	POST	NONE	2026-10-27 18:38:24.378
0e0e28f4-2d8b-42f2-8ffc-6064a5fc40db	7279c3ee-800c-4895-883c-fc3df5412e50	1	{"type": "object", "required": ["text"], "properties": {"text": {"type": "string", "description": "The text content to analyze"}}}	{"type": "object", "properties": {"score": {"type": "number"}, "sentiment": {"type": "string"}, "keywordsMatched": {"type": "array", "items": {"type": "string"}}}}	1500	/api/demo/sentiment	POST	NONE	2026-10-27 18:38:24.391
\.


--
-- Data for Name: tools; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.tools (id, "creatorId", name, slug, "shortDescription", "detailedDescription", category, tags, "baseUrl", "endpointPath", "httpMethod", "inputSchema", "outputSchema", "authMethod", "authHeaderName", "encryptedSecret", "secretKeyVersion", "priceMicroUsd", currency, "timeoutMs", "rateLimitPerMinute", terms, "supportContact", status, version, "isDemo", "createdAt", "updatedAt") FROM stdin;
bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	c0155105-bb5e-49ca-a0e1-82d984d01dff	Text Translator (Demo)	demo-text-translator	Multi-language phrase translation demo with local dictionary	Translates common phrases into Spanish, French, German, and Hindi. Clearly labeled local demo implementation.	Translation	{translation,multilingual,demo,language}	http://127.0.0.1:4000	/api/demo/translate	POST	{"type": "object", "required": ["text", "targetLanguage"], "properties": {"text": {"type": "string", "description": "The text to translate"}, "targetLanguage": {"type": "string", "description": "Target 2-letter language code: es, fr, de, hi, it"}}}	{"type": "object", "properties": {"originalText": {"type": "string"}, "targetLanguage": {"type": "string"}, "translatedText": {"type": "string"}}}	NONE	\N	\N	\N	2000	USD	5000	60	\N	\N	APPROVED	1	t	2026-10-27 18:38:24.35	2026-10-27 18:38:24.35
1559fcfb-26ad-4dd2-8aa5-4ddc99b14dbd	c0155105-bb5e-49ca-a0e1-82d984d01dff	Scam Message Risk Analyzer (Demo)	demo-scam-risk-analyzer	Heuristic risk score and indicators for suspicious messages	Analyzes text messages or emails for urgency tactics, credential harvesting, lottery scams, and suspicious links. Outputs an advisory risk score (not a legal determination).	Security	{security,scam,phishing,fraud,demo}	http://127.0.0.1:4000	/api/demo/scam-risk	POST	{"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "The text message to evaluate for risk heuristics"}}}	{"type": "object", "properties": {"reasons": {"type": "array", "items": {"type": "string"}}, "riskLevel": {"type": "string"}, "riskScore": {"type": "number"}}}	NONE	\N	\N	\N	5000	USD	5000	60	\N	\N	APPROVED	1	t	2026-10-27 18:38:24.371	2026-10-27 18:38:24.371
7279c3ee-800c-4895-883c-fc3df5412e50	c0155105-bb5e-49ca-a0e1-82d984d01dff	Sentiment Analyzer (Demo)	demo-sentiment-analyzer	Lexicon-based sentiment polarity evaluation for text	Evaluates customer reviews, social commentary, or feedback using a curated polarity lexicon, returning positive, neutral, or negative sentiment and score.	NLP	{nlp,sentiment,text-analysis,demo}	http://127.0.0.1:4000	/api/demo/sentiment	POST	{"type": "object", "required": ["text"], "properties": {"text": {"type": "string", "description": "The text content to analyze"}}}	{"type": "object", "properties": {"score": {"type": "number"}, "sentiment": {"type": "string"}, "keywordsMatched": {"type": "array", "items": {"type": "string"}}}}	NONE	\N	\N	\N	1500	USD	5000	60	\N	\N	APPROVED	1	t	2026-10-27 18:38:24.384	2026-10-27 18:38:24.384
\.


--
-- Data for Name: topups; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.topups (id, "walletId", "amountMicroUsd", provider, status, "paypalOrderId", "createdAt", "updatedAt") FROM stdin;
d80fbdac-df01-4e04-a4e0-4471e3e010c0	27f650bb-2453-486e-885c-99f2effad3a9	10000000	MOCK	COMPLETED	\N	2026-10-27 19:00:49.864	2026-10-27 19:00:49.864
21146697-11f7-4615-82fe-6a3ad7be5c21	27f650bb-2453-486e-885c-99f2effad3a9	5000000	MOCK	COMPLETED	\N	2026-10-27 19:21:24.947	2026-10-27 19:21:24.947
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.users (id, email, "passwordHash", name, "isCreator", "isConsumer", "isAdmin", "createdAt", "updatedAt") FROM stdin;
75c09933-2477-4199-9278-8b0942217579	admin@tooltoll.com	$2b$10$fSYm7EfmXFFqjmYItaDGuuGgO0f8EXVyJdA.gNZnnAsOSxPcbNQgW	System Administrator	t	t	t	2026-10-27 18:38:24.26	2026-10-27 18:38:24.26
c0155105-bb5e-49ca-a0e1-82d984d01dff	creator@tooltoll.com	$2b$10$fSYm7EfmXFFqjmYItaDGuuGgO0f8EXVyJdA.gNZnnAsOSxPcbNQgW	Alice Creator	t	t	f	2026-10-27 18:38:24.295	2026-10-27 18:38:24.295
7e6ad831-f03a-497a-b3ea-e09e0770f688	consumer@tooltoll.com	$2b$10$fSYm7EfmXFFqjmYItaDGuuGgO0f8EXVyJdA.gNZnnAsOSxPcbNQgW	Bob Consumer	f	t	f	2026-10-27 18:38:24.312	2026-10-27 18:38:24.312
8092c790-3e9d-4df6-b71b-922b6976b322	abc123@gmail.com	$2b$12$5x46k1wKYw61nfRwZK3vROY/XxQBwVoay/bkjzpYahE8wdiPz5Yly	Sanjeev	f	t	f	2026-10-27 19:52:40.019	2026-10-27 19:52:40.019
4da3194e-0186-41d9-be5a-0654e769a28b	mrial123@gmail.com	$2b$12$xq4qoI9dwuAGFGnvoi2YhOBeRsZGXnYyxI9DyPm.KjxT2AWCa1hHW	Mrinal	t	t	f	2026-10-27 20:25:17.625	2026-10-27 20:25:17.625
3edd8c13-fe18-42bf-a7e3-b8c4497641b2	sbahs2832@gmail.com	$2b$12$wCCY8cb/oqBLWNvlGjaKM.gZJ.Nf/bmxAF2Q2Mnn8qMgyUubjyULK	alex	f	t	f	2026-10-27 20:38:15.488	2026-10-27 20:38:15.488
578e1b62-a026-4688-bef3-8c33937bc0be	amsjdn23@gmail.com	$2b$12$KtnM8GC6FSqMlW436rj4H.o/YhSFUhvSyFv3dvZliKckS9zYjcA7y	adam	t	t	f	2026-10-27 20:45:54.288	2026-10-27 20:45:54.288
\.


--
-- Data for Name: wallet_reservations; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.wallet_reservations (id, "walletId", "agentId", "toolId", "callId", amount, status, "expiresAt", "createdAt", "updatedAt") FROM stdin;
f67c8ceb-dc5e-4020-9f04-0013d4030653	27f650bb-2453-486e-885c-99f2effad3a9	91858741-81d7-4ef3-86a2-2ed5c5a88465	7279c3ee-800c-4895-883c-fc3df5412e50	3d95f013-a9c8-44f8-9824-793799fde4fc	1500	CAPTURED	2026-10-27 18:56:13.351	2026-10-27 18:51:13.352	2026-10-27 18:51:13.426
25071f80-4c71-4295-a351-9bd083e2a2a7	27f650bb-2453-486e-885c-99f2effad3a9	91858741-81d7-4ef3-86a2-2ed5c5a88465	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	94669224-1245-44ff-8c08-0438edb1377a	2000	CAPTURED	2026-10-27 19:26:25.059	2026-10-27 19:21:25.06	2026-10-27 19:21:25.103
df8727db-0c1b-4dab-abf6-fee7372a528a	27f650bb-2453-486e-885c-99f2effad3a9	91858741-81d7-4ef3-86a2-2ed5c5a88465	bcc3aa6e-9a5d-4f7f-9552-1a3209c9d3e2	566e42aa-54d6-41da-a308-1303ac8b1772	2000	CAPTURED	2026-10-27 19:27:03.194	2026-10-27 19:22:03.195	2026-10-27 19:22:03.227
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.wallets (id, "userId", balance, "reservedBalance", currency, "createdAt", "updatedAt") FROM stdin;
d661ea26-d2b2-4f53-895c-356d61ec5d7f	75c09933-2477-4199-9278-8b0942217579	100000000	0	USD	2026-10-27 18:38:24.278	2026-10-27 18:38:24.278
cbb2c726-9cdf-436f-b187-1cd66c708146	c0155105-bb5e-49ca-a0e1-82d984d01dff	25000000	0	USD	2026-10-27 18:38:24.301	2026-10-27 18:38:24.301
27f650bb-2453-486e-885c-99f2effad3a9	7e6ad831-f03a-497a-b3ea-e09e0770f688	64994500	0	USD	2026-10-27 18:38:24.318	2026-10-27 19:22:03.225
36b9abff-ee10-4b61-b7ea-b502a990c1e5	8092c790-3e9d-4df6-b71b-922b6976b322	0	0	USD	2026-10-27 19:52:40.019	2026-10-27 19:52:40.019
b3efa830-b360-4048-af89-c28d87c5f7b4	4da3194e-0186-41d9-be5a-0654e769a28b	0	0	USD	2026-10-27 20:25:17.625	2026-10-27 20:25:17.625
29e8183f-e32c-4ba3-a81a-6ff7bb69ee93	3edd8c13-fe18-42bf-a7e3-b8c4497641b2	0	0	USD	2026-10-27 20:38:15.488	2026-10-27 20:38:15.488
0fcafe9e-e0c0-4bf8-a9eb-9feb35844c6d	578e1b62-a026-4688-bef3-8c33937bc0be	0	0	USD	2026-10-27 20:45:54.288	2026-10-27 20:45:54.288
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: tooltoll
--

COPY public.webhook_events (id, provider, "eventId", "eventType", "resourceType", payload, status, "processedAt", "createdAt") FROM stdin;
\.


--
-- Name: abuse_reports abuse_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.abuse_reports
    ADD CONSTRAINT abuse_reports_pkey PRIMARY KEY (id);


--
-- Name: admin_reviews admin_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT admin_reviews_pkey PRIMARY KEY (id);


--
-- Name: agent_credentials agent_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agent_credentials
    ADD CONSTRAINT agent_credentials_pkey PRIMARY KEY (id);


--
-- Name: agent_permissions agent_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agent_permissions
    ADD CONSTRAINT agent_permissions_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: creator_earnings creator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT creator_earnings_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: payout_requests payout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_pkey PRIMARY KEY (id);


--
-- Name: paypal_orders paypal_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.paypal_orders
    ADD CONSTRAINT paypal_orders_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: quality_reviews quality_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.quality_reviews
    ADD CONSTRAINT quality_reviews_pkey PRIMARY KEY (id);


--
-- Name: tool_calls tool_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_calls
    ADD CONSTRAINT tool_calls_pkey PRIMARY KEY (id);


--
-- Name: tool_test_runs tool_test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_test_runs
    ADD CONSTRAINT tool_test_runs_pkey PRIMARY KEY (id);


--
-- Name: tool_versions tool_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_versions
    ADD CONSTRAINT tool_versions_pkey PRIMARY KEY (id);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: topups topups_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.topups
    ADD CONSTRAINT topups_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallet_reservations wallet_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT wallet_reservations_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: abuse_reports_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "abuse_reports_toolId_idx" ON public.abuse_reports USING btree ("toolId");


--
-- Name: admin_reviews_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "admin_reviews_toolId_idx" ON public.admin_reviews USING btree ("toolId");


--
-- Name: agent_credentials_agentId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "agent_credentials_agentId_idx" ON public.agent_credentials USING btree ("agentId");


--
-- Name: agent_credentials_prefix_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX agent_credentials_prefix_idx ON public.agent_credentials USING btree (prefix);


--
-- Name: agent_credentials_tokenHash_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "agent_credentials_tokenHash_key" ON public.agent_credentials USING btree ("tokenHash");


--
-- Name: agent_permissions_agentId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "agent_permissions_agentId_idx" ON public.agent_permissions USING btree ("agentId");


--
-- Name: agent_permissions_agentId_toolId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "agent_permissions_agentId_toolId_key" ON public.agent_permissions USING btree ("agentId", "toolId");


--
-- Name: agents_userId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "agents_userId_idx" ON public.agents USING btree ("userId");


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: creator_earnings_creatorId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "creator_earnings_creatorId_idx" ON public.creator_earnings USING btree ("creatorId");


--
-- Name: creator_earnings_toolCallId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "creator_earnings_toolCallId_key" ON public.creator_earnings USING btree ("toolCallId");


--
-- Name: creator_earnings_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "creator_earnings_toolId_idx" ON public.creator_earnings USING btree ("toolId");


--
-- Name: ledger_entries_callId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "ledger_entries_callId_idx" ON public.ledger_entries USING btree ("callId");


--
-- Name: ledger_entries_referenceId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "ledger_entries_referenceId_idx" ON public.ledger_entries USING btree ("referenceId");


--
-- Name: ledger_entries_walletId_createdAt_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "ledger_entries_walletId_createdAt_idx" ON public.ledger_entries USING btree ("walletId", "createdAt");


--
-- Name: payout_requests_creatorId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "payout_requests_creatorId_idx" ON public.payout_requests USING btree ("creatorId");


--
-- Name: paypal_orders_orderId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "paypal_orders_orderId_idx" ON public.paypal_orders USING btree ("orderId");


--
-- Name: paypal_orders_orderId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "paypal_orders_orderId_key" ON public.paypal_orders USING btree ("orderId");


--
-- Name: paypal_orders_userId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "paypal_orders_userId_idx" ON public.paypal_orders USING btree ("userId");


--
-- Name: quality_reviews_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "quality_reviews_toolId_idx" ON public.quality_reviews USING btree ("toolId");


--
-- Name: tool_calls_agentId_createdAt_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "tool_calls_agentId_createdAt_idx" ON public.tool_calls USING btree ("agentId", "createdAt");


--
-- Name: tool_calls_agentId_idempotencyKey_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "tool_calls_agentId_idempotencyKey_key" ON public.tool_calls USING btree ("agentId", "idempotencyKey");


--
-- Name: tool_calls_toolId_status_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "tool_calls_toolId_status_idx" ON public.tool_calls USING btree ("toolId", status);


--
-- Name: tool_test_runs_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "tool_test_runs_toolId_idx" ON public.tool_test_runs USING btree ("toolId");


--
-- Name: tool_versions_toolId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "tool_versions_toolId_idx" ON public.tool_versions USING btree ("toolId");


--
-- Name: tool_versions_toolId_version_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "tool_versions_toolId_version_key" ON public.tool_versions USING btree ("toolId", version);


--
-- Name: tools_category_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX tools_category_idx ON public.tools USING btree (category);


--
-- Name: tools_creatorId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "tools_creatorId_idx" ON public.tools USING btree ("creatorId");


--
-- Name: tools_slug_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX tools_slug_key ON public.tools USING btree (slug);


--
-- Name: tools_status_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX tools_status_idx ON public.tools USING btree (status);


--
-- Name: topups_paypalOrderId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "topups_paypalOrderId_key" ON public.topups USING btree ("paypalOrderId");


--
-- Name: topups_walletId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "topups_walletId_idx" ON public.topups USING btree ("walletId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: wallet_reservations_callId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "wallet_reservations_callId_key" ON public.wallet_reservations USING btree ("callId");


--
-- Name: wallet_reservations_walletId_status_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "wallet_reservations_walletId_status_idx" ON public.wallet_reservations USING btree ("walletId", status);


--
-- Name: wallets_userId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "wallets_userId_key" ON public.wallets USING btree ("userId");


--
-- Name: webhook_events_eventId_idx; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE INDEX "webhook_events_eventId_idx" ON public.webhook_events USING btree ("eventId");


--
-- Name: webhook_events_eventId_key; Type: INDEX; Schema: public; Owner: tooltoll
--

CREATE UNIQUE INDEX "webhook_events_eventId_key" ON public.webhook_events USING btree ("eventId");


--
-- Name: abuse_reports abuse_reports_reporterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.abuse_reports
    ADD CONSTRAINT "abuse_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: abuse_reports abuse_reports_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.abuse_reports
    ADD CONSTRAINT "abuse_reports_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_reviews admin_reviews_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.admin_reviews
    ADD CONSTRAINT "admin_reviews_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agent_credentials agent_credentials_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agent_credentials
    ADD CONSTRAINT "agent_credentials_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agent_permissions agent_permissions_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agent_permissions
    ADD CONSTRAINT "agent_permissions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agents agents_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: creator_earnings creator_earnings_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT "creator_earnings_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: creator_earnings creator_earnings_toolCallId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.creator_earnings
    ADD CONSTRAINT "creator_earnings_toolCallId_fkey" FOREIGN KEY ("toolCallId") REFERENCES public.tool_calls(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public.wallets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payout_requests payout_requests_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "payout_requests_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quality_reviews quality_reviews_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.quality_reviews
    ADD CONSTRAINT "quality_reviews_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tool_calls tool_calls_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_calls
    ADD CONSTRAINT "tool_calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tool_calls tool_calls_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_calls
    ADD CONSTRAINT "tool_calls_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tool_test_runs tool_test_runs_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_test_runs
    ADD CONSTRAINT "tool_test_runs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tool_versions tool_versions_toolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tool_versions
    ADD CONSTRAINT "tool_versions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES public.tools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tools tools_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT "tools_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: topups topups_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.topups
    ADD CONSTRAINT "topups_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public.wallets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wallet_reservations wallet_reservations_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.wallet_reservations
    ADD CONSTRAINT "wallet_reservations_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public.wallets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wallets wallets_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tooltoll
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict q3HWRQ4yH3nFXBwIPvBb8DTTVWucWKaGnMvhX39ZqXWS2LOYQZaa9c8xfdfygJR

