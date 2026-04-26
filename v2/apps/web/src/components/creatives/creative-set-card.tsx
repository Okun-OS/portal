'use client';

import { Download, ImageIcon } from 'lucide-react';
import { Badge } from '@okun/ui';
import { cn } from '@okun/ui';

interface CreativeImage {
  id: string;
  format: 'square' | 'story' | 'landscape';
  width: number;
  height: number;
  imageUrl: string;
}

interface CreativeSet {
  id: string;
  hookConcept: string;
  hookType: string;
  adCopy: string | null;
  status: string;
  createdAt: Date;
  images: CreativeImage[];
}

const HOOK_LABELS: Record<string, string> = {
  pain: 'Schmerz',
  social_proof: 'Soziale Bewährtheit',
  curiosity: 'Neugier',
  offer: 'Angebot',
};

const FORMAT_LABELS: Record<string, string> = {
  square: 'Feed 1:1',
  story: 'Stories 9:16',
  landscape: 'Display 16:9',
};

const FORMAT_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  story: 'aspect-[9/16]',
  landscape: 'aspect-video',
};

export function CreativeSetCard({ set }: { set: CreativeSet }) {
  const handleDownload = async (url: string, format: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `creative-${set.id}-${format}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="rounded-xl border border-surface-2 bg-surface-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">{HOOK_LABELS[set.hookType] ?? set.hookType}</Badge>
            {set.status === 'generating' && <Badge variant="outline">Generiert…</Badge>}
            {set.status === 'error' && <Badge variant="destructive">Fehler</Badge>}
          </div>
          <p className="text-sm font-medium text-content-primary truncate">{set.hookConcept}</p>
          {set.adCopy && (
            <p className="text-xs text-content-tertiary mt-0.5 line-clamp-2">{set.adCopy}</p>
          )}
        </div>
        <span className="text-xs text-content-tertiary whitespace-nowrap shrink-0">
          {new Date(set.createdAt).toLocaleDateString('de-DE')}
        </span>
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        {set.images.length === 0 && set.status === 'generating' && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-surface-2 animate-pulse flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-content-tertiary" />
            </div>
          ))
        )}
        {set.images.map((img) => (
          <div key={img.id} className="group relative">
            <div className={cn('rounded-lg overflow-hidden bg-surface-2', FORMAT_ASPECT[img.format])}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={FORMAT_LABELS[img.format]}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-content-tertiary">{FORMAT_LABELS[img.format]}</span>
              <button
                onClick={() => handleDownload(img.imageUrl, img.format)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-2"
                title="Herunterladen"
              >
                <Download className="w-3 h-3 text-content-secondary" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
