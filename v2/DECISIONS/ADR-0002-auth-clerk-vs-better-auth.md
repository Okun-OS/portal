# ADR-0002: Auth — Clerk vs. Better-Auth

**Status:** Accepted  
**Datum:** 2026-04-22  
**Entscheider:** Okun Leads Team

---

## Entscheidung

**Clerk** mit Multi-Tenant Org-Mode

## Begründung

### Erforderliche Features
| Feature | Clerk | Better-Auth |
|---------|-------|-------------|
| Magic Link Login | ✅ OOTB | ✅ Plugin |
| SSO Google/Microsoft | ✅ OOTB | ⚠️ Eigener Code |
| Multi-Tenant Orgs + Rollen | ✅ OOTB | ⚠️ Eigener Code |
| Einladungs-Flow | ✅ OOTB | ⚠️ Eigener Code |
| Audit-Log | ✅ OOTB | ❌ Selbst bauen |
| JWT-Rotation | ✅ Automatisch | ✅ Konfigurierbar |
| Session-Management | ✅ OOTB | ✅ OOTB |

### Kosten-Analyse
- Free Tier: 10.000 MAU — für Phase 0–2 ausreichend
- Bei Scale: $25/Monat für 10k+ MAU — dann hat v2 Revenue genug
- Better-Auth: keine direkten SaaS-Kosten, aber Dev-Zeit für SSO + Org-Mode ≈ 2 Wochen

### Risiken Clerk
- Externer Vendor-Lock-In
- Preis-Änderungen möglich
- **Mitigation**: Auth-Interface-Layer in `src/modules/iam/` abstrahiert Clerk — Migration zu Better-Auth later möglich ohne App-Code-Änderungen

## Konsequenzen

- `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` als Env-Vars
- Clerk Org = Workspace in v2-Domain
- RLS-Setup: `workspaceId` wird aus Clerk Org-ID abgeleitet und per Drizzle-Middleware als `app.workspace_id` gesetzt
- Kein eigenes User/Session-Management nötig
