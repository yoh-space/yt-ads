/**
 * Backwards-compatible re-export of the canonical service catalog.
 *
 * The single source of truth lives at `@/shared/services`. New code should
 * import directly from there; this shim exists so the existing
 * `@/constants/services` callers (bot, mini app, dashboard views) keep working
 * without a sweeping import migration.
 */
export {
  SERVICE_IDS,
  SERVICE_CATEGORIES,
  AMHARIC_SERVICE_LABELS,
  allServiceIds,
  getServiceLabel,
} from "@/shared/services";
export type { ServiceId, ServiceItem, ServiceCategory } from "@/shared/services";
