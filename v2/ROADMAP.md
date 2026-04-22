# Okun Leads v2 — Roadmap

> Status-Legende: ⬜ Geplant | 🔄 In Arbeit | ✅ Fertig | 🚫 Blockiert

---

## Phase 0 — Fundament (Wochen 1–4)

| Item | Status | Notes |
|------|--------|-------|
| Turborepo Monorepo Setup | 🔄 | `v2/` Verzeichnis, Workspaces konfiguriert |
| `@okun/ui` Design-System Skeleton | 🔄 | Tailwind v4 + shadcn/ui + Token-System |
| Auth-Modul (Clerk, Multi-Tenant Orgs) | 🔄 | Magic Link + SSO Google/Microsoft |
| Workspace-Tabelle + RLS-Policies | 🔄 | Drizzle + Postgres 16 |
| tRPC v11 Layer + Zod-Schemas Baseline | 🔄 | API-First, kein UI-exklusiver DB-Zugriff |
| Command Palette Skeleton (⌘K) | 🔄 | cmdk-Library |
| CI/CD + Preview Deployments | ⬜ | GitHub Actions + Railway (manueller Step) |
| Observability Basis (Sentry + PostHog) | ⬜ | Env-Vars konfigurieren |
| **DoD: Login + Workspace-Create + leere Shell** | ⬜ | |

## Phase 1 — Pipeline (Wochen 5–12)

| Item | Status | Notes |
|------|--------|-------|
| Leads-Modul: Erfassung (manuell + API + Webhook) | ⬜ | |
| Leads-Modul: Auto-Enrichment (Apollo.io) | ⬜ | |
| Leads-Modul: AI Lead Scoring (Claude) | ⬜ | |
| Leads-Modul: Kanban-View (Drag & Drop) | ⬜ | |
| Leads-Modul: Tabellen-View (TanStack Virtual) | ⬜ | |
| Leads-Modul: Bulk-Import CSV + Duplikat-Erkennung | ⬜ | |
| Leads-Modul: Unified Inbox (IMAP Gmail/Outlook) | ⬜ | |
| Customers-Modul: Lead → Customer 1-Click | ⬜ | |
| Customers-Modul: Health Score (AI) | ⬜ | |
| Split-Pane UI Pattern | ⬜ | |
| Copilot v1: Read-Only Queries Leads/Customers | ⬜ | |
| **DoD: Lead-to-Customer-Flow end-to-end** | ⬜ | |

## Phase 2 — Kampagnen (Wochen 13–20)

| Item | Status | Notes |
|------|--------|-------|
| Campaigns-Modul: Campaign → AdSet → Ad | ⬜ | |
| Meta Ads API v19+ bidirektionaler Sync | ⬜ | |
| Google Ads API bidirektionaler Sync | ⬜ | |
| AI Campaign Builder (Claude) | ⬜ | |
| A/B-Test-Engine | ⬜ | |
| Creatives-Modul: Brand-Kit | ⬜ | |
| Creatives-Modul: AI Creative Studio | ⬜ | |
| Tracking: Server-Side, cookieless | ⬜ | |
| Tracking: Landing Page Builder (MVP) | ⬜ | |
| Analytics: Explorer-Mode | ⬜ | Tinybird |
| Analytics: Anomaly Detection | ⬜ | Inngest Job |
| **DoD: Kunde → Kampagne → Creative → Landing → Track** | ⬜ | |

## Phase 3 — Business (Wochen 21–26)

| Item | Status | Notes |
|------|--------|-------|
| Billing: Rechnungs-Engine (§14 UStG) | ⬜ | |
| Billing: ZUGFeRD + XRechnung | ⬜ | |
| Billing: Stripe + GoCardless | ⬜ | |
| Billing: Mahnwesen (3 Stufen) | ⬜ | |
| Billing: DATEV-Export | ⬜ | |
| Documents-Modul | ⬜ | Cloudflare R2 |
| Angebots-Modul + E-Signatur | ⬜ | |
| Client-Portal Beta (Read-Only) | ⬜ | |
| **DoD: Lead → bezahlte Rechnung automatisiert** | ⬜ | |

## Phase 4 — Breakthrough (ab Woche 27)

| Item | Status | Notes |
|------|--------|-------|
| Automation-Builder (Zapier-Style intern) | ⬜ | |
| Agent-Mode (Nightly Optimierungen) | ⬜ | |
| Client-Chat-Bot (WhatsApp + Slack) | ⬜ | |
| Developer-Platform (Public API + Zapier) | ⬜ | |
| Mobile-App (React Native) | ⬜ | Bei Traction |
| TikTok Ads Integration | ⬜ | |

---

## Migration v1 → v2

| Item | Status |
|------|--------|
| `scripts/migrate-from-v1.ts` schreiben | ⬜ |
| Dry-Run auf Staging-Copy testen | ⬜ |
| Cutover-Plan finalisieren | ⬜ |
| DNS-Switch vorbereiten | ⬜ |

---

_Zuletzt aktualisiert: 2026-04-22_
