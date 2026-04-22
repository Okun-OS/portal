# ADR-0003: Analytics-Store — Tinybird vs. Self-hosted ClickHouse

**Status:** Accepted  
**Datum:** 2026-04-22

---

## Entscheidung

**Tinybird** (Managed ClickHouse-as-a-Service)

## Begründung

- **Kein Ops-Aufwand**: kein separater Railway-Service, kein Backup, kein Tuning
- **REST-API OOTB**: `fetch('https://api.tinybird.co/v0/pipes/...')` — direkt in tRPC-Resolver nutzbar
- **Echtzeit-Ingestion**: Events über Events-API senden, Latenz < 1s
- **Free Tier**: 1GB/Monat Storage, ausreichend für Phase 0–1

## Konsequenzen

- `TINYBIRD_API_KEY` als Env-Var
- Tracking-Events gehen NICHT in Postgres (kein `tracking_events`-Table)
- Tinybird-Pipes definieren die Analytics-Queries (versioniert in `packages/db/tinybird/`)
- Bei > 50GB/Monat: Self-hosted ClickHouse auf Railway erwägen
