# Migration v1 → v2

## Überblick

v1 (Express + SQLite) läuft parallel während v2 (Next.js + Postgres) gebaut wird.
Cutover erfolgt nach vollständiger Feature-Parität (Phase 3 Ende).

---

## Cutover-Plan

### Pre-Cutover (Phase 1–3)
- v1 läuft auf `portal-production-7a66.up.railway.app`
- v2 läuft auf `v2.portal-production-7a66.up.railway.app`
- Staging-DB für v2 (kein Zugriff auf v1-Produktions-DB)
- Interne Dogfooding-Phase ab Phase 1 DoD

### Cutover-Day
1. **Migration-Script ausführen** (Dry-Run zuerst, dann Live):
   ```bash
   cd v2 && npx tsx scripts/migrate-from-v1.ts --dry-run
   npx tsx scripts/migrate-from-v1.ts --live
   ```
2. **DNS-Switch**: `portal-production-7a66.up.railway.app` → v2-Service
3. **v1 unter Legacy-URL**: `legacy.portal-production-7a66.up.railway.app` (30 Tage lesbar)
4. **v1 nach 30 Tagen**: Read-Only-Archiv-Mode

### Rollback-Plan
- Railway: Traffic in < 1 Minute auf v1-Service zurückrouten
- v2-DB-Snapshot vor Cutover (Railway-Backup)
- v1-Daten niemals gelöscht bis Cutover erfolgreich bestätigt

---

## Breaking Changes (wird laufend erweitert)

| Version | Change | Impact | Migration |
|---------|--------|--------|-----------|
| v2.0 | SQLite → PostgreSQL | Breaking | `migrate-from-v1.ts` |
| v2.0 | Express → Next.js API Routes | Breaking | Neue URL-Struktur |
| v2.0 | Single-Tenant → Multi-Tenant | Breaking | workspace_id für alle Entities |
| v2.0 | Flat auth → Clerk Org-Mode | Breaking | User-Migration per Skript |
| v2.0 | `/api/admin/*` → tRPC | Breaking | Client-Code updaten |
| v2.0 | `/public/f/*` Funnels | Depreciert | Neuer Landing-Page-Builder |

---

## Migration-Script

Datei: `v2/scripts/migrate-from-v1.ts`

Migriert aus der v1-SQLite-DB:
- `customers` → `customers` (mit workspace_id)
- `leads` → `leads` (mit workspace_id)
- `campaigns` → `campaigns` (mit workspace_id)
- `documents` → `documents` (mit workspace_id)
- `users` → Clerk-User-Erstellung via Management API

### Ausführen

```bash
# Dry-Run (gibt Diff aus, schreibt nichts)
SQLITE_PATH=/app/data/portal.db \
DATABASE_URL=postgresql://... \
CLERK_SECRET_KEY=sk_... \
npx tsx scripts/migrate-from-v1.ts --dry-run

# Live-Migration
... --live
```

---

_Zuletzt aktualisiert: 2026-04-22_
