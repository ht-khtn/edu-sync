"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

interface CategoryTab {
  value: string;
  label: string;
  content: ReactNode;
}

interface CategoryTabsProps {
  tabs: CategoryTab[];
  defaultTab?: string;
}

export function CategoryTabs({ tabs, defaultTab }: CategoryTabsProps) {
  return (
    <Tabs defaultValue={defaultTab || tabs[0]?.value} className="w-full">
      <TabsList
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
