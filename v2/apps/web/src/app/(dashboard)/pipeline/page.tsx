import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pipeline' };

export default function PipelinePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-content-primary)]">Pipeline</h1>
        <p className="text-sm text-[var(--color-content-tertiary)] mt-1">
          Lead-Kanban-Board — kommt in Phase 1
        </p>
      </div>

      {/* Placeholder kanban columns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['Neu', 'Qualifiziert', 'Angebot', 'Abgeschlossen'].map((col) => (
          <div
            key={col}
            className="bg-[var(--color-surface-1)] rounded-[var(--radius-lg)] border border-[var(--color-surface-3)] p-4 min-h-[200px]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-content-tertiary)]">
                {col}
              </span>
              <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-content-tertiary)] px-2 py-0.5 rounded-full">
                0
              </span>
            </div>
            <p className="text-xs text-[var(--color-content-tertiary)] text-center mt-10">
              Keine Leads
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
