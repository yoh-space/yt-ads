"use client";

export function InventoryLoader() {
  return (
    <div className="flex items-center justify-center p-8 min-h-[200px]" role="status" aria-live="polite" aria-label="Loading inventory management system">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-navy/20 border-t-navy animate-spin" aria-hidden="true" />
        <img src="/logo.webp" alt="YT Advertisement logo" className="w-14 h-14 object-contain" />
      </div>
      <p className="sr-only text-primary text-xl">Loading inventory management system</p>
    </div>
  );
}
