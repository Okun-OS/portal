#!/bin/bash
# Baut .env.local aus Codespace-Secrets automatisch zusammen

ENV_FILE="/workspaces/portal/v2/apps/web/.env.local"

if [ -f "$ENV_FILE" ]; then
  echo "✓ .env.local existiert bereits"
  exit 0
fi

echo "→ Erstelle .env.local aus Codespace-Secrets..."

cat > "$ENV_FILE" <<EOF
# Automatisch generiert von .devcontainer/setup.sh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-}
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/pipeline
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/pipeline

DATABASE_URL=${DATABASE_URL:-}

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}

NEXT_PUBLIC_APP_URL=https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}
EOF

echo "✓ .env.local erstellt"
echo "→ Starte DB-Migration..."
cd /workspaces/portal/v2 && pnpm db:push 2>/dev/null || true
echo "✓ Fertig! Starte mit: pnpm dev --filter @okun/web"
