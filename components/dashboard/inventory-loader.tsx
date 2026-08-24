"use client";

export function InventoryLoader() {
  return (
    <div className="inventory-loader" role="status" aria-live="polite" aria-label="Loading inventory management system">
      <div className="inventory-loader-glow" />
      <video
        className="inventory-loader-video"
        src="/inventory-loader.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="inventory-loader-fallback" aria-hidden="true">
        <span className="inventory-loader-mark">Y</span>
        <span className="inventory-loader-spinner" />
      </div>
      <p className="inventory-loader-label">የምርት እና ክምችት ማዕከል እየተጫነ ነው…</p>
      <span className="sr-only">Loading YT Advertisement inventory management system</span>
    </div>
  );
}
