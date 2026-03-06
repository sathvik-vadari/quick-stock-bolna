"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryPanel } from "@/components/query-panel";
import { TrackingPanel } from "@/components/tracking-panel";
import { Search, ClipboardList } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4">
        <header className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight">QuickStock</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI voice agent calls nearby stores to check availability for you
          </p>
        </header>

        <Tabs defaultValue="query" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="query" className="gap-1.5 text-xs sm:text-sm">
              <Search className="h-3.5 w-3.5" />
              New Query
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5" />
              Track Query
            </TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="mt-3" forceMount>
            <QueryPanel />
          </TabsContent>

          <TabsContent value="tracking" className="mt-3" forceMount>
            <TrackingPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
