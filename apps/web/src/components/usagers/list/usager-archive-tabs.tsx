import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UsagerArchiveTabsProps {
  activeTab: "current" | "archived";
  onTabChange: (tab: "current" | "archived") => void;
  isLoading: boolean;
  currentCount: number;
  archivedCount: number;
}

export function UsagerArchiveTabs({
  activeTab,
  onTabChange,
  isLoading,
  currentCount,
  archivedCount,
}: UsagerArchiveTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as "current" | "archived")}
    >
      <TabsList>
        <TabsTrigger value="current" className="cursor-pointer">
          Courants
          {!isLoading && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
              {currentCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="archived" className="cursor-pointer">
          Archivés
          {!isLoading && archivedCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs">
              {archivedCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
