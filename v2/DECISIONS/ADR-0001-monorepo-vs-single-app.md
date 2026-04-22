# ADR-0001: Turborepo Monorepo vs. Single Next.js App

**Status:** Accepted  
**Datum:** 2026-04-22  
**Entscheider:** Okun Leads Team

---

## Kontext

Für v2 musste entschieden werden: Monorepo mit Turborepo oder eine einzelne Next.js-Applikation.

## Entscheidung

**Turborepo Monorepo**

## Struktur

```
/
├── apps/
│   └── web/              # Next.js 15 (Haupt-Applikation)
├── packages/
│   ├── ui/               # @okun/ui — Design-System
│   ├── db/               # @okun/db — Drizzle Schema + Migrations
│   ├── trpc/             # @okun/trpc — tRPC Router + Types
│   └── config/           # Shared ESLint, TypeScript, Tailwind Config
├── turbo.json
└── package.json
```

## Begründung

### Dafür: Turborepo
- **Phase 4 Mobile-App**: React Native App kann als `apps/mobile` hinzukommen und `@okun/ui` (Primitives) + `@okun/trpc` teilen — ohne Umbau
- **Shared Types**: tRPC-Typen, Zod-Schemas, DB-Typen einmal definiert in `packages/trpc` und `packages/db`, von allen Apps importiert
- **Build-Caching**: Turborepo cached geänderte Packages — CI wird schneller mit mehr Apps
- **Klare Grenzen**: DB-Schema-Änderungen in `packages/db` sind sofort für alle Apps sichtbar

### Dagegen: Mehr Overhead
- Komplexere initiale Konfiguration
- Node_modules-Linking erfordert sorgfältige Peer-Dependency-Verwaltung
- Ein Team < 5 Devs profitiert weniger von Build-Parallelism

## Abgewogene Alternative: Single Next.js App

`src/packages/ui` als Ordner-Konvention statt echter Workspace.
Einfacher für ein Team, keine Turborepo-Konfiguration.
**Abgelehnt**, weil die Mobile-App (Phase 4) und eventuelle separate Client-Portal-App ohne Monorepo schwierig zu realisieren sind.

## Konsequenzen

- Alle PRs müssen `turbo build` + `turbo lint` + `turbo test` grün haben
- Package-Versionen zentral in `package.json` des Roots verwaltet (Catalog-Pattern)
- Neue Applikation hinzufügen: `apps/` Ordner anlegen, in `turbo.json` eintragen
