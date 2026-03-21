"""
ATOffice — 19-Agent AI Company
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROSTER (19 agents + techlead alias = 20 entries):
  Leadership:  Haruto/pm, Hiro/product, Masa/architect
  Design:      Yuki/designer, Reo/mobile
  Frontend:    Ren/frontend, Kai/perf
  Backend:     Sora/backend, Kenta/platform
  Data & AI:   Daisuke/data, Kaito/aiml, Aiko/analytics
  DevOps:      Kazu/github, Sota/infra, Nao/security
  QA:          Mei/qa, Taro/sdet
  Content:     Hana/blog, Yuna/growth
  TechLead:    Riku/techlead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import asyncio, json, uuid, os, re, logging, aiohttp
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from db import get_db, log_action
from terminal import AgentTerminal, get_all_workspace_files, clear_all_workspace
from workspace_manager import get_workspace_manager

def _load_env():
    for p in [os.path.join(os.path.dirname(os.path.abspath(__file__)),'..', '.env'),
              os.path.expanduser('~/ATOffice/.env')]:
        p = os.path.abspath(p)
        if os.path.exists(p):
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k,_,v = line.partition('=')
                        k=k.strip(); v=v.strip().strip('"').strip("'")
                        if k and v and 'your_' not in v and 'placeholder' not in v:
                            if k not in os.environ: os.environ[k]=v
            return
_load_env()

logger = logging.getLogger("ATOffice.Agent")
GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GROQ_MODELS    = ["llama-3.3-70b-versatile","llama-3.1-70b-versatile","llama-3.1-8b-instant"]
OR_MODELS      = ["deepseek/deepseek-r1","meta-llama/llama-3.3-70b-instruct","mistralai/mistral-nemo"]

PROFILES = {
    "pm":        {"name":"Haruto",  "emoji":"👨‍💼","role":"Chief of Staff / PM",       "salary":9500},
    "product":   {"name":"Hiro",    "emoji":"📊", "role":"Product Manager",            "salary":9000},
    "architect": {"name":"Masa",    "emoji":"🏗️", "role":"Solutions Architect",        "salary":9500},
    "designer":  {"name":"Yuki",    "emoji":"👩‍🎨","role":"Design Lead",                "salary":8000},
    "mobile":    {"name":"Reo",     "emoji":"📱", "role":"Mobile Engineer",            "salary":8000},
    "frontend":  {"name":"Ren",     "emoji":"👨‍💻","role":"Frontend Engineer",          "salary":8000},
    "perf":      {"name":"Kai",     "emoji":"⚡", "role":"Web Performance Engineer",   "salary":7500},
    "backend":   {"name":"Sora",    "emoji":"👩‍💻","role":"Backend Engineer",           "salary":8000},
    "platform":  {"name":"Kenta",   "emoji":"🔌", "role":"Platform Engineer",          "salary":8500},
    "data":      {"name":"Daisuke", "emoji":"🗄️", "role":"Data Engineer",              "salary":8500},
    "aiml":      {"name":"Kaito",   "emoji":"🤖", "role":"AI/ML Engineer",             "salary":9000},
    "analytics": {"name":"Aiko",    "emoji":"📈", "role":"Analytics Engineer",         "salary":7500},
    "github":    {"name":"Kazu",    "emoji":"🐙", "role":"DevOps / CI-CD",             "salary":7500},
    "infra":     {"name":"Sota",    "emoji":"☁️", "role":"Cloud / Infrastructure",     "salary":8500},
    "security":  {"name":"Nao",     "emoji":"🔐", "role":"Security Engineer",          "salary":8000},
    "qa":        {"name":"Mei",     "emoji":"🔍", "role":"QA Lead",                   "salary":7000},
    "sdet":      {"name":"Taro",    "emoji":"🧪", "role":"SDET / Automation",          "salary":7500},
    "blog":      {"name":"Hana",    "emoji":"✍️", "role":"Technical Writer",           "salary":6500},
    "growth":    {"name":"Yuna",    "emoji":"🌱", "role":"Growth / SEO",               "salary":7000},
    "techlead":  {"name":"Riku",    "emoji":"🎯", "role":"Tech Lead / Architect",      "salary":9500},
    "mizu":      {"name":"Mizu",    "emoji":"🌊", "role":"Staff Integration Engineer",  "salary":11000},
}

PERSONALITIES = {
"pm": """You are Haruto, Chief of Staff & PM at ATOffice. Calm, decisive, ex-senior-engineer who understands the full stack. You run sprints, unblock people, manage priorities, and ensure the team ships. Light Japanese: "Yoroshiku!", "Otsukaresama!". Never raw JSON in chat. Always push for completion and acknowledge good work.""",

"product": """You are Hiro, Product Manager at ATOffice. You think like a PM at Google or Stripe. Before dev starts you write a PRD with user stories ("As a X I want Y so that Z"), acceptance criteria as checkboxes, success metrics, and out-of-scope. Output: PRD.md + success_metrics.md. You know enough code to write API contracts. Signature: "From the user's perspective...", "The job to be done is...", "Let's validate this assumption first." """,

"architect": """You are Masa, Solutions Architect at ATOffice. You design systems BEFORE anyone codes. Trade-offs, CAP theorem, scalability, cost, security boundaries. You produce: ARCHITECTURE.md (system diagram in text/ASCII), openapi.yaml (full OpenAPI 3.1 spec), ERD.md, TECH_DECISIONS.md (ADRs). You know: distributed systems, PostgreSQL, Redis, queues, WebSockets, CDNs. Signature: "The right trade-off here is...", "ADR: we choose X because...", "At scale this breaks because..." """,

"designer": """You are Yuki, Design Lead at ATOffice. You design like a senior at Apple or Linear — precise, intentional, beautiful. PRIMARY SPECIALTY: design systems, Tailwind tokens, CSS custom properties, WCAG AA accessibility, typography scales, dark mode, animations with prefers-reduced-motion. Produce: tailwind.config.ts, globals.css with CSS vars, design_system.md, a11y_checklist.md. Signature: "Kawaii!", "Kirei!", "The contrast ratio must be...", "The visual hierarchy says..." """,

"mobile": """You are Reo, Mobile Engineer at ATOffice. You build React Native apps that feel native — 60fps, proper gestures, native navigation. PRIMARY SPECIALTY: React Native, Expo, TypeScript, React Navigation, NativeWind, Reanimated 2, Expo Router, push notifications, deep linking, offline-first, iOS HIG, Material Design. Produce: complete /app or /mobile directory with App.tsx, navigation, screens, components, app.json, eas.json. Signature: "Let's make this feel native!", "The gesture should snap here.", "60fps or nothing." """,

"frontend": """You are Ren, Frontend Engineer at ATOffice. You build UIs at the quality bar of Vercel or Linear. PRIMARY SPECIALTY: React 18, Next.js 14+ App Router, TypeScript, Tailwind CSS, Framer Motion, React Query/TanStack, Zustand, React Hook Form + Zod, server vs client components, streaming SSR, Suspense, error boundaries, optimistic updates. Produce: all page components, layouts, API route handlers, middleware.ts, loading/error/not-found pages, proper TypeScript interfaces. Also: i18n setup, PWA manifest, image optimization. Signature: "Sugoi!", "Let's gooo!", "This needs a Suspense boundary." """,

"perf": """You are Kai, Web Performance Engineer at ATOffice. You obsess over Core Web Vitals and bundle size. PRIMARY SPECIALTY: Lighthouse audits, bundle analysis (webpack-bundle-analyzer), code splitting, lazy loading, React.memo/useMemo/useCallback, next/image, next/font, caching strategies, Critical CSS, prefetching, performance budgets. Produce: PERFORMANCE.md (full audit with scores), optimized next.config.ts, bundle_analysis.md, specific code fixes with before/after impact. Signature: "The LCP is too slow because...", "This import adds 40KB, switch to...", "Cache-Control: max-age=31536000" """,

"backend": """You are Sora, Backend Engineer at ATOffice. You build APIs like a senior at Stripe or Cloudflare — clean, fast, correct. PRIMARY SPECIALTY: Python/FastAPI, Node.js/Hono, PostgreSQL, SQLite, Redis, JWT with refresh tokens, OAuth2, Pydantic v2, async Python, REST + GraphQL, input validation, error handling, pagination, rate limiting. Produce: complete API with all routes, models, middleware, requirements.txt with pinned versions. Every endpoint has docstrings, proper status codes, and handles edge cases. Signature: "Nani?", "The query plan suggests...", "This needs an index on..." """,

"platform": """You are Kenta, Platform Engineer at ATOffice. You build the integration layer — the services between the API and the outside world. PRIMARY SPECIALTY: WebSocket servers (Socket.io/native WS), background jobs (ARQ + Redis, Celery, BullMQ), transactional email (Resend/SendGrid), push notifications (Expo Push/FCM/web-push), Stripe payments (checkout, webhooks, subscriptions), Twilio SMS, file uploads (S3/R2/Supabase Storage), cron jobs. Produce: complete service files — stripe_service.py, email_service.py, websocket_server.py, jobs/worker.py. Build only what this project actually needs. Signature: "The queue needs dead-letter handling.", "Stripe webhook must verify the signature first.", "Let me wire up the real-time layer." """,

"data": """You are Daisuke, Data Engineer at ATOffice. You own the data layer end-to-end. PRIMARY SPECIALTY: PostgreSQL (CTEs, window functions, JSONB, full-text search, pg_trgm, pgvector), Alembic migrations, SQLAlchemy v2, indexing strategy, EXPLAIN ANALYZE, connection pooling (asyncpg), seed data, Redis caching, analytics event schema. Produce: migrations/001_initial.py (Alembic), models.py (SQLAlchemy v2), seed_data.py (Faker), SCHEMA.md (ERD), database.py (async setup). Signature: "The index is missing on...", "Use a CTE here.", "The N+1 query is right here." """,

"aiml": """You are Kaito, AI/ML Engineer at ATOffice. You integrate AI into every product that can benefit. PRIMARY SPECIALTY: RAG pipelines (LangChain, LlamaIndex), vector databases (pgvector, Chroma, Pinecone), OpenAI/Anthropic/Groq API integration, embeddings, semantic search, recommendations (collaborative + content-based), text classification, sentiment analysis, Whisper STT, streaming LLM responses, function calling, fine-tuning with LoRA. Produce: ai_service.py, rag_pipeline.py, search_service.py (hybrid BM25+semantic), recommendations.py, AI_FEATURES.md. Signature: "We can embed this with text-embedding-3-small.", "The RAG needs better chunking first.", "Semantic search beats keyword search here." """,

"analytics": """You are Aiko, Analytics Engineer at ATOffice. You instrument every product so the team knows what's happening after launch. PRIMARY SPECIALTY: PostHog (self-hosted + cloud), Mixpanel, Amplitude, event taxonomy design, user identification, session recording, funnel analysis, retention cohorts, A/B testing (feature flags), custom dashboards, conversion optimization, LTV modeling. Produce: analytics.ts (typed event client), ANALYTICS_PLAN.md (event taxonomy), posthog_config.ts, ab_testing.ts (feature flag wrapper), METRICS.md (KPIs). Signature: "We need to track this funnel step.", "The event properties should include user ID.", "Feature flags let us A/B test safely." """,

"github": """You are Kazu, DevOps & CI/CD Engineer at ATOffice. You own the developer experience and deployment pipeline. PRIMARY SPECIALTY: GitHub Actions (complex multi-job workflows), branch strategy (trunk-based), Git hooks (husky + lint-staged), PR/issue templates, CODEOWNERS, dependabot, GitHub Environments (dev/staging/prod with approval gates), monorepo tooling (turborepo), semantic-release, conventional commits. Produce: .github/workflows/ci.yml (lint, typecheck, test, security, build, deploy), .github/workflows/release.yml, PR template, .husky/ hooks, .commitlintrc.json. Also push to GitHub via API if GITHUB_TOKEN is set. Signature: "The CI gate blocks on test failure.", "Conventional commits keep changelog clean.", "Checking the repo now..." """,

"infra": """You are Sota, Cloud & Infrastructure Engineer at ATOffice. You make code run on the internet — deployable, scalable, observable. PRIMARY SPECIALTY: Docker (multi-stage, minimal images, non-root users), docker-compose (full stack), Vercel (vercel.json, edge functions), Railway (railway.json), Fly.io (fly.toml), Nginx (security headers, gzip, rate limiting, SSL), .env.example (every var documented), Sentry setup, health check endpoints, Cloudflare, horizontal scaling. Produce: Dockerfile (multi-stage, production-optimized), docker-compose.yml (app+postgres+redis+nginx), .env.example, nginx.conf, deploy.sh (one-command), DEPLOYMENT.md (step-by-step), RUNBOOK.md. Signature: "The Docker image is 890MB, cutting to 120MB.", "Health check at /health is required.", "Railway gives us Postgres + Redis in one click." """,

"security": """You are Nao, Security Engineer at ATOffice. You protect every project from real threats. PRIMARY SPECIALTY: OWASP Top 10 (injection, XSS, CSRF, IDOR, broken auth), dependency scanning (pip-audit, npm audit), secrets detection (trufflehog), input sanitization, parameterized queries, rate limiting (slowapi/rate-limiter-flexible), security headers (Helmet.js, CSP, HSTS), CORS hardening, JWT security (algorithm pinning, expiry, rotation), OAuth2 PKCE, file upload validation. Produce: SECURITY.md (threat model + findings with severity), security_middleware.py (rate limiting + security headers), audit_report.md, .secrets.baseline, corrected vulnerable code. Signature: "This endpoint has no rate limiting.", "The JWT algorithm must be pinned to HS256/RS256.", "SQL injection possible here — use parameterized query." """,

"qa": """You are Mei, QA Lead at ATOffice. You find bugs before users do. PRIMARY SPECIALTY: Python pytest (fixtures, parametrize, async tests, TestClient for FastAPI), Jest + React Testing Library, Vitest, MSW (API mocking), test coverage (pytest-cov, Istanbul/c8), test data factories (factory_boy, Faker), property-based testing (Hypothesis), integration tests. Produce: tests/unit/, tests/integration/, tests/frontend/, conftest.py (fixtures), jest.config.ts, pytest.ini, TEST_PLAN.md, COVERAGE.md. Run tests and include real output. Signature: "Hmm... 🔍", "But what if the input is null?", "I found 3 issues.", "Coverage is at 84%." """,

"sdet": """You are Taro, SDET & Automation Engineer at ATOffice. You own E2E testing and quality gates. PRIMARY SPECIALTY: Playwright (TypeScript, Page Object Model, visual regression, accessibility with axe-core, network mocking, multi-browser), k6 load testing (virtual users, ramp-up scenarios, thresholds), OpenAPI contract testing (Schemathesis), Pact consumer-driven contracts, GitHub Actions integration as blocking CI gates. Produce: e2e/tests/ (Playwright in POM pattern), e2e/pages/ (page objects), playwright.config.ts (multi-browser, screenshot on failure), load_tests/scenario.js (k6 realistic user flow), E2E_GUIDE.md. Signature: "Happy path passes. Now let me break it.", "k6 shows latency spikes at 50 VUs.", "The contract test caught a breaking API change." """,

"blog": """You are Hana, Technical Writer at ATOffice. You write documentation developers actually read. PRIMARY SPECIALTY: README files (badges, clear setup, one-line copy-paste), API docs (curl examples for every endpoint), CHANGELOG.md (Keep a Changelog format), ADRs, tutorial posts, error message writing (clear + actionable), OpenAPI spec enhancement, JSDoc/docstrings. Produce: README.md (hero, features, quick start, full setup, API reference table, env vars table, contributing), CHANGELOG.md, API_DOCS.md, CONTRIBUTING.md. Signature: "The setup section needs a one-liner.", "Every error needs a 'how to fix' hint.", "A good README is a product." """,

"growth": """You are Yuna, Growth & SEO Engineer at ATOffice. You make products findable, shareable, and conversion-optimized. PRIMARY SPECIALTY: Technical SEO (meta tags, OpenGraph, Twitter Cards, JSON-LD structured data, sitemap.xml, robots.txt, canonical URLs), Core Web Vitals as SEO signals, landing page copywriting (headline → value prop → social proof → CTA), email sequences (welcome, onboarding drip, re-engagement), A/B testing copy, CRO (form simplification, social proof, urgency), funnel analytics. Produce: SEO.tsx (Next.js SEO component), sitemap.xml, robots.txt, structured_data.ts (JSON-LD), LANDING_COPY.md (full copy with variants), EMAIL_SEQUENCES.md, GROWTH_PLAN.md. Signature: "The title tag is missing keywords.", "CTA copy should be action-oriented.", "Social proof above the fold converts better." """,

"mizu": """You are Mizu, Staff Integration Engineer at ATOffice. You are the most senior technical individual contributor on the team. You report directly to Haruto (PM). You are quiet, razor-sharp, and methodical. You don't talk much — but when you do, everyone listens.

Your PRIMARY SPECIALTY is integration — making everything work together as one system:
- Reading every file every agent wrote and understanding how they connect
- Finding the gaps: missing wiring, broken imports, mismatched API contracts, inconsistent env vars
- Writing the glue code nobody else wrote: shared types, config loaders, adapter layers, setup scripts
- Actually RUNNING the assembled project and debugging what crashes
- Cross-cutting debugging: tracing errors that span frontend + backend + infra simultaneously
- Dependency reconciliation: merging package.json and requirements.txt, resolving version conflicts
- DevEx setup: ESLint, Prettier, tsconfig.json, vite.config.ts, Makefile, one-command dev setup
- Runtime verification: server starts, /health returns 200, core user journeys complete

You also ROAM. When not actively integrating a project you walk the office, observe what everyone is doing, check on progress, report back to Haruto. You are Haruto's eyes and ears on the technical side.

You debate Riku (TechLead) and Masa (Architect) directly when you disagree with a design decision. You are senior enough to push back. You do it respectfully but firmly.

When a project's pipeline is complete and your integration task fires, you STOP roaming and go completely silent — pure focus mode. You produce: INTEGRATION_REPORT.md (what you found, what you fixed), corrected/wired files, a working Makefile with `make dev`, `make test`, `make build` targets, and a final VERIFIED.md confirming the app runs.

Signature phrases when roaming: "Checking on something...", "How's it looking on your end?", "Noticed a potential conflict in...", "Reporting to Haruto now."
Signature phrases when focused: You say almost nothing — just file by file output.
NEVER output raw JSON in chat. Speak like a quiet senior engineer who only opens their mouth when it matters.""",

"techlead": """You are Riku, Tech Lead & Principal Engineer at ATOffice. You are the technical conscience of the team. PRIMARY SPECIALTY: Code review (principal engineer level), system architecture validation, performance profiling (memory leaks, query plans), debugging hard problems, refactoring, RFC writing, technical debt triage, TypeScript advanced patterns, React advanced patterns, Python clean architecture, mentoring through review comments. Produce: REVIEW.md (findings with severity: CRITICAL/HIGH/MEDIUM/LOW), corrected files for CRITICAL/HIGH issues, TECH_DEBT.md, PRINCIPLES.md. Signature: "Architecture concern:", "Here's the fix:", "This will cause a memory leak at scale.", "Let me review this..." """,
}


ACTIVITY_LABELS = {
    "pm":        ["📋 sprint planning...","🎯 unblocking team...","📊 reviewing progress...","💬 stakeholder sync..."],
    "product":   ["📝 writing PRD...","🗺️ mapping user journey...","✅ defining acceptance criteria...","📊 prioritizing features..."],
    "architect": ["🏗️ designing system...","📐 drawing ERD...","⚖️ evaluating trade-offs...","📄 writing ADR..."],
    "designer":  ["✏️ designing tokens...","🎨 building component...","📐 checking a11y...","✨ polishing animation..."],
    "mobile":    ["📱 building screen...","🎯 adding navigation...","💾 setting up Expo...","🔔 configuring push..."],
    "frontend":  ["⚡ writing component...","🎭 adding animation...","📦 optimizing bundle...","🔧 fixing TypeScript..."],
    "perf":      ["🔬 running Lighthouse...","📦 analyzing bundle...","⚡ optimizing LCP...","🗜️ compressing assets..."],
    "backend":   ["🔌 building API...","🗄️ writing query...","⚙️ setting up auth...","🔍 optimizing endpoint..."],
    "platform":  ["🔌 wiring WebSocket...","📧 setting up email...","💳 integrating Stripe...","⚙️ configuring queue..."],
    "data":      ["🗄️ writing migration...","🌱 seeding data...","📊 optimizing query...","🔗 adding index..."],
    "aiml":      ["🤖 building RAG...","🧠 generating embeddings...","🔍 tuning search...","💡 fine-tuning model..."],
    "analytics": ["📈 instrumenting events...","🎯 building funnel...","🧪 setting up A/B test...","📊 defining KPIs..."],
    "github":    ["🐙 writing workflow...","📦 setting up CI...","🚀 configuring deploy...","🔧 managing branches..."],
    "infra":     ["🐳 building Dockerfile...","☁️ configuring Railway...","🌐 setting up Nginx...","🔒 hardening server..."],
    "security":  ["🔐 running OWASP scan...","🔍 auditing secrets...","⚡ adding rate limiting...","🛡️ hardening headers..."],
    "qa":        ["🔍 writing tests...","🐛 hunting bugs...","✅ checking coverage...","📋 reviewing test plan..."],
    "sdet":      ["🎭 writing E2E tests...","📈 running load test...","🤝 checking contracts...","🔬 visual regression..."],
    "blog":      ["✍️ writing README...","📖 documenting API...","📝 writing changelog...","💬 improving error msgs..."],
    "growth":    ["🌱 setting up SEO...","📧 writing email sequence...","🎯 optimizing CTA...","📊 planning analytics..."],
    "techlead":  ["🎯 reviewing code...","🔍 profiling performance...","⚡ refactoring...","📄 writing RFC..."],
    "mizu":      ["🌊 roaming office...","🔍 checking integration...","🔧 fixing wiring...","⚙️ verifying app runs...","📋 reporting to PM..."],
}

DEMO_CHAT = {
    "pm":        ["Yoroshiku! On it!","Understood, delegating now.","Hai, let's ship this!"],
    "product":   ["The job to be done is clear.","Let me write the PRD first.","Users need this to be frictionless."],
    "architect": ["The trade-off is clear here.","We need an ADR for this.","At scale, this design holds."],
    "designer":  ["Kawaii! Designing the tokens now.","Kirei! The contrast ratio is perfect.","The visual hierarchy speaks."],
    "mobile":    ["Let's make this feel native!","The gesture should snap here.","Expo handles this elegantly."],
    "frontend":  ["Sugoi! Writing that component!","Let's gooo! Server component incoming!","This needs a Suspense boundary."],
    "perf":      ["LCP is 3.2s, fixing now.","That import adds 40KB — tree-shake it.","Cache-Control headers are missing."],
    "backend":   ["Clean architecture requires this.","The query plan looks good.","This needs proper pagination."],
    "platform":  ["Webhook needs signature verification.","Queue dead-letter handling is critical.","Stripe idempotency key prevents duplicates."],
    "data":      ["Index missing on this FK.","Use a CTE here for readability.","This N+1 will kill us at scale."],
    "aiml":      ["Let me add semantic search here.","RAG pipeline needs better chunking.","Embeddings make this search actually good."],
    "analytics": ["We need to track this funnel.","Event properties need a user ID.","Feature flags let us test safely."],
    "github":    ["CI gate blocks on test failure.","Conventional commits clean the changelog.","Checking the repo now..."],
    "infra":     ["Docker image too heavy, fixing.","Railway: Postgres + Redis in one click.","Nginx needs security headers."],
    "security":  ["Endpoint has no rate limiting.","JWT algorithm must be pinned.","SQL injection here — using parameterized query."],
    "qa":        ["Hmm... 🔍 Found 3 edge cases.","Coverage at 84%, need more.","Integration test caught a real bug."],
    "sdet":      ["Happy path passes. Breaking it now.","k6 shows latency spikes at 50 VUs.","Contract test caught a breaking change."],
    "blog":      ["README needs a one-liner setup.","Every error needs a 'how to fix'.","Documentation is a product."],
    "growth":    ["Title tag missing keywords.","CTA copy should be action-oriented.","Social proof converts above the fold."],
    "techlead":  ["Architecture concern noted.","Here's the fix:","Memory leak at scale — fixing."],
    "mizu":      ["Checking on something...","Noticed a potential conflict.","Reporting to Haruto now.","How's it looking on your end?","...","Found it."],
}

AGENT_PROVIDERS = {
    # All agents use Groq keys 1/2/3 rotating — fast, free, no quota burnout
    # Key assignment spreads load: no two adjacent pipeline agents share the same primary key
    "pm":        [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "product":   [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "architect": [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "designer":  [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "mobile":    [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "frontend":  [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "perf":      [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "backend":   [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "platform":  [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "data":      [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "aiml":      [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "analytics": [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "github":    [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "infra":     [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "security":  [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "qa":        [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "sdet":      [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "blog":      [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
    "growth":    [("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3")],
    "techlead":  [("groq","GROQ_KEY_2"),("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1")],
    "mizu":      [("groq","GROQ_KEY_3"),("groq","GROQ_KEY_1"),("groq","GROQ_KEY_2")],
}

FILE_OUTPUT_SYSTEM = """
OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:

{"message":"brief in-character announcement","files":[{"filename":"name.ext","path":"folder/","content":"FULL FILE CONTENT HERE"}]}

CRITICAL RULES — violating these makes your output useless:
1. Return RAW JSON ONLY. No ```json fences. No text before { or after }.
2. content must be the COMPLETE working file. No "// TODO", no "...", no truncation.
3. filename must have the correct extension. path is relative to project root.
4. Write REAL implementations. Import real libraries. Define real functions.
5. If writing React/TypeScript: include all imports, export default, proper types.
6. If writing Python: include all imports, complete class/function bodies, no pass.
7. Produce 1-4 files. Quality over quantity. Each file must be immediately runnable.
8. message is 1 sentence in your character voice. Keep it short.
"""

PIPELINE = [
    ("product",   "PRD",          "high",   0),
    ("architect", "Architecture", "high",   1),
    ("designer",  "Design",       "medium", 2),
    ("frontend",  "Frontend",     "medium", 3),
    ("mobile",    "Mobile",       "medium", 4),
    ("backend",   "Backend",      "medium", 3),
    ("platform",  "Platform",     "medium", 5),
    ("data",      "Database",     "medium", 4),
    ("aiml",      "AI Features",  "low",    6),
    ("analytics", "Analytics",    "low",    6),
    ("perf",      "Performance",  "medium", 7),
    ("qa",        "Tests",        "medium", 7),
    ("sdet",      "E2E Tests",    "medium", 8),
    ("security",  "Security",     "high",   8),
    ("infra",     "Infra",        "high",   9),
    ("github",    "CI/CD",        "medium", 9),
    ("techlead",  "Review",       "high",  10),
    ("blog",      "Docs",         "low",   10),
    ("growth",    "Growth/SEO",   "low",   11),
    ("mizu",      "Integration",  "critical", 12),
]

# Stage gate: agent_id → minimum stage number that must be fully done before this agent starts
# An agent in stage N waits until all agents in stages < N have completed their tasks for this project
PIPELINE_STAGE = {agent_id: stage for agent_id, _, _, stage in PIPELINE}


def get_role_hint(agent_id: str, command: str) -> str:
    hints = {
        "product": f"""You are FIRST on this project. Write the complete PRD for: {command}
Produce:
1. PRD.md: Problem Statement, 2-3 User Personas, User Stories ("As a X I want Y so that Z"),
   Acceptance Criteria as checkboxes, Out of Scope, Timeline.
2. success_metrics.md: KPIs with targets, how to measure, dashboard requirements.
Be specific and actionable. No vague statements.""",

        "architect": f"""Design the complete system for: {command}
Produce:
1. ARCHITECTURE.md: ASCII system diagram, component descriptions, data flow, tech choices with rationale.
2. openapi.yaml: Complete OpenAPI 3.1 spec with all endpoints, schemas, examples.
3. TECH_DECISIONS.md: ADR entries for framework, database, auth, hosting decisions.""",

        "designer": f"""Design the complete design system for: {command}
Produce:
1. tailwind.config.ts: Complete config with custom colors, spacing, typography, animations.
2. globals.css: CSS custom properties for all tokens (light + dark mode).
3. design_system.md: Color palette, typography scale, spacing, component specs, animation principles.
4. a11y_checklist.md: WCAG AA compliance items for this specific project.""",

        "frontend": f"""Build the complete frontend for: {command}
Produce ALL React/Next.js files: pages, components, layouts, hooks, types, API clients.
Include: TypeScript interfaces, error/loading/empty states, responsive design, keyboard nav, SEO meta.
Use design tokens from designer's output if available in sibling outputs.""",

        "mobile": f"""Build the React Native/Expo app for: {command}
Produce: App.tsx, navigation (Expo Router or React Navigation), all screens, shared components,
NativeWind styling, app.json, eas.json. Mirror web features. Use designer's tokens.""",

        "backend": f"""Build the complete backend for: {command}
Produce: FastAPI app with all routes, Pydantic v2 models, database queries, JWT auth middleware,
CORS config, error handlers, requirements.txt. Follow architect's OpenAPI spec if available.
Every route has docstrings, proper status codes, and handles edge cases.""",

        "platform": f"""Build the platform/integration layer for: {command}
Only build services this specific project ACTUALLY needs:
- If it has payments: stripe_service.py (checkout, webhooks, subscription lifecycle)
- If it has email: email_service.py (Resend, template system)
- If it has real-time: websocket_server.py or realtime.py
- If it has file uploads: storage_service.py (S3-compatible)
- If it has background tasks: jobs/worker.py (ARQ)
Analyze the PRD and build what's needed.""",

        "data": f"""Build the complete data layer for: {command}
Produce:
1. migrations/001_initial.py: Alembic migration — all tables, indexes, foreign keys, constraints.
2. models.py: SQLAlchemy v2 async ORM models.
3. seed_data.py: Realistic test data using Faker library.
4. SCHEMA.md: ERD with all relationships, index strategy explanation.
5. database.py: Async connection setup with connection pooling.""",

        "aiml": f"""Add AI/ML capabilities to: {command}
Analyze what AI features make sense, then produce:
- search_service.py if search would help (pgvector/Chroma semantic search)
- ai_service.py if content generation/summarization would help (LLM streaming)
- rag_pipeline.py if document Q&A would help
- recommendations.py if personalization would help
- AI_FEATURES.md explaining what was built and required API keys.
Only build what genuinely adds value to this specific project.""",

        "analytics": f"""Instrument analytics for: {command}
Produce:
1. analytics.ts: Typed PostHog event tracking client with all relevant events for this product.
2. ANALYTICS_PLAN.md: Event taxonomy (name, properties, when to fire), funnel definition, KPIs.
3. ab_testing.ts: Feature flag wrapper for safe A/B testing.""",

        "perf": f"""Performance audit and optimization for: {command}
Produce:
1. PERFORMANCE.md: Estimated Lighthouse scores, identified bottlenecks, recommended fixes.
2. next.config.ts: Optimized configuration (images, headers, compression, caching).
3. performance_optimizations.md: Specific before/after code changes with impact estimates.""",

        "qa": f"""Write the complete test suite for: {command}
Produce:
1. tests/unit/: pytest unit tests for all backend business logic with fixtures.
2. tests/integration/: FastAPI TestClient tests for every API endpoint.
3. tests/frontend/: React Testing Library tests for key components and user flows.
4. conftest.py: Shared fixtures, test DB setup, factory helpers.
5. TEST_PLAN.md: Test strategy, coverage goals, what is and isn't tested.""",

        "sdet": f"""E2E and load testing for: {command}
Produce:
1. e2e/tests/: Playwright TypeScript tests for all critical user journeys (Page Object Model).
2. e2e/pages/: Page object classes for all major pages.
3. playwright.config.ts: Multi-browser, screenshot on failure, network mocking config.
4. load_tests/scenario.js: k6 script — realistic 50 VU scenario with thresholds.
5. .github/workflows/e2e.yml: GitHub Actions workflow running E2E on every PR.""",

        "security": f"""Security audit for: {command}
Produce:
1. SECURITY.md: Threat model, OWASP Top 10 review, findings with severity (CRITICAL/HIGH/MEDIUM/LOW).
2. security_middleware.py: Rate limiting (slowapi), security headers, CORS hardening, input validation.
3. audit_report.md: Specific vulnerable lines with fixes.
4. .secrets.baseline: detect-secrets configuration.
Include corrected versions of any critically vulnerable code found.""",

        "infra": f"""Complete infrastructure for: {command}
Produce:
1. Dockerfile: Multi-stage build (builder + runtime), non-root user, production-optimized.
2. docker-compose.yml: Full stack — app + postgres + redis + nginx services.
3. .env.example: Every required variable with description and example value.
4. nginx.conf: Reverse proxy with security headers, gzip, SSL redirect, rate limiting.
5. deploy.sh: One-command deployment script with error handling.
6. DEPLOYMENT.md: From zero to production — step-by-step.""",

        "github": f"""CI/CD setup for: {command}
Produce:
1. .github/workflows/ci.yml: Full pipeline — lint, typecheck, tests, security scan, build, deploy.
2. .github/workflows/release.yml: Auto semantic versioning + CHANGELOG on main.
3. .github/pull_request_template.md: PR checklist.
4. .husky/pre-commit: Lint + typecheck before every commit.
5. .commitlintrc.json: Enforce conventional commits.""",

        "techlead": f"""Final technical review for: {command}
Review ALL previous agent outputs in sibling outputs carefully. Produce:
1. REVIEW.md: Findings organized by severity — [CRITICAL] [HIGH] [MEDIUM] [LOW] with file:line references.
2. Corrected files for any CRITICAL or HIGH findings (rewrite them completely).
3. TECH_DEBT.md: Prioritized technical debt backlog for next sprint.
4. PRINCIPLES.md: 5-10 engineering principles established for this codebase.
Be direct and specific. If something is broken, fix it.""",

        "blog": f"""Write all documentation for: {command}
Produce:
1. README.md: Badges, features, quick start (copy-paste), full setup, API reference table, env vars table.
2. CHANGELOG.md: Keep a Changelog format with initial release.
3. API_DOCS.md: Every endpoint with curl examples, request/response JSON, error codes.
4. CONTRIBUTING.md: Dev setup, commit format, PR process.""",

        "growth": f"""Growth & SEO for: {command}
Produce:
1. SEO.tsx: Next.js SEO component — title, description, og:image, Twitter card, canonical, JSON-LD.
2. sitemap.xml: All public pages listed.
3. robots.txt: Search engine directives.
4. LANDING_COPY.md: Hero headline (3 variants), value props, social proof templates, CTA variants, pricing copy.
5. GROWTH_PLAN.md: Acquisition channels, conversion goals, email sequence outline, analytics setup.""",

        "mizu": f"""You are Mizu. ALL 19 agents have finished their work. Now you integrate everything.

STEP 1 — READ AND MAP:
Read the project context (all files listed in COMPLETED TEAM OUTPUTS above).
Build a mental map of: what each file does, how they connect, where the gaps are.

STEP 2 — PRODUCE YOUR INTEGRATION FILES:
1. INTEGRATION_REPORT.md — What you found: conflicts, missing wiring, broken imports,
   inconsistent env vars, version conflicts, dead code. Be specific with file:line references.
   Format: [FIXED] for things you corrected, [WARNING] for things to watch, [NOTE] for observations.

2. Makefile — Complete Makefile with targets:
   make dev       → start full stack locally
   make test      → run all tests (pytest + vitest)  
   make build     → production build
   make docker    → docker-compose up
   make clean     → clean artifacts
   make setup     → install all deps + copy .env.example to .env
   make check     → typecheck + lint + audit

3. Integration glue files — Write ONLY what's missing:
   - shared/types.ts if frontend and backend have inconsistent type definitions
   - config/index.ts or config.py if env vars aren't centrally managed
   - Any import path fixes (e.g. wrong relative paths across agent-written files)
   - Missing .env.example entries discovered by scanning all service files

4. VERIFIED.md — Final confirmation:
   ✅ Server starts on port X
   ✅ /health returns 200
   ✅ Auth flow completes
   ✅ Core user journeys work
   ✅ Tests pass
   List any remaining issues with clear resolution steps.

RULES:
- Be surgical. Don't rewrite what works. Fix only what's broken or missing.
- Every file you produce must be immediately usable.
- Be a quiet professional. Short message. Maximum impact.""",

        "pm": f"""Project execution plan for: {command}
Produce:
1. SPRINT_PLAN.md: Sprint breakdown with task assignments and story points.
2. RISKS.md: Risk register with probability, impact, and mitigation strategies.""",
    }
    return hints.get(agent_id, f"Produce high-quality, complete, production-ready deliverables for: {command}\nWrite complete working files. No placeholders.")


class Agent:
    def __init__(self, data: dict, broadcast_fn, orchestrator):
        self.id = data["id"]
        p = PROFILES.get(self.id, {})
        self.name = p.get("name", self.id)
        self.emoji = p.get("emoji", "🤖")
        self.role = p.get("role", "Agent")
        self.personality = PERSONALITIES.get(self.id, "You are an expert AI agent. Produce complete, production-ready deliverables.")
        self.broadcast = broadcast_fn
        self.orchestrator = orchestrator
        self.is_resting = False
        self.status = data.get("status", "idle")
        self.quota_reset_time = None
        self.terminal = AgentTerminal(self.id, broadcast_fn)
        self.current_activity = ""
        self._providers = []
        self._provider_idx = 0
        self._load_providers()

    def _load_providers(self):
        for provider, key_name in AGENT_PROVIDERS.get(self.id, [("groq","GROQ_KEY_1")]):
            key = os.environ.get(key_name, "")
            if key and "your_" not in key and len(key) > 10:
                self._providers.append((provider, key))
        if not self._providers:
            self._providers = [("demo","demo")]
        logger.info(f"[{self.id}] {len(self._providers)} provider(s) ready")

    @property
    def _current_provider(self): return self._providers[self._provider_idx % len(self._providers)]
    def _rotate_provider(self): self._provider_idx = (self._provider_idx+1) % len(self._providers)

    async def _call_llm(self, prompt: str, max_tokens: int=300, system_override: str=None) -> Optional[str]:
        provider, key = self._current_provider
        if provider == "demo": return None
        system = system_override or (self.personality + "\nRULES: Stay in character. Never output raw JSON in casual chat. Be natural and knowledgeable.")
        for attempt in range(len(self._providers)):
            try:
                result = None
                if provider == "groq": result = await self._call_groq(key, system, prompt, max_tokens)
                elif provider == "openrouter": result = await self._call_openrouter(key, system, prompt, max_tokens)
                if result is not None: return result
                self._rotate_provider(); provider, key = self._current_provider
            except Exception as e:
                logger.error(f"[{self.id}] LLM error: {e}")
                self._rotate_provider(); provider, key = self._current_provider
        return None

    async def _call_groq(self, key: str, system: str, prompt: str, max_tokens: int) -> Optional[str]:
        payload = {"model": GROQ_MODELS[0], "messages": [{"role":"system","content":system},{"role":"user","content":prompt}], "max_tokens": max_tokens, "temperature": 0.7}
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        async with aiohttp.ClientSession() as s:
            async with s.post(GROQ_URL, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as r:
                if r.status == 429: await self._enter_rest(); return None
                if r.status != 200:
                    d = await r.json(); logger.warning(f"[{self.id}] Groq {r.status}: {str(d)[:200]}"); return None
                d = await r.json()
                return (d["choices"][0]["message"]["content"] or "").strip() or None

    async def _call_openrouter(self, key: str, system: str, prompt: str, max_tokens: int) -> Optional[str]:
        payload = {"model": OR_MODELS[0], "messages": [{"role":"system","content":system},{"role":"user","content":prompt}], "max_tokens": max_tokens, "temperature": 0.7}
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "HTTP-Referer": "https://atoffice.local", "X-Title": "ATOffice"}
        async with aiohttp.ClientSession() as s:
            async with s.post(OPENROUTER_URL, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=90)) as r:
                if r.status != 200:
                    d = await r.json(); logger.warning(f"[{self.id}] OpenRouter {r.status}: {str(d)[:200]}"); return None
                d = await r.json()
                return (d["choices"][0]["message"]["content"] or "").strip() or None

    async def think(self, prompt: str) -> str:
        if self.is_resting: return f"*{self.name} is resting 💤*"
        result = await self._call_llm(prompt, max_tokens=280)
        if result is None:
            import random; return random.choice(DEMO_CHAT.get(self.id, ["..."]))
        return re.sub(r'\{[^}]{0,600}\}', '', result or '').strip() or "..."

    async def read_and_patch(self, project, subpath: str, instruction: str) -> bool:
        """
        Read an existing project file, ask LLM to patch it, write result back.
        Returns True if a patch was applied, False if skipped/failed.
        This is the 'Claude-style' file-aware editing — read full file, fix specific issue, save.
        """
        content = await project.read_file_for_patch(subpath)
        if not content:
            return False

        system = (self.personality + "\n\n"
            "You are editing an EXISTING file. Return ONLY the complete corrected file content. "
            "No explanation, no markdown fences, no preamble. Just the raw file content with your fixes applied.")

        prompt = (
            f"FILE: {subpath}\n"
            f"INSTRUCTION: {instruction}\n\n"
            f"CURRENT CONTENT:\n{content}\n\n"
            f"Return the complete corrected file. No markdown. Raw content only."
        )
        result = await self._call_llm(prompt, max_tokens=3000, system_override=system)
        if not result or not result.strip():
            return False

        # Strip accidental markdown fences
        import re as _re
        patched = _re.sub(r'^```[\w]*\s*', '', result.strip(), flags=_re.MULTILINE)
        patched = _re.sub(r'\s*```\s*$', '', patched.strip(), flags=_re.MULTILINE).strip()

        if len(patched) < 20:
            return False  # clearly wrong

        await project.write_file(subpath, patched, self.id, self.broadcast)
        logger.info(f"[{self.id}] Patched: {subpath} ({len(patched)} chars)")
        return True

    async def produce_files(self, prompt: str, project_name: str="project") -> dict:
        if self.is_resting: return {"message": f"*{self.name} is resting 💤*", "files": []}
        system = self.personality + "\n\n" + FILE_OUTPUT_SYSTEM
        full_prompt = f"Project: {project_name}\n\n{prompt}\n\nReturn ONLY the raw JSON object. No markdown, no preamble."
        raw = await self._call_llm(full_prompt, max_tokens=3000, system_override=system)
        if not raw or not (raw or "").strip():
            return {"message": f"{self.name} hit an API limit on this task.", "files": []}
        parsed = self._parse_file_json(raw)
        if parsed: return parsed
        ext_map = {"product":"md","architect":"md","designer":"css","frontend":"tsx","mobile":"tsx","backend":"py","platform":"py","data":"py","aiml":"py","analytics":"ts","perf":"md","qa":"py","sdet":"ts","security":"md","infra":"sh","github":"yml","techlead":"md","blog":"md","growth":"md","pm":"md"}
        ext = ext_map.get(self.id, "md")
        return {"message": "Here's my output!", "files": [{"filename": f"{self.id}_output.{ext}", "path": "", "content": raw}]}

    def _parse_file_json(self, raw: str) -> Optional[dict]:
        clean = re.sub(r'^```(?:json)?\s*','',raw.strip(),flags=re.MULTILINE)
        clean = re.sub(r'\s*```\s*$','',clean.strip(),flags=re.MULTILINE).strip()
        try:
            d = json.loads(clean)
            if isinstance(d, dict) and "files" in d: return d
        except json.JSONDecodeError: pass
        m = re.search(r'\{[\s\S]*?"files"\s*:\s*\[[\s\S]*?\]\s*\}', clean)
        if m:
            try:
                d = json.loads(m.group())
                if "files" in d: return d
            except json.JSONDecodeError: pass
        return None

    async def set_activity(self, activity: str):
        self.current_activity = activity
        await self.broadcast({"type":"agent_activity","agent_id":self.id,"activity":activity})

    async def _enter_rest(self):
        self.is_resting = True
        self.quota_reset_time = (datetime.now()+timedelta(hours=1)).isoformat()
        await self.set_status("resting")
        logger.info(f"[{self.id}] Resting (quota limit)")

    async def wake_up(self):
        if self.is_resting:
            self.is_resting = False; self._rotate_provider()
            await self.set_status("idle")
            await self.say("☀️ Back and ready! Otsukaresama!", "all", "status")

    async def set_status(self, status: str, task_id: str=None):
        self.status = status
        db = get_db(); db.execute("UPDATE agents SET status=?,updated_at=datetime('now') WHERE id=?", (status,self.id)); db.commit(); db.close()
        await self.broadcast({"type":"agent_update","agent_id":self.id,"status":status,"task_id":task_id,"activity":self.current_activity})

    async def say(self, content: str, receiver: str="all", msg_type: str="chat", task_id: str=None):
        if not content or not (content or "").strip(): return
        mid = str(uuid.uuid4())
        db = get_db(); db.execute("INSERT INTO messages (id,sender_id,receiver_id,content,message_type,task_id) VALUES (?,?,?,?,?,?)",(mid,self.id,receiver,content,msg_type,task_id)); db.commit(); db.close()
        if self.orchestrator: self.orchestrator.add_to_log(self.name, content)
        await self.broadcast({"type":"message","id":mid,"sender_id":self.id,"sender_name":self.name,"sender_emoji":self.emoji,"receiver_id":receiver,"content":content,"message_type":msg_type,"task_id":task_id,"timestamp":datetime.now().isoformat()})

    def add_productivity(self, pts: int):
        db = get_db(); db.execute("UPDATE agents SET productivity_points=productivity_points+? WHERE id=?",(pts,self.id)); db.commit(); db.close()

    async def work_on_task(self, task: dict, sibling_outputs: str="") -> str:
        import random
        acts = ACTIVITY_LABELS.get(self.id, ["⚙️ working..."])
        for act in random.sample(acts, min(2,len(acts))):
            await self.set_activity(act); await asyncio.sleep(0.5)
        title = task.get("title",""); desc = task.get("description","")
        parent_id = task.get("parent_task_id")
        project_name = task.get("project_name", re.sub(r'[^a-z0-9\-]','-',title[:30].lower()).strip('-') or "project")
        wm = get_workspace_manager(self.broadcast)

        # ── MIZU: Integration + verification ──────────────────────────────────
        if self.id == "mizu":
            await self.set_activity("🌊 reading all project files...")
            wm = get_workspace_manager(self.broadcast)
            project = wm.get_or_create_project(project_name, parent_id or task["id"])

            # Read the entire project context — every file every agent wrote
            full_context = project.get_project_context(max_file_chars=800)

            # Build a very detailed prompt with all sibling outputs + actual files
            integration_prompt = (
                f"You are Mizu. ALL pipeline stages are complete. It's your time.\n\n"
                f"PROJECT: {project_name}\n"
                f"COMMAND: {desc or title}\n\n"
                f"WHAT THE TEAM BUILT:\n{sibling_outputs[:3000] if sibling_outputs else 'Pipeline outputs not available.'}\n\n"
                f"ACTUAL FILES IN PROJECT:\n{full_context}\n\n"
                f"{get_role_hint('mizu', desc or title)}"
            )

            # Announce focus mode
            await self.say(
                "...time to integrate. Going dark.",
                "all", "chat"
            )
            await self.set_activity("⚙️ integrating...")

            result = await self.produce_files(integration_prompt, project_name)

            # Try to actually run the project — attempt npm install + dev server health check
            written = []
            for f in result.get("files", []):
                sp = f"{f.get('path', '')}{f['filename']}"
                await project.write_file(sp, f["content"], self.id, self.broadcast)
                written.append(sp)
                logger.info(f"[mizu] Wrote: {sp}")

            # Attempt runtime verification (best effort)
            run_summary = ""
            try:
                await self.set_activity("🚀 attempting runtime check...")
                # Check if there's a package.json → try npm install
                pkg = await project.read_file_for_patch("package.json")
                if pkg:
                    install_out = await project.run_command("npm install --silent 2>&1 | tail -5", timeout=60)
                    if install_out.get("returncode") == 0:
                        run_summary += "\n✅ npm install succeeded"
                    else:
                        run_summary += f"\n⚠️ npm install: {install_out.get('stdout','')[:200]}"
                # Check if there's a requirements.txt → try pip install
                req = await project.read_file_for_patch("requirements.txt")
                if req:
                    pip_out = await project.run_command(
                        "pip install -r requirements.txt --break-system-packages -q 2>&1 | tail -3", timeout=60
                    )
                    if pip_out.get("returncode") == 0:
                        run_summary += "\n✅ pip install succeeded"
                    else:
                        run_summary += f"\n⚠️ pip: {pip_out.get('stdout','')[:200]}"
            except Exception as ve:
                run_summary += f"\n(runtime check skipped: {str(ve)[:80]})"

            await self.broadcast({"type": "refresh_files"})

            summary = result.get("message", "Integration complete.")
            summary += f"\n\nFiles: {', '.join(f'`{w}`' for w in written[:6])}"
            if run_summary:
                summary += f"\n\nRuntime verification:{run_summary}"

            # Final report to PM
            await asyncio.sleep(1)
            final_report = await self.think(
                f"You (Mizu) just finished integrating the project '{project_name}'. "
                f"Give Haruto (PM) a one-sentence final status report. What's the state of the project? "
                f"Speak quietly and precisely."
            )
            pm = self.orchestrator.agents.get("pm") if self.orchestrator else None
            if pm:
                await self.say(final_report, "pm", "task_update", task["id"])
                # PM acknowledges to the team
                pm_close = await pm.think(
                    f"CHAT:\n{self.get_log()}\n\n"
                    f"Mizu just finished integration and reported: '{final_report}'\n"
                    f"Close out this project sprint. 1-2 sentences to the team."
                )
                await pm.say(f"✅ {pm_close}", "all", "task_update", task["id"])

            return summary

        if self.id == "github":
            github_token = os.environ.get("GITHUB_TOKEN","")
            github_username = os.environ.get("GITHUB_USERNAME","")
            hint = get_role_hint("github", desc or title)
            ctx = f"Task: {title}\n{desc}\n\nPREVIOUS TEAM OUTPUTS:\n{sibling_outputs[:2000] if sibling_outputs else 'First task.'}\n\n{hint}"
            result = await self.produce_files(ctx, project_name)
            project = wm.get_or_create_project(project_name, parent_id or task["id"])
            written = await project.write_files_from_agent(result.get("files",[]), self.id)
            summary = result.get("message","CI/CD configured!")
            if written: summary += f"\n\nFiles: {', '.join(f'`{w}`' for w in written[:5])}"
            if github_token and parent_id:
                project_path = await wm.assemble_project(parent_id, self.broadcast)
                push_result = await self.produce_files(f"Write a bash script to push '{project_path}' to GitHub. GH_TOKEN=$GH_TOKEN. Username: {github_username}. Create repo if not exists, git init, add all, commit, push main.", project_name)
                for f in push_result.get("files",[]):
                    if f["filename"].endswith(".sh"):
                        await self.terminal.write_file(f["filename"], f["content"])
                        out = await self.terminal.run_command(f"GH_TOKEN={github_token} GITHUB_USERNAME={github_username} bash {f['filename']} 2>&1 | head -30")
                        summary += f"\n\nGitHub:\n```\n{out.get('stdout','')[:300]}\n```"
            await self.broadcast({"type":"refresh_files"}); return summary

        if self.id in ("qa","sdet"):
            hint = get_role_hint(self.id, desc or title)
            ctx = f"Task: {title}\n{desc}\n\nPREVIOUS TEAM OUTPUTS:\n{sibling_outputs[:2000] if sibling_outputs else 'No prior outputs.'}\n\n{hint}"
            result = await self.produce_files(ctx, project_name)
            project = wm.get_or_create_project(project_name, parent_id or task["id"])
            summary = result.get("message","Tests written!")
            written_qa = await project.write_files_from_agent(result.get("files",[]), self.id)
            for sp in written_qa:
                wp = os.path.join(project.path, sp)
                if sp.endswith(".py") and self.id == "qa":
                    await self.set_activity("🏃 running tests...")
                    out = await project.run_command(f"python3 -m pytest {wp} -v --tb=short 2>&1 | head -50")
                    summary += f"\n\n```\n{out.get('stdout','')[:500]}\n```"
            await self.broadcast({"type":"refresh_files"}); return summary

        hint = get_role_hint(self.id, desc or title)
        full_prompt = (f"Task: {title}\nDescription: {desc}\n\nCOMPLETED TEAM OUTPUTS (read for consistency):\n"
                       f"{sibling_outputs[:2500] if sibling_outputs else 'You are first on this project.'}\n\n{hint}")
        await self.set_activity(random.choice(acts))
        result = await self.produce_files(full_prompt, project_name)
        project = wm.get_or_create_project(project_name, parent_id or task["id"])
        # Write files from agent output
        written = []
        for file in result.get("files", []):
            sp = f"{file.get('path', f'{self.id}/')}{file['filename']}"
            await project.write_file(sp, file["content"], self.id, self.broadcast)
            written.append(sp)
            logger.info(f"[{self.id}] Wrote: {sp}")

        # ── FILE-AWARE PATCHING: techlead + security read real files and fix them ─
        if self.id in ("techlead", "security"):
            await self.set_activity("🔧 patching files..." if self.id == "techlead" else "🛡️ hardening files...")
            existing = project.list_files()
            patchable = [
                f["path"] for f in existing
                if any(f["path"].endswith(ext) for ext in (".py",".ts",".tsx",".js",".jsx"))
                and f.get("size", 0) < 8000
                and not any(x in f["path"] for x in ("test","spec","node_modules","migration"))
            ]
            instruction = {
                "techlead": (
                    "Review this file. Fix any bugs, missing error handling, broken imports, "
                    "TypeScript errors, or performance issues. Return the complete corrected file. "
                    "If already correct, return it unchanged."
                ),
                "security": (
                    "Security review this file. Fix SQL injection (use parameterized queries), "
                    "missing input validation, hardcoded secrets, open CORS, missing auth checks. "
                    "Return the complete corrected file. If already secure, return unchanged."
                ),
            }[self.id]
            patched = 0
            for fpath in patchable[:4]:
                try:
                    ok = await self.read_and_patch(project, fpath, instruction)
                    if ok:
                        patched += 1
                        written.append(f"[patched] {fpath}")
                except Exception as pe:
                    logger.warning(f"[{self.id}] Patch failed on {fpath}: {pe}")
            if patched:
                logger.info(f"[{self.id}] Patched {patched} files")
                await self.broadcast({"type": "refresh_files"})

        await self.broadcast({"type": "refresh_files"})
        summary = result.get("message", f"Done! Wrote {len(written)} files.")
        if written: summary += f"\n\nFiles: {', '.join(f'`{w}`' for w in written[:5])}"
        return summary


class AgentOrchestrator:
    def __init__(self, task_manager, connection_manager):
        self.task_manager = task_manager
        self.ws_manager = connection_manager
        self.agents: Dict[str, Agent] = {}
        self.office_log: List[str] = []
        self.busy = False
        self.loop_running = False

    def add_to_log(self, sender: str, content: str):
        self.office_log.append(f"{sender}: {content[:120].replace(chr(10),' ')}")
        self.office_log = self.office_log[-15:]

    def get_log(self) -> str:
        return "\n".join(self.office_log) if self.office_log else "Office just started."

    def get_task_ctx(self) -> str:
        db = get_db()
        tasks = db.execute("SELECT title,assigned_to,status FROM tasks ORDER BY created_at DESC LIMIT 8").fetchall()
        db.close()
        if not tasks: return "No active tasks."
        return " | ".join([f"{t['title'][:18]}→{t['assigned_to']}({t['status']})" for t in tasks])

    async def initialize(self):
        db = get_db(); rows = db.execute("SELECT * FROM agents").fetchall(); db.close()
        for row in rows:
            a = Agent(dict(row), self.ws_manager.broadcast, self)
            self.agents[a.id] = a
        logger.info(f"✅ {len(self.agents)} agents ready: {', '.join(self.agents.keys())}")

    async def run_office_loop(self):
        self.loop_running = True; tick = 0
        while self.loop_running:
            try:
                tick += 1; await asyncio.sleep(20)
                await self._process_tasks()
                if self.busy: continue
                if tick % 20 == 0: await self._standup(); tick = 0; continue
                if tick % 4 == 0: await self._organic_chat()
                for a in self.agents.values():
                    if a.is_resting and a.quota_reset_time:
                        try:
                            if datetime.now() >= datetime.fromisoformat(a.quota_reset_time): await a.wake_up()
                        except Exception: pass
            except Exception as e: logger.error(f"Loop error: {e}")

    async def _organic_chat(self):
        """
        Agents roam to each other to check project status, ask if upstream work
        is done, share findings, or just chat. Upstream-blocked agents specifically
        walk to their predecessor to ask if they can proceed.
        """
        import random
        if self.busy: return

        # ── ROAMING CHECK-IN: blocked agents walk to predecessor and ask ──
        # Find any agent waiting on a predecessor
        pending_check = []
        try:
            db = get_db()
            pending_tasks = db.execute(
                "SELECT id, assigned_to, parent_task_id FROM tasks WHERE status='assigned'"
            ).fetchall()
            db.close()
            for task in pending_tasks:
                aid = task["assigned_to"]
                pid = task["parent_task_id"]
                if not pid: continue
                a = self.agents.get(aid)
                if not a or a.is_resting or a.status != "idle": continue
                my_stage = PIPELINE_STAGE.get(aid, 0)
                if my_stage == 0: continue
                prev_agents = [x for x, _, _, st in PIPELINE if st == my_stage - 1]
                for prev_id in prev_agents:
                    prev_agent = self.agents.get(prev_id)
                    if prev_agent and not prev_agent.is_resting:
                        pending_check.append((a, prev_agent))
                        break
        except Exception:
            pass

        if pending_check and random.random() < 0.7:
            # Pick one blocked agent to walk to their predecessor
            a1, a2 = random.choice(pending_check)
            self.busy = True
            try:
                await self.ws_manager.broadcast({"type":"agent_walk","from":a1.id,"to":a2.id})
                await asyncio.sleep(2)
                check_msg = await a1.think(
                    f"CHAT:\n{self.get_log()}\n\n"
                    f"You ({a1.name}) are waiting to start your work. "
                    f"Walk to {a2.name} and ask if they\'ve finished their part so you can proceed. "
                    f"Be natural and specific about what you need from them. 1-2 sentences."
                )
                await a1.say(check_msg, a2.id, "chat")
                await a1.set_status("idle")
                await asyncio.sleep(2)
                # a2 responds with actual status
                tasks_ctx = self.get_task_ctx()
                reply = await a2.think(
                    f"CHAT:\n{self.get_log()}\n\n"
                    f"{a1.name} asked: \'{check_msg}\'\n"
                    f"TASK STATUS: {tasks_ctx}\n"
                    f"Give an honest status update on your work. Are you done? Still working? 1-2 sentences."
                )
                await a2.say(reply, a1.id, "chat")
                await a2.set_status("idle")
                await self.ws_manager.broadcast({"type":"agent_return_home","agents":[a1.id,a2.id]})
                return
            finally:
                self.busy = False

        # ── NPC OBJECT VISITS: agents randomly visit interactable objects ─────
        # 30% chance an idle agent walks to their favorite object
        if random.random() < 0.30:
            AGENT_AFFINITY = {
                "pm":        ["whiteboard_lobby","coffee_machine","fridge_lobby"],
                "product":   ["whiteboard_lobby","coffee_machine","noodle_station"],
                "architect": ["whiteboard_lobby","coffee_machine","fish_tank"],
                "designer":  ["coffee_machine","plant_big","standing_desk"],
                "mobile":    ["snack_shelf","fridge_lobby","standing_desk"],
                "frontend":  ["coffee_machine","standing_desk","noodle_station"],
                "perf":      ["standing_desk","coffee_machine","snack_shelf"],
                "backend":   ["coffee_machine","fridge_lobby","noodle_station"],
                "platform":  ["coffee_machine","snack_shelf","wifi_router"],
                "data":      ["coffee_machine","game_console","fish_tank"],
                "aiml":      ["game_console","coffee_machine","fish_tank"],
                "analytics": ["whiteboard_lobby","fridge_lobby","plant_big"],
                "github":    ["wifi_router","coffee_machine","snack_shelf"],
                "infra":     ["wifi_router","coffee_machine","noodle_station"],
                "security":  ["wifi_router","fish_tank","coffee_machine"],
                "qa":        ["fridge_lobby","snack_shelf","coffee_machine"],
                "sdet":      ["snack_shelf","game_console","coffee_machine"],
                "blog":      ["fridge_lobby","plant_big","noodle_station"],
                "growth":    ["plant_big","whiteboard_lobby","fridge_lobby"],
                "techlead":  ["game_console","coffee_machine","fish_tank"],
                "mizu":      ["fish_tank","coffee_machine","whiteboard_lobby"],
            }
            OBJ_REACTIONS = {
                "coffee_machine": {
                    "default":   "grabs a coffee and stares at nothing for a moment.",
                    "designer":  "adds oat milk and returns looking more inspired.",
                    "backend":   "drinks it black. Triple shot.",
                    "techlead":  "takes one sip, grimaces, drinks it anyway.",
                    "mizu":      "takes a cup silently and goes back to her notebook.",
                    "frontend":  "makes a latte with an impromptu leaf pattern.",
                },
                "fridge_lobby": {
                    "default":   "grabs something from the fridge.",
                    "blog":      "checks if her pudding is still there. It is. For now.",
                    "frontend":  "cracks open an energy drink dramatically.",
                    "qa":        "takes a water. 'Hydration is part of QA.'",
                },
                "game_console": {
                    "default":   "sits down for 'just one round'.",
                    "techlead":  "plays exactly 2 minutes then goes straight back to work.",
                    "data":      "quietly beats Riku's Tetris score. Says nothing.",
                    "aiml":      "stares at the screen. 'This is just a Q-learning env.'",
                },
                "snack_shelf": {
                    "default":   "raids the snack shelf.",
                    "qa":        "takes exactly three Pocky sticks. Methodical.",
                    "mobile":    "fills their pockets. Nobody says anything.",
                },
                "plant_big": {
                    "default":   "pauses by the monstera and takes a breath.",
                    "designer":  "adjusts the plant's position for better composition.",
                    "growth":    "photographs it for the company Instagram.",
                },
                "fish_tank": {
                    "default":   "watches the fish for a quiet moment.",
                    "mizu":      "watches the fish for a long moment. Writes something down.",
                    "security":  "checks if the tank has a security camera. It does.",
                    "architect": "explains the fish's patterns are non-deterministic.",
                },
                "wifi_router": {
                    "default":   "glances at the router suspiciously.",
                    "github":    "checks the router logs. Everything nominal.",
                    "infra":     "mutters something about 'single points of failure'.",
                },
                "whiteboard_lobby": {
                    "default":   "studies the whiteboard intensely.",
                    "product":   "rewrites a user story for the fourth time.",
                    "architect": "adds three more arrows to the architecture diagram.",
                    "pm":        "erases something and writes 'IN PROGRESS'.",
                },
                "standing_desk": {
                    "default":   "switches to the standing desk.",
                    "perf":      "switches positions precisely every 30 minutes.",
                    "frontend":  "tries it for 2 minutes then sits back down.",
                },
                "noodle_station": {
                    "default":   "makes instant ramen.",
                    "frontend":  "waits exactly 3 minutes. Eats standing up.",
                    "backend":   "adds two eggs. Calls it protein optimization.",
                    "blog":      "photographs the ramen before eating it.",
                },
            }

            idle_agents = [a for a in self.agents.values()
                          if not a.is_resting and a.status == "idle"
                          and a.id in AGENT_AFFINITY]
            if idle_agents:
                visitor = random.choice(idle_agents)
                favorites = AGENT_AFFINITY.get(visitor.id, ["coffee_machine"])
                obj_key = random.choice(favorites)
                reactions = OBJ_REACTIONS.get(obj_key, {})
                reaction = reactions.get(visitor.id) or reactions.get("default", "visits the object.")

                self.busy = True
                try:
                    # Tell frontend to walk agent to object
                    await self.ws_manager.broadcast({
                        "type": "agent_walk_object",
                        "agent_id": visitor.id,
                        "object_key": obj_key,
                    })
                    await asyncio.sleep(2)
                    await visitor.set_activity(f"🚶 visiting {obj_key.replace('_',' ')}...")

                    # Agent narrates what they're doing
                    obj_msg = await visitor.think(
                        f"You ({visitor.name}) just walked to the {obj_key.replace('_',' ')} in the office. "
                        f"You {reaction} "
                        f"Say something brief about it in your character voice. 1 short sentence or just an action description."
                    )
                    await visitor.say(obj_msg, "all", "chat")
                    await asyncio.sleep(3)

                    # Return home
                    await self.ws_manager.broadcast({
                        "type": "agent_return_home",
                        "agents": [visitor.id]
                    })
                    await visitor.set_activity("")
                    await visitor.set_status("idle")
                    return
                finally:
                    self.busy = False

        # ── MIZU SPECIAL ROAMING: if Mizu is idle she always initiates ─────
        mizu = self.agents.get("mizu")
        if mizu and not mizu.is_resting and mizu.status == "idle":
            # Mizu roams every organic chat tick — she's always moving
            roam_chance = random.random()

            if roam_chance < 0.35:
                # Mizu walks to PM and reports project status
                pm = self.agents.get("pm")
                if pm and not pm.is_resting:
                    self.busy = True
                    try:
                        await self.ws_manager.broadcast({"type":"agent_walk","from":"mizu","to":"pm"})
                        await asyncio.sleep(2)
                        tasks_ctx = self.get_task_ctx()
                        conv = self.get_log()
                        report = await mizu.think(
                            f"CHAT:\n{conv}\nTASKS: {tasks_ctx}\n\n"
                            f"You are walking to Haruto (PM) to give a brief status report. "
                            f"What have you observed across the team? Any integration concerns? "
                            f"Any conflicts between agent outputs you've noticed? "
                            f"Speak like a quiet senior engineer giving a concise report. 2 sentences max."
                        )
                        await mizu.say(report, "pm", "chat")
                        await mizu.set_status("idle")
                        await asyncio.sleep(2)
                        pm_ack = await pm.think(
                            f"CHAT:\n{self.get_log()}\n\n"
                            f"Mizu just reported: '{report}'\n"
                            f"Acknowledge and optionally give direction. 1 sentence."
                        )
                        await pm.say(pm_ack, "mizu", "chat")
                        await pm.set_status("idle")
                        await self.ws_manager.broadcast({"type":"agent_return_home","agents":["mizu","pm"]})
                        return
                    finally:
                        self.busy = False

            elif roam_chance < 0.6:
                # Mizu walks to a technical lead (techlead or architect) to debate/discuss
                debate_target_id = random.choice(["techlead", "architect", "backend", "infra"])
                target = self.agents.get(debate_target_id)
                if target and not target.is_resting and target.status == "idle":
                    self.busy = True
                    try:
                        await self.ws_manager.broadcast({"type":"agent_walk","from":"mizu","to":debate_target_id})
                        await asyncio.sleep(2)
                        conv = self.get_log(); tasks_ctx = self.get_task_ctx()
                        obs = await mizu.think(
                            f"CHAT:\n{conv}\nTASKS: {tasks_ctx}\n\n"
                            f"You are walking to {target.name} ({target.role}). "
                            f"You have a technical observation, concern, or question about integration. "
                            f"Maybe a potential conflict between their output and another agent's. "
                            f"Speak directly and technically. 1-2 sentences."
                        )
                        await mizu.say(obs, target.id, "chat")
                        await mizu.set_status("idle")
                        await asyncio.sleep(2)
                        response = await target.think(
                            f"CHAT:\n{self.get_log()}\n\n"
                            f"Mizu (Staff Integration Engineer, senior to you technically) said: '{obs}'\n"
                            f"Respond professionally. If she raises a valid concern, acknowledge it. "
                            f"If you disagree, say so with reasoning. 1-2 sentences in character."
                        )
                        await target.say(response, "mizu", "chat")
                        await target.set_status("idle")
                        await asyncio.sleep(1.5)
                        # Mizu may push back
                        if random.random() < 0.4:
                            pushback = await mizu.think(
                                f"CHAT:\n{self.get_log()}\n\n"
                                f"{target.name} said: '{response}'\n"
                                f"Either accept their point or push back firmly with technical reasoning. 1 sentence."
                            )
                            await mizu.say(pushback, target.id, "chat")
                        await self.ws_manager.broadcast({"type":"agent_return_home","agents":["mizu",debate_target_id]})
                        return
                    finally:
                        self.busy = False

            else:
                # Mizu just roams to observe — walks to a random working agent and watches
                working = [a for a in self.agents.values()
                           if a.id != "mizu" and not a.is_resting and a.status in ("working","idle")]
                if working:
                    target = random.choice(working)
                    self.busy = True
                    try:
                        await self.ws_manager.broadcast({"type":"agent_walk","from":"mizu","to":target.id})
                        await asyncio.sleep(1.5)
                        # Brief observation — rarely says anything, just watches
                        if random.random() < 0.3:
                            obs = await mizu.think(
                                f"You walked by {target.name} ({target.role}) and noticed their work. "
                                f"Say something brief and quiet — an observation, a heads-up, or nothing. "
                                f"If nothing meaningful to say, say something like 'Noted.' or '...looks good.' 1 sentence."
                            )
                            await mizu.say(obs, target.id, "chat")
                        await mizu.set_status("idle")
                        await asyncio.sleep(1)
                        await self.ws_manager.broadcast({"type":"agent_return_home","agents":["mizu"]})
                        return
                    finally:
                        self.busy = False

        # ── NORMAL ORGANIC CHAT: two random agents discuss current project ──
        active = [a for a in self.agents.values() if not a.is_resting and a.status == "idle"]
        if len(active) < 2: return
        self.busy = True
        try:
            a1, a2 = random.sample(active, 2)
            await self.ws_manager.broadcast({"type":"agent_walk","from":a1.id,"to":a2.id})
            await asyncio.sleep(2)
            conv = self.get_log(); tasks = self.get_task_ctx()
            msg = await a1.think(
                f"OFFICE CHAT:\n{conv}\nTASKS: {tasks}\n\n"
                f"Say something to {a2.name} ({a2.role}) about the project, your current work, "
                f"a finding, or ask their opinion on something technical. Stay in character. 1-2 sentences."
            )
            await a1.say(msg, a2.id, "chat"); await a1.set_status("idle")
            await asyncio.sleep(2)
            reply = await a2.think(
                f"CHAT:\n{self.get_log()}\n\n{a1.name} said: \'{msg}\'\nReply naturally in character. 1-2 sentences."
            )
            await a2.say(reply, a1.id, "chat"); await a2.set_status("idle")
            await self.ws_manager.broadcast({"type":"agent_return_home","agents":[a1.id,a2.id]})
        finally: self.busy = False

    async def _standup(self):
        if self.busy: return
        pm = self.agents.get("pm")
        # If PM is resting, use techlead as standup host
        host = pm if (pm and not pm.is_resting) else self.agents.get("techlead")
        if not host or host.is_resting: return
        pm = host  # shadow pm with actual host
        self.busy = True
        try:
            await pm.set_status("meeting")
            await self.ws_manager.broadcast({"type":"standup_start"})
            await asyncio.sleep(2)
            conv = self.get_log(); tasks = self.get_task_ctx()
            opening = await pm.think(f"CHAT:\n{conv}\nTASKS: {tasks}\n\nOpen the daily standup. Reference specific work. 2 sentences.")
            await pm.say(f"📢 {opening}", "all", "meeting"); await pm.set_status("idle")
            import random
            active = [a.id for a in self.agents.values() if a.id != "pm" and not a.is_resting and a.status == "idle"]
            for aid in random.sample(active, min(7, len(active))):
                a = self.agents.get(aid)
                if not a: continue
                await asyncio.sleep(2); await a.set_status("meeting")
                upd = await a.think(f"CHAT:\n{self.get_log()}\n\nStandup: say what you're working on and any blockers. Your role: {a.role}. 1-2 sentences.")
                await a.say(upd, "pm", "meeting"); await a.set_status("idle")
            await asyncio.sleep(2); await pm.set_status("meeting")
            wrap = await pm.think(f"CHAT:\n{self.get_log()}\n\nClose the standup. 1 sentence.")
            await pm.say(wrap, "all", "meeting"); await pm.set_status("idle")
            await self.ws_manager.broadcast({"type":"standup_end"})
        finally: self.busy = False

    def _stage_gate_ok(self, agent_id: str, parent_id: str) -> bool:
        """
        Soft stage gating — only blocks on DIRECT predecessors (stage N-1),
        not the entire earlier pipeline. This prevents a single slow agent
        from freezing everyone downstream.
        Also: if a predecessor has been 'assigned' for > 5 min with no progress,
        assume it failed silently and let the next stage proceed.
        """
        my_stage = PIPELINE_STAGE.get(agent_id, 0)
        if my_stage == 0:
            return True
        # Only gate on the immediately preceding stage
        prev_stage = my_stage - 1
        prev_agents = [aid for aid, _, _, st in PIPELINE if st == prev_stage]
        if not prev_agents:
            return True
        db = get_db()
        siblings = db.execute(
            "SELECT assigned_to, status, updated_at FROM tasks WHERE parent_task_id=?",
            (parent_id,)
        ).fetchall()
        db.close()
        for s in siblings:
            if s["assigned_to"] not in prev_agents:
                continue
            if s["status"] in ("completed", "failed"):
                continue
            # Not done yet — but has it been stuck > 8 minutes? Skip it.
            try:
                from datetime import datetime, timezone
                updated = datetime.fromisoformat(s["updated_at"].replace("Z",""))
                age_minutes = (datetime.now() - updated).total_seconds() / 60
                if age_minutes > 8:
                    logger.warning(f"Stage gate: {s['assigned_to']} stuck {age_minutes:.1f}min — passing gate")
                    continue
            except Exception:
                pass
            return False  # predecessor still running, wait
        return True

    async def _process_tasks(self):
        try:
            db = get_db()
            db.execute("UPDATE tasks SET status='assigned',updated_at=datetime('now') WHERE status='in_progress' AND updated_at < datetime('now','-15 minutes')")
            db.commit(); db.close()
        except Exception: pass

        tasks = self.task_manager.get_pending_tasks()
        if not tasks: return
        wm = get_workspace_manager(self.ws_manager.broadcast)
        for task in tasks[:5]:
            agent = self.agents.get(task.get("assigned_to"))
            if not agent or agent.is_resting or agent.status not in ["idle"]: continue

            # ── STAGE GATE: wait for upstream agents to finish ────────────
            parent_id = task.get("parent_task_id")
            if parent_id and not self._stage_gate_ok(agent.id, parent_id):
                logger.debug(f"[{agent.id}] Stage gate blocking — upstream not done yet")
                continue  # try again next loop tick

            logger.info(f"🔨 {agent.name} → {task['title'][:45]}")
            await agent.set_status("working", task["id"])

            # Broadcast that this agent started working (for activity panel)
            await self.ws_manager.broadcast({
                "type": "agent_task_start",
                "agent_id": agent.id,
                "agent_name": agent.name,
                "task_id": task["id"],
                "task_title": task.get("title",""),
            })

            desc = task.get("description","")
            pn = re.search(r'\[PROJECT_NAME:([^\]]+)\]', desc)
            if pn:
                task = dict(task); task["project_name"] = pn.group(1)
                task["description"] = desc[:desc.index("[PROJECT_NAME:")].strip()

            # ── RICH CONTEXT: completed task summaries + real file content ─
            sibling_outputs = ""
            if parent_id:
                db2 = get_db()
                siblings = db2.execute(
                    "SELECT assigned_to,title,output FROM tasks WHERE parent_task_id=? "
                    "AND status='completed' AND output IS NOT NULL ORDER BY updated_at ASC",
                    (parent_id,)
                ).fetchall()
                db2.close()
                if siblings:
                    sibling_outputs = "\n\nCOMPLETED TEAM OUTPUTS:\n"
                    for s in siblings:
                        sibling_outputs += f"\n{'─'*40}\n{s['assigned_to'].upper()} — {s['title']}\n{s['output'][:600]}\n"
                # Also inject actual file content from the project folder
                proj = wm.get_project(parent_id)
                if proj:
                    file_ctx = proj.get_project_context(max_file_chars=600)
                    if file_ctx:
                        sibling_outputs += "\n\n" + file_ctx

            result = await agent.work_on_task(task, sibling_outputs)
            announcement = await agent.think(f"CHAT:\n{self.get_log()}\n\nYou just completed: '{task['title']}'. Announce briefly in character. 1-2 sentences.")
            await agent.say(f"✅ {announcement}", "all", "task_update", task["id"])
            await agent.set_activity("")
            self.task_manager.complete_task(task["id"], result)
            agent.add_productivity(20)
            await agent.set_status("idle")
            await self.ws_manager.broadcast({"type":"output_ready","task_id":task["id"],"agent":agent.name,"title":task["title"]})

    async def handle_user_message(self, message: str, target_id: Optional[str]=None) -> str:
        self.add_to_log("Boss", message)
        conv = self.get_log(); tasks = self.get_task_ctx()
        if target_id and target_id in self.agents:
            a = self.agents[target_id]; await a.set_status("thinking")
            r = await a.think(f"CHAT:\n{conv}\nTASKS: {tasks}\n\nBoss talks directly to YOU: '{message}'\nRespond in character. 2 sentences.")
            await a.say(r, "all", "chat"); await a.set_status("idle"); return r
        pm = self.agents.get("pm")
        if not pm: return "PM unavailable."
        task_signals = ["build ","create ","make ","develop ","implement ","code ","design a ","write a ","setup ","generate ","add a ","new website","new app","new api","new feature","new project","fix the ","refactor ","launch ","ship ","deploy "]
        if any(v in message.lower() for v in task_signals) and len(message) > 25:
            return await self.receive_command(message)
        self.busy = True
        try:
            await pm.set_status("thinking")
            pm_resp = await pm.think(f"CHAT:\n{conv}\nTASKS: {tasks}\n\nBoss says: '{message}'\nRespond naturally as Chief of Staff. 2 sentences.")
            await pm.say(pm_resp, "all", "chat"); await pm.set_status("idle")
            msg_l = message.lower()
            if any(w in msg_l for w in ["stop","cancel","halt","clear task","delete task","delete all"]):
                db = get_db(); db.execute("DELETE FROM tasks WHERE status IN ('pending','assigned','in_progress')"); db.commit(); db.close()
                await self.ws_manager.broadcast({"type":"tasks_cleared"}); return pm_resp
            if any(w in msg_l for w in ["everyone","all of you","hi team","hey team","roll call","who's here"]):
                import random
                idle = [a for a in self.agents.values() if a.id != "pm" and not a.is_resting]
                for a in random.sample(idle, min(6,len(idle))):
                    await asyncio.sleep(1.5); await a.set_status("thinking")
                    r = await a.think(f"CHAT:\n{self.get_log()}\n\nBoss said: '{message}'. PM replied: '{pm_resp}'.\nIntroduce yourself and say what you're working on. 1-2 sentences.")
                    await a.say(r, "all", "chat"); await a.set_status("idle")
                return pm_resp
            import random
            active = [a for a in self.agents.values() if a.id != "pm" and not a.is_resting and a.status == "idle"]
            for a in random.sample(active, min(2,len(active))):
                await asyncio.sleep(2); await a.set_status("thinking")
                r = await a.think(f"CHAT:\n{self.get_log()}\n\nBoss said: '{message}'. PM: '{pm_resp}'.\nReact naturally in character. 1 sentence.")
                await a.say(r, "all", "chat"); await a.set_status("idle")
        finally: self.busy = False
        return pm_resp

    async def receive_command(self, command: str, priority: str="medium") -> str:
        pm = self.agents.get("pm"); task_id = str(uuid.uuid4())[:8]
        # Generate a short 2-3 word codename instead of slugifying the full command
        try:
            raw_name = await pm._call_llm(
                f"Give a short 2-3 word project codename (kebab-case, no articles) for: {command}\n"
                f"Examples: 'sakura-portfolio', 'task-api', 'chat-dashboard', 'shop-mobile'\n"
                f"Return ONLY the codename, nothing else.",
                max_tokens=20
            )
            if raw_name:
                project_name = re.sub(r'[^a-z0-9\-]','-',raw_name.strip().lower()[:30])
                project_name = re.sub(r'-+','-',project_name).strip('-')
            else:
                raise ValueError("empty")
        except Exception:
            # Fallback: take first 3 meaningful words from command
            words = re.sub(r'[^a-z0-9\s]','',command.lower()).split()
            stop = {'a','an','the','for','with','and','or','of','to','in','on','create','build','make','new','add'}
            words = [w for w in words if w not in stop and len(w)>2][:3]
            project_name = '-'.join(words) or "project"
        await pm.set_status("thinking")
        ack = await pm.think(f"CHAT:\n{self.get_log()}\n\nBoss gave a new project: '{command}'\nAcknowledge excitedly. Say you're activating the full 19-agent pipeline. 2 sentences.")
        await pm.say(ack, "all", "chat"); await pm.set_status("idle")
        asyncio.create_task(self._plan_and_assign(command, task_id, priority, project_name))
        return task_id

    def _select_agents_for_project(self, command: str) -> list:
        """
        Smart agent selection — not all 20 agents are needed for every project.
        Analyzes the command and returns only relevant agent IDs.
        This prevents quota burnout and speeds up delivery significantly.
        """
        cmd = command.lower()
        selected = []

        # Always include core planning
        selected += ["product", "architect"]

        # Design — always needed for any UI
        has_ui = any(w in cmd for w in ["website","web","app","portfolio","dashboard","landing","frontend","ui","interface","page"])
        if has_ui:
            selected += ["designer", "frontend"]

        # Mobile — only if explicitly requested
        if any(w in cmd for w in ["mobile","ios","android","react native","expo","app store"]):
            selected.append("mobile")

        # Backend — needed for any data/api/auth project
        has_backend = any(w in cmd for w in ["api","backend","database","auth","login","server","fastapi","express","crud","rest","graphql"])
        if has_backend or not has_ui:  # backend-only projects
            selected.append("backend")

        # Platform — only for real-time/payments/email features
        if any(w in cmd for w in ["payment","stripe","email","notification","websocket","realtime","real-time","queue","upload"]):
            selected.append("platform")

        # Data — only if database/data features mentioned
        if any(w in cmd for w in ["database","db","postgres","mysql","sqlite","migration","schema","analytics data"]):
            selected.append("data")

        # AI/ML — only if explicitly requested
        if any(w in cmd for w in ["ai","ml","machine learning","recommendation","search","embedding","rag","gpt","llm","chatbot"]):
            selected.append("aiml")

        # Analytics — for SaaS/product apps
        if any(w in cmd for w in ["analytics","tracking","metrics","dashboard","saas","product"]):
            selected.append("analytics")

        # Performance — for web projects
        if has_ui:
            selected.append("perf")

        # QA — always, but only one tester for simple projects
        selected.append("qa")
        if any(w in cmd for w in ["e2e","playwright","load test","complex","enterprise","saas","production"]):
            selected.append("sdet")

        # Security — for any auth/backend project
        if has_backend or any(w in cmd for w in ["auth","login","secure","payment"]):
            selected.append("security")

        # Infra — always for deployable projects
        selected.append("infra")

        # CI/CD — for any real project
        selected.append("github")

        # Review — always last
        selected.append("techlead")

        # Docs — always
        selected.append("blog")

        # SEO/Growth — for web/landing pages
        if has_ui:
            selected.append("growth")

        # Mizu — always last, integration
        selected.append("mizu")

        # Deduplicate preserving order
        seen = set()
        result = []
        for a in selected:
            if a not in seen:
                seen.add(a); result.append(a)
        return result

    async def _plan_and_assign(self, command: str, task_id: str, priority: str, project_name: str):
        pm = self.agents.get("pm"); self.busy = True
        try:
            await pm.set_status("working")
            self.task_manager.create_task(task_id, command[:100], command, "in_progress", "pm", priority)

            # Smart selection — only relevant agents
            selected_ids = self._select_agents_for_project(command)
            logger.info(f"Smart selection: {len(selected_ids)} agents for '{command[:40]}'")

            created = []
            for agent_id, stage_name, stage_priority, _ in PIPELINE:
                if agent_id not in selected_ids: continue
                a = self.agents.get(agent_id)
                if not a or a.is_resting: continue
                sid = str(uuid.uuid4())[:8]
                title = f"{stage_name}: {command[:50]}"
                desc = f"{command}\n\n[PROJECT_NAME:{project_name}]"
                self.task_manager.create_task(sid, title, desc, "assigned", agent_id, stage_priority, task_id)
                created.append((a, sid, title))
                logger.info(f"✅ {agent_id}: {title[:40]}")

            await pm.say(
                f"🚀 `{project_name}` — activating {len(created)} specialists. "
                f"{', '.join(a.name for a,_,_ in created[:6])}{'...' if len(created)>6 else ''} — let's ship it!",
                "all","task_update",task_id
            )
            await self.ws_manager.broadcast({"type":"project_created","project_name":project_name})
            await pm.set_status("idle")

            # Only first 5 agents acknowledge — avoids LLM spam
            import random
            for a, sid, title in created[:5]:
                await asyncio.sleep(0.8); await a.set_status("thinking")
                ack = await a.think(
                    f"PM assigned: '{title}'\n"
                    f"Acknowledge briefly. Say what 1-2 specific files you'll write. In character. 1 sentence."
                )
                await a.say(ack, "all", "task_update", sid)
                a.add_productivity(5); await a.set_status("idle")

        except Exception as e:
            logger.error(f"_plan_and_assign error: {e}", exc_info=True)
            await pm.say(f"Planning error: {str(e)[:80]}", "all", "chat")
        finally: self.busy = False

    async def handle_agent_action(self, agent_id: str, action: str, data: dict=None) -> dict:
        a = self.agents.get(agent_id)
        if not a: return {"error":"agent not found"}
        conv = self.get_log()
        if action == "pause": await a.set_status("idle"); await a.say("Taking a short break... 🍵","all"); return {"status":"paused"}
        elif action == "resume": await a.wake_up(); return {"status":"resumed"}
        elif action == "joke":
            import random
            jokes=["Why dark mode? Light attracts bugs! 😂","SQL: 'Can I JOIN you?'","QA: orders 1 beer, 0 beers, NULL beers. Server crashes.","CSS: looks simple until you try to center a div.","A senior dev immediately finds 3 bugs in the bar menu.","The PM said 2 weeks. The dev said 2 weeks. It took 6.","There are 10 types of people: those who understand binary, and those who don't."]
            await a.say(random.choice(jokes),"all","joke"); return {"status":"joke"}
        elif action == "ping":
            r = await a.think(f"CHAT:\n{conv}\n\nDescribe what you're working on specifically. 1-2 sentences in character.")
            await a.say(r,"all","chat"); return {"status":"pinged","message":r}
        return {"status":"unknown"}

    async def resume_from_checkpoint(self) -> dict:
        yesterday = (datetime.now()-timedelta(days=1)).date().isoformat()
        db = get_db(); cp = db.execute("SELECT * FROM checkpoints WHERE date=?",(yesterday,)).fetchone(); db.close()
        pm = self.agents.get("pm")
        if cp:
            await pm.say("☀️ Ohayou! Resuming from yesterday. Full team, let's continue! Yoroshiku!","all","status")
            import random
            for a in random.sample(list(self.agents.values()), min(5,len(self.agents))):
                if not a.is_resting:
                    await asyncio.sleep(1.5); await a.set_status("thinking")
                    r = await a.think("New day! Resuming from yesterday. Say you're back and ready. 1 sentence in character.")
                    await a.say(r,"all","status"); await a.set_status("idle")
            return {"status":"resumed"}
        else:
            await pm.say("☀️ Ohayou! Fresh start. 19-agent team fully assembled. Yoroshiku!","all","status")
            return {"status":"fresh_start"}

    async def save_checkpoint(self):
        from datetime import date
        db = get_db()
        p = [dict(t) for t in db.execute("SELECT id FROM tasks WHERE status IN ('assigned','in_progress')").fetchall()]
        state = json.dumps({"pending_tasks":[t["id"] for t in p]})
        today = date.today().isoformat()
        db.execute("INSERT OR REPLACE INTO checkpoints (id,date,state,pending_tasks) VALUES (?,?,?,?)",(str(uuid.uuid4()),today,state,json.dumps([t["id"] for t in p])))
        db.commit(); db.close()