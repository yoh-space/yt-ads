/**
 * Deterministic Scrap & Off-Cut calculation engine for the automated
 * Production Dispatch workflow.
 *
 * Pure helpers — no database access, no side effects — so the exact same
 * numbers are shown in the dispatch preview card and registered by the
 * `confirmOrderAndIssueJobCard` backend mutation. Never accept client-submitted
 * scrap / off-cut values: the totals are always derived from the material's
 * catalog dimensions and the customer order's net job dimensions.
 */

/** Minimum side width (in metres) of a roll strip that still counts as a
 * reusable off-cut rather than scrap. */
export const MIN_USABLE_OFFCUT_WIDTH = 0.3;

export type CalcMaterial = {
  /** Confirmed printable/usable width of one roll, in metres (e.g. 3.2). */
  rollWidth?: number;
  /** Rigid sheet width in metres (e.g. 1.22). */
  sheetWidth?: number;
  /** Rigid sheet length in metres (e.g. 2.44). */
  sheetLength?: number;
  /** True for rigid boards, false for roll stock. */
  isRigidSheet?: boolean;
};

export type CalcJob = {
  /** Job width across the roll axis (m). */
  width?: number;
  /** Job length along the roll axis (m). */
  length?: number;
  /** Order quantity (number of units at net job dimensions); string order.quantity accepted. */
  quantity?: number | string;
};

export type CalcConfig = {
  /** Minimum usable off-cut side width in metres. */
  minUsableOffcutWidth?: number;
  /** Additive setup / bleed margin in square metres per unit. */
  defaultMarginSquareMetres?: number;
  /** Standard waste margin percent applied to gross (informational). */
  standardWasteMargin?: number;
};

export type RollOffCutResult = {
  kind: "roll";
  grossArea: number;
  netArea: number;
  unusedWidth: number;
  usableOffcut: {
    area: number;
    width: number;
    length: number;
    label: string;
  } | null;
  sideStripScrapArea: number;
  setupWasteArea: number;
  totalScrapArea: number;
};

export type RigidOffCutResult = {
  kind: "rigid_sheet";
  sheetArea: number;
  netArea: number;
  /** Total gross sheet area consumed (sheetArea × sheetsNeeded). */
  grossArea: number;
  sheetsNeeded: number;
  totalSheetArea: number;
  usableOffcut: {
    area: number;
    width: number;
    length: number;
    label: string;
  } | null;
  totalScrapArea: number;
};

export type OffCutScrapResult = RollOffCutResult | RigidOffCutResult;

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function parseQuantity(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 1;
  if (typeof value !== "string") return 1;
  const match = value.match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Math.max(1, Number(match[0])) : 1;
}

/**
 * Calculates the automated scrap and off-cut for a roll material.
 *
 *   grossArea        = rollWidth × jobLength × qty       (total stock deducted)
 *   netArea          = jobWidth  × jobLength × qty       (net product area)
 *   unusedWidth      = rollWidth − jobWidth
 *   sideStripArea    = unusedWidth × jobLength × qty
 *   usableOffcut     = sideStripArea, when unusedWidth ≥ minUsableOffcutWidth
 *   sideStripScrap   = sideStripArea, otherwise
 *   setupWasteArea   = defaultMarginSquareMetres × qty
 *   totalScrapArea   = (grossArea − netArea − usableOffcutArea) + setupWasteArea
 */
export function calcRollOffCutScrap(
  material: CalcMaterial,
  job: CalcJob,
  config?: CalcConfig,
): RollOffCutResult {
  const rollWidth = material.rollWidth ?? 0;
  const jobWidth = job.width ?? 0;
  const jobLength = job.length ?? 0;
  const quantity = parseQuantity(job.quantity);
  const minUsableWidth = config?.minUsableOffcutWidth ?? MIN_USABLE_OFFCUT_WIDTH;
  const marginPerUnit = round(config?.defaultMarginSquareMetres ?? 0, 3);

  const grossArea = round(rollWidth * jobLength * quantity);
  const netArea = round(jobWidth * jobLength * quantity);
  const unusedWidth = round(rollWidth - jobWidth);
  const sideStripArea = round(Math.max(0, unusedWidth) * jobLength * quantity);
  const setupWasteArea = round(marginPerUnit * quantity, 3);

  let usableOffcut: RollOffCutResult["usableOffcut"] = null;
  let sideStripScrapArea = 0;

  if (unusedWidth >= minUsableWidth) {
    usableOffcut = {
      area: sideStripArea,
      width: round(unusedWidth),
      length: round(jobLength * quantity),
      label: `${round(unusedWidth)}m × ${round(jobLength * quantity)}m`,
    };
  } else if (sideStripArea > 0) {
    sideStripScrapArea = sideStripArea;
  }

  const usableOffcutArea = usableOffcut ? usableOffcut.area : 0;
  const rawScrap = round((grossArea - netArea - usableOffcutArea) + setupWasteArea);
  const totalScrapArea = Math.max(0, rawScrap);

  return {
    kind: "roll",
    grossArea,
    netArea,
    unusedWidth,
    usableOffcut,
    sideStripScrapArea: Math.max(0, sideStripScrapArea),
    setupWasteArea,
    totalScrapArea,
  };
}

/**
 * Calculates the automated scrap and off-cut for rigid sheet stock.
 *
 * Places the net job cutout in a nested layout across the standard sheet,
 * then records the leftover rectangular section as usable off-cut sheet
 * (m²) and any non-recoverable trim as scrap.
 */
export function calcRigidSheetOffCutScrap(
  material: CalcMaterial,
  job: CalcJob,
  config?: CalcConfig,
): RigidOffCutResult {
  const sheetWidth = material.sheetWidth ?? 0;
  const sheetLength = material.sheetLength ?? 0;
  const jobWidth = job.width ?? 0;
  const jobLength = job.length ?? 0;
  const quantity = parseQuantity(job.quantity);
  const marginPerUnit = round(config?.defaultMarginSquareMetres ?? 0, 3);

  const sheetArea = round(sheetWidth * sheetLength, 3);
  const netArea = round(jobWidth * jobLength * quantity);

  const cutoutsPerWidth = sheetWidth > 0 && jobWidth > 0 ? Math.floor(sheetWidth / jobWidth) : 0;
  const cutoutsPerLength = sheetLength > 0 && jobLength > 0 ? Math.floor(sheetLength / jobLength) : 0;
  const perSheetCount = cutoutsPerWidth * cutoutsPerLength;

  const sheetsNeeded = perSheetCount > 0 ? Math.ceil(quantity / perSheetCount) : quantity;
  const totalSheetArea = round(sheetArea * sheetsNeeded);

  const usedArea = round(jobWidth * jobLength * perSheetCount * sheetsNeeded);
  const remainderArea = round(sheetArea - jobWidth * jobLength * perSheetCount);

  let usableOffcut: RigidOffCutResult["usableOffcut"] = null;
  let totalScrapArea = marginPerUnit * quantity;

  if (remainderArea >= (config?.minUsableOffcutWidth ?? MIN_USABLE_OFFCUT_WIDTH)) {
    usableOffcut = {
      area: round(remainderArea * sheetsNeeded),
      width: Math.max(remainderArea / sheetLength, 0),
      length: sheetLength,
      label: `${round(Math.max(remainderArea / sheetLength, 0))}m × ${sheetLength}m`,
    };
  } else if (remainderArea > 0) {
    totalScrapArea += remainderArea * sheetsNeeded;
  }

  return {
    kind: "rigid_sheet",
    sheetArea,
    grossArea: totalSheetArea,
    netArea,
    sheetsNeeded,
    totalSheetArea,
    usableOffcut,
    totalScrapArea: Math.max(0, round(totalScrapArea)),
  };
}

/**
 * Picks the correct engine based on the material's catalog family.
 */
export function calculateOffCutAndScrap(
  material: CalcMaterial,
  job: CalcJob,
  config?: CalcConfig,
): OffCutScrapResult {
  const isRigid = material.isRigidSheet || Boolean(material.sheetWidth && material.sheetLength) || !material.rollWidth;
  if (isRigid) {
    return calcRigidSheetOffCutScrap(material, job, config);
  }
  return calcRollOffCutScrap(material, job, config);
}
