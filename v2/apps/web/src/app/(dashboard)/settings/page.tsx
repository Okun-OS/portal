'use client';

import { Building2, Bell, Shield, Palette, Plug } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Tabs, TabsList, TabsTrigger, TabsContent, Input, Label, Button, Switch, Badge } from '@okun/ui';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: workspace } = trpc.workspaces.getCurrent.useQuery();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-2 px-6 py-4 shrink-0">
        <h1 className="text-base font-semibold text-content-primary">Einstellungen</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="workspace">
            <TabsList>
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="notifications">Benachrichtigungen</TabsTrigger>
              <TabsTrigger value="integrations">Integrationen</TabsTrigger>
              <TabsTrigger value="security">Sicherheit</TabsTrigger>
            </TabsList>

            <TabsContent value="workspace">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace-Einstellungen</CardTitle>
                  <CardDescription>Verwalte deinen Workspace und deine Organisation.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Workspace-Name</Label>
                    <Input defaultValue={workspace?.name ?? ''} placeholder="Mein Workspace" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Plan</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="brand">{workspace?.plan ?? 'free'}</Badge>
                      <Button variant="outline" size="sm">Upgrade</Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => toast.success('Einstellungen gespeichert')}
                    className="w-fit"
                  >
                    Speichern
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Benachrichtigungen</CardTitle>
                  <CardDescription>Konfiguriere wann und wie du benachrichtigt wirst.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {[
                    { label: 'Neuer Lead', desc: 'Benachrichtigung bei neuen Leads' },
                    { label: 'Rechnung überfällig', desc: 'Erinnerung bei überfälligen Rechnungen' },
                    { label: 'Kampagne pausiert', desc: 'Wenn eine Kampagne automatisch pausiert wird' },
                    { label: 'AI Score Alert', desc: 'Bei ungewöhnlich hohem/niedrigen Lead-Score' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-content-primary">{item.label}</p>
                        <p className="text-xs text-content-secondary">{item.desc}</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations">
              <div className="flex flex-col gap-4">
                {[
                  { name: 'Meta Ads', desc: 'Kampagnen-Sync mit Meta Business', icon: '📘', connected: false },
                  { name: 'Google Ads', desc: 'Kampagnen-Sync mit Google Ads', icon: '🔍', connected: false },
                  { name: 'Stripe', desc: 'Online-Zahlungen für Rechnungen', icon: '💳', connected: false },
                  { name: 'Resend', desc: 'Transaktionale E-Mails', icon: '📧', connected: false },
                ].map((integration) => (
                  <Card key={integration.name}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{integration.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">{integration.name}</p>
                          <p className="text-xs text-content-secondary">{integration.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={integration.connected ? 'success' : 'outline'}>
                          {integration.connected ? 'Verbunden' : 'Nicht verbunden'}
                        </Badge>
                        <Button variant="outline" size="sm">
                          {integration.connected ? 'Trennen' : 'Verbinden'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Sicherheit</CardTitle>
                  <CardDescription>Verwalte Zugriffsrechte und Sicherheitseinstellungen.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-content-primary">Zwei-Faktor-Authentifizierung</p>
                      <p className="text-xs text-content-secondary">Zusätzliche Sicherheit für dein Konto</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-content-primary">Session-Timeout</p>
                      <p className="text-xs text-content-secondary">Automatisch nach Inaktivität ausloggen</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
