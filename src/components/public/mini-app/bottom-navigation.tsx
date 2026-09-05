"use client";

import { ClipboardList, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MiniAppTab } from "./types";

export function BottomNavigation({ activeTab, onChange }: { activeTab: MiniAppTab; onChange: (tab: MiniAppTab) => void }) {
  const tabs = [
    { id: "create" as const, label: "ትዕዛዝ ፍጠር", icon: Plus },
    { id: "orders" as const, label: "የእኔ ትዕዛዞች", icon: ClipboardList },
    { id: "profile" as const, label: "መገለጫ", icon: User },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/[0.08] bg-[#121316]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button key={tab.id} type="button" onClick={() => onChange(tab.id)} className={cn("flex-1 py-3 text-[11px] font-semibold flex flex-col items-center gap-1", activeTab === tab.id ? "text-[#E5C07B] border-b-2 border-[#E5C07B]" : "text-neutral-500")}>
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
