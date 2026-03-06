import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import AdminUsers from '@/components/AdminUsers';
import AdminTournaments from '@/components/AdminTournaments';
import AdminDraft from '@/components/AdminDraft';
import AdminSettings from '@/components/AdminSettings';
import AdminGolfers from '@/components/AdminGolfers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Admin() {
  const [tab, setTab] = useState('tournaments');

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6">
        <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tournaments">
            <AdminTournaments />
          </TabsContent>
          <TabsContent value="draft">
            <AdminDraft />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
