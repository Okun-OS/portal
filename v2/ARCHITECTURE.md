# Okun Leads v2 — Architecture

## 1. Leitsatz

> „Ein Ads-Operations-OS für Performance-Agenturen — von der Lead-Erfassung bis zur bezahlten Rechnung, mit einem KI-Copiloten, der die Routine wegnimmt, und einem Kunden-Portal, das Transparenz als Feature verkauft."

---

## 2. Drei harte Prämissen

1. **Multi-Tenant von Tag 1.** Jede Entity trägt `workspace_id`. Postgres Row Level Security erzwingt Tenant-Isolation auf DB-Ebene — kein Applikationscode kann das umgehen.
2. **Client-Facing von Tag 1.** Datenmodell erlaubt Read-Zugang für Endkunden der Agentur. Client-Portal ist keine Nachbetrachtung.
3. **AI-nativ von Tag 1.** Jede Domain-Entity speichert genug Kontext für LLM-Operationen (Summary, Scoring, Generation).

---

## 3. Architektur-Paradigmen

### 3.1 Event-Sourced Core
Jede zustandsverändernde Aktion → Domain-Event in `events`-Tabelle (append-only).
Aktueller Zustand = Projection. Vorteile: Audit-Trail, Zeitreise, Replay, Automation-Trigger.

```
Command → CommandHandler → DomainEvent → EventStore
                                       ↓
                              Projection (READ-Model)
                                       ↓
                           tRPC Query Result (UI)
```

### 3.2 API-First mit tRPC
Eine kanonische API. Web-UI, Mobile, Slack-Bot, Zapier, Client-Portal = Clients derselben API.
Niemals UI-exklusive DB-Queries.

### 3.3 Modularer Monolith (Bounded Contexts)
```
src/modules/
├── iam/          # Auth, Workspaces, Rollen, Audit-Log
├── leads/        # Lead-Erfassung, -Scoring, -Inbox
├── customers/    # Customer-Verwaltung, Health-Score
├── campaigns/    # Campaign → AdSet → Ad, Sync
├── creatives/    # Brand-Kit, AI-Studio, Approval
├── tracking/     # Server-Side Tracking, LP-Builder
├── analytics/    # Explorer, Reports, Alerts (Tinybird)
├── billing/      # Rechnungen, ZUGFeRD, Stripe
├── documents/    # File-Storage, Suche, Share-Links
├── automation/   # Workflow-Builder, Trigger/Action
├── copilot/      # Okun Copilot, Agent-Mode
└── clientPortal/ # Kunden-Read-View, Chat-Bot
```

Jedes Modul:
```
{module}/
├── domain/         # Entities, Value Objects, Domain Events
├── application/    # Use Cases, Command/Query Handlers
├── infrastructure/ # DB-Queries, External APIs, Jobs
└── api/            # tRPC Router für dieses Modul
```

Cross-Modul-Kommunikation: nur über Domain-Events oder explizite Public-Services. Kein direkter Import von `infrastructure/` eines anderen Moduls.

### 3.4 Realtime-Fabric
Postgres `LISTEN/NOTIFY` + WebSocket-Gateway (Next.js Route Handler mit `EventSource`).
Lead-Detail, Kanban-Board, Kampagnen-Editor: realtime-fähig.
Presence-Indicators via eigenes lightweight Registry.

### 3.5 Row-Level Security
```sql
-- Beispiel-Policy für leads-Tabelle
CREATE POLICY workspace_isolation ON leads
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```
Gesetzt per Drizzle-Middleware vor jedem Request:
```ts
db.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`);
```

---

## 4. Tech-Stack

| Bereich | Technologie | Begründung |
|---------|-------------|------------|
| Frontend | Next.js 15, React 19, App Router, RSC | SSR, SEO, Performance |
| API | tRPC v11 + Zod | Type-safe End-to-End, kein REST-Boilerplate |
| State | TanStack Query v5 + Zustand | Server-State vs. UI-State getrennt |
| Styling | Tailwind CSS v4 + shadcn/ui + @okun/ui | Design-System mit Custom Tokens |
| Motion | Framer Motion | Micro-Interactions, Page-Transitions |
| DB | PostgreSQL 16 + Drizzle ORM | Migrations, RLS, pgvector für RAG |
| Analytics-Store | Tinybird | Managed ClickHouse, REST-API, kein Ops |
| Background Jobs | Inngest | Retries, Rate-Limits, Observability OOTB |
| Search | Typesense | Fuzzy-Search, schnelles Setup |
| AI | Vercel AI SDK + Claude Sonnet 4.6 | Streaming, Tool-Calling, RAG |
| Auth | Clerk (Multi-Tenant Org-Mode) | SSO, Magic Link, Invitations OOTB |
| File Storage | Cloudflare R2 | S3-kompatibel, günstiger |
| E-Mail | Resend + React Email | Developer-friendly, Templates in React |
| Observability | Sentry + PostHog + OpenTelemetry | Errors + Product-Analytics + Traces |
| Deployment | Railway | v1 + v2 als separate Services |
| Monorepo | Turborepo | Build-Caching, Workspace-Linking |

---

## 5. Informations-Architektur

### 5.1 Top-Level Navigation (drei Bereiche)
```
Pipeline     → Leads, Customers, Unified Inbox
Kampagnen    → Campaigns, Creatives, Landing Pages, Tracking, Analytics
Business     → Dokumente, Angebote, Rechnungen, Reports
```
Plus: Settings, Notifications, Workspace-Switcher.

### 5.2 Command Palette (⌘K)
Primäre Navigation. Globale Suche + Aktions-Shortcuts + Copilot-Einstieg.
Raycast-Style, Keyboard-first.

### 5.3 Navigation-Config
```ts
// src/config/navigation.ts — EINZIGE Quelle der Wahrheit
// Sidebar, Breadcrumbs, Command-Palette-Einträge werden daraus generiert.
```

---

## 6. UI-Patterns (verbindlich)

- **Split-Pane** statt Modals für alle Listen-Detail-Flows
- **Inline-Edit** mit optimistischem UI + Auto-Save
- **Mehrere Views**: Tabelle / Kanban / Kalender
- **Virtualisierte Tabellen**: TanStack Table + TanStack Virtual
- **Dark Mode** first-class, System-Default
- **Micro-Interactions**: grüner Pulse für Save, Skeleton-Loader
- **Keyboard-Shortcuts**: `?`-Overlay, J/K navigieren, E editiert, / sucht
- **Presence-Indicators**: Avatars + Live Cursors
- **WCAG 2.2 AA**: Focus-Rings, ARIA-Labels, kein Klick-Only

---

## 7. Deployment-Topologie

```
Railway Service A (v1 = legacy)
  → Branch: claude/lead-management-system-ePcAP
  → URL: portal-production-7a66.up.railway.app
  → DB: SQLite (persistenter Volume-Mount)

Railway Service B (v2 = neu) [MANUELL ANLEGEN]
  → Branch: v2/rebuild (nach PR-Merge)
  → URL: v2.portal-production-7a66.up.railway.app
  → DB: PostgreSQL 16 (Railway Postgres Plugin)
  → Preview-Deployments: pro PR automatisch
```

### Manuell erforderlich (Claude kann das nicht):
1. Neues Railway-Service anlegen mit eigenem Postgres-Plugin
2. Branch `v2/rebuild` koppeln
3. Env-Vars setzen (Clerk, Tinybird, Resend, Sentry, PostHog, R2)
4. GitHub Secret `RAILWAY_TOKEN` für CI/CD

---

## 8. Sicherheit

- OWASP Top 10 per Snyk in CI
- RLS auf jeder Tabelle (kein Bypass möglich)
- Clerk handhabt JWT-Rotation
- API-Keys hashen (nie plaintext in DB)
- File-Uploads: Typ-Whitelist + Virus-Scan (Cloudflare)
- CSP-Headers via Next.js middleware
- Jährliches Pentest vor GA

---

_Zuletzt aktualisiert: 2026-04-22_
