import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@okun/db';
import { creativeSets, creativeImages } from '@okun/db/schema';
import { eq, desc } from 'drizzle-orm';
import { CreativeSetCard } from '@/components/creatives/creative-set-card';
import { EmptyState } from '@okun/ui';
import { Wand2 } from 'lucide-react';

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { workspaceMemberships } = await import('@okun/db/schema');
  const { workspaces } = await import('@okun/db/schema');
  const row = await db.select({ workspaceId: workspaceMemberships.workspaceId })
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.userId, userId))
    .limit(1);
  return row[0]?.workspaceId ?? null;
}

export default async function CreativesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) redirect('/onboarding');

  const sets = await db.select().from(creativeSets)
    .where(eq(creativeSets.workspaceId, workspaceId))
    .orderBy(desc(creativeSets.createdAt))
    .limit(50);

  const setsWithImages = await Promise.all(
    sets.map(async (set) => {
      const images = await db.select().from(creativeImages)
        .where(eq(creativeImages.setId, set.id));
      return { ...set, images };
    })
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content-primary">Creatives</h1>
        <p className="text-sm text-content-secondary mt-1">
          KI-generierte Werbemittel — erstellt via Copilot mit DALL-E 3
        </p>
      </div>

      {setsWithImages.length === 0 ? (
        <EmptyState
          icon={<Wand2 className="w-8 h-8" />}
          title="Noch keine Creatives"
          description='Öffne den Copilot und schreib z.B. "Erstelle Creatives für meine Immobilien-Kampagne"'
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {setsWithImages.map((set) => (
            <CreativeSetCard key={set.id} set={set} />
          ))}
        </div>
      )}
    </div>
  );
}
