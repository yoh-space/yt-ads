"use client";

import { BellRing, BellOff, Volume2, VolumeX, Zap } from "lucide-react";
import { useSoundStore } from "@/store/useSoundStore";
import { useNotification } from "@/hooks/useNotification";
import { cn } from "@/lib/utils";

export function SoundControl({ className }: { className?: string }) {
  const isMuted = useSoundStore((state) => state.isMuted);
  const toggleSound = useSoundStore((state) => state.toggleSound);
  const { triggerNotification } = useNotification();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        aria-pressed={!isMuted}
        aria-label={isMuted ? "Unmute notifications" : "Mute notifications"}
        title={isMuted ? "Audio notifications muted" : "Audio notifications active"}
        onClick={toggleSound}
        className="relative grid h-[34px] w-[34px] place-items-center rounded-lg border border-border-token bg-surface-elevated text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
      >
        {isMuted ? (
          <VolumeX size={19} aria-hidden="true" />
        ) : (
          <>
            <Volume2 size={19} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-status-success"
            />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => triggerNotification({ title: "Incoming Order", body: "A new customer order just arrived in the queue." })}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-brand-primary/40 bg-brand-primary-bg px-3 text-xs font-semibold text-brand-primary-light transition-colors hover:bg-brand-primary/20"
      >
        <Zap size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Simulate Incoming Order</span>
        <span className="sm:hidden">{isMuted ? <BellOff size={14} aria-hidden="true" /> : <BellRing size={14} aria-hidden="true" />}</span>
      </button>
    </div>
  );
}
