import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  group?: string;
  keywords?: string[];
  badge?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'crm',
    label: 'CRM',
    items: [
      {
        id: 'pipeline',
        label: 'Pipeline',
        href: '/pipeline',
        icon: 'Kanban',
        keywords: ['leads', 'pipeline', 'kanban'],
      },
      {
        id: 'customers',
        label: 'Kunden',
        href: '/customers',
        icon: 'Building2',
        keywords: ['kunden', 'customers', 'clients'],
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      {
        id: 'campaigns',
        label: 'Kampagnen',
        href: '/campaigns',
        icon: 'Megaphone',
        keywords: ['kampagnen', 'campaigns', 'ads'],
      },
      {
        id: 'funnels',
        label: 'Funnels',
        href: '/funnels',
        icon: 'Filter',
        keywords: ['funnels', 'landing pages'],
      },
    ],
  },
  {
    id: 'ai',
    label: 'KI',
    items: [
      {
        id: 'copilot',
        label: 'Copilot',
        href: '/copilot',
        icon: 'Bot',
        keywords: ['copilot', 'ai', 'assistent', 'chat'],
        badge: 'NEU',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Abrechnung',
    items: [
      {
        id: 'invoices',
        label: 'Rechnungen',
        href: '/invoices',
        icon: 'FileText',
        keywords: ['rechnungen', 'invoices', 'billing'],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    items: [
      {
        id: 'settings',
        label: 'Einstellungen',
        href: '/settings',
        icon: 'Settings',
        keywords: ['settings', 'einstellungen', 'config'],
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.label }))
);
