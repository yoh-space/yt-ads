import { findMaterialSpecification } from "./material-specifications";
import { SERVICE_IDS, type ServiceId } from "./services";

/**
 * Services whose roll substrate is derived from the customer's job width
 * instead of being selected by the customer. The value is the canonical
 * material catalog name whose `specificationOptions` list the available rolls.
 */
export const ROLL_SUBSTRATE_MATERIAL_BY_SERVICE: Partial<Record<ServiceId, string>> = {
  banner_print: "Banner Flex",
  hq_print_and_cut: "Banner Flex",
  sticker_white: "Frosted Sticker",
  sticker_transparent: "Transparent Sticker",
  sticker_reflective: "Reflective Sticker",
  sticker_mesh: "Mesh Sticker",
  sticker_frosted: "Frosted Sticker",
  uv_print_canvas: "Canvas",
};

export type RollResolution = {
  /** The canonical catalog option string, e.g. "3.2m × 50m". */
  option: string;
  /** Confirmed printable/usable width of the selected roll, in metres. */
  rollWidth: number;
  /** Material catalog name the option came from. */
  material: string;
};

export class RollWidthExceededError extends Error {
  readonly maxWidth: number;
  constructor(material: string, maxWidth: number) {
    super(
      `The requested width exceeds the widest available ${material} roll (${maxWidth}m). Reduce the width or contact Reception.`,
    );
    this.name = "RollWidthExceededError";
    this.maxWidth = maxWidth;
  }
}

/** True when the service's roll substrate should be derived automatically. */
export function serviceHasDerivedRoll(serviceId: string): boolean {
  return Boolean(ROLL_SUBSTRATE_MATERIAL_BY_SERVICE[serviceId as ServiceId]);
}

/**
 * Extracts the usable roll width (metres) from a catalog roll option string.
 * Handles "3.2m × 50m", "2.07m × 50m", "1.2 Meter × 50 Meter Roll",
 * "60cm × 100m", and similar labels by reading the first dimension and
 * normalising centimetres/metres to metres.
 */
export function parseRollOptionWidth(option: string): number | null {
  const match = option.match(/([0-9]+(?:\.[0-9]+)?)\s*(cm|mm|m|meter|meters|metre|metres)?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? "m").toLowerCase();
  if (unit === "cm") return Number((value / 100).toFixed(3));
  if (unit === "mm") return Number((value / 1000).toFixed(3));
  return value;
}

/**
 * Selects the smallest roll that fits the requested width. Returns null when
 * the service has no derived roll or the catalog has no parseable roll options.
 * Throws {@link RollWidthExceededError} when the width is wider than the
 * largest available roll.
 */
export function resolveRollSubstrate(serviceId: string, widthM: number): RollResolution | null {
  const material = ROLL_SUBSTRATE_MATERIAL_BY_SERVICE[serviceId as ServiceId];
  if (!material) return null;
  if (!Number.isFinite(widthM) || widthM <= 0) return null;

  const specification = findMaterialSpecification(material);
  const options = specification?.specificationOptions ?? [];
  const rolls = options
    .map((option) => ({ option, rollWidth: parseRollOptionWidth(option) }))
    .filter((entry): entry is { option: string; rollWidth: number } => entry.rollWidth !== null)
    .sort((left, right) => left.rollWidth - right.rollWidth);

  // The catalog's declared printable width is authoritative when it is wider
  // than every parsed option label (e.g. Canvas options "1.4 Meter" but a
  // confirmed 1.52m roll). Keep it as an additional candidate.
  const declaredWidth = specification?.rollWidth;
  if (
    declaredWidth !== undefined &&
    declaredWidth > 0 &&
    !rolls.some((roll) => Math.abs(roll.rollWidth - declaredWidth) < 0.001)
  ) {
    rolls.push({ option: `${declaredWidth}m × 50m`, rollWidth: declaredWidth });
    rolls.sort((left, right) => left.rollWidth - right.rollWidth);
  }

  if (rolls.length === 0) return null;

  const selected = rolls.find((roll) => roll.rollWidth >= widthM);
  if (!selected) {
    throw new RollWidthExceededError(material, rolls[rolls.length - 1].rollWidth);
  }
  return { option: selected.option, rollWidth: selected.rollWidth, material };
}

/** Every service id that carries a derived roll substrate. */
export const ROLL_SUBSTRATE_SERVICE_IDS = SERVICE_IDS.filter((serviceId) => serviceHasDerivedRoll(serviceId));