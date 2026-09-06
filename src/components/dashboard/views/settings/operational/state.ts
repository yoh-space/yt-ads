"use client";

import { useEffect, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseUnit, Unit } from "@/lib/operations-types";

export interface OverrideRow {
  materialName: string;
  etbValue: number;
}

export interface ConversionRuleRow {
  materialName: string;
  purchaseUnit: PurchaseUnit;
  baseUnit: Unit;
  inputDimension?: number;
  conversionRatio: number;
}

export interface ScrapAllowanceRow {
  materialId: Id<"materials">;
  allowancePercent: number;
}

/** Shape of the editable system config — matches the fields persisted via
 *  `systemConfigs.updateSystemConfig`. */
export interface OperationalConfigState {
  etbPerSquareMetre: number;
  etbPerLitre: number;
  etbPerPiece: number;
  etbPerMetre: number;
  etbPerSheet: number;
  unitConversionDefaults: ConversionRuleRow[];
  inkMlPerSquareMetre: number;
  maxAllowedWastePercent: number;
  minOffcutAreaSquareMetre: number;
  requireAdminPinForExceptions: boolean;
  maxDirectStockOutEtb: number;
  orderExpirationHours: number;
  defaultScrapAllowancePercent: number;
  materialScrapAllowances: ScrapAllowanceRow[];
  overrides: OverrideRow[];
}

export interface OperationalConfigActions {
  setEtbPerSquareMetre: (n: number) => void;
  setEtbPerLitre: (n: number) => void;
  setEtbPerPiece: (n: number) => void;
  setEtbPerMetre: (n: number) => void;
  setEtbPerSheet: (n: number) => void;
  setUnitConversionDefaults: React.Dispatch<React.SetStateAction<ConversionRuleRow[]>>;
  setInkMlPerSquareMetre: (n: number) => void;
  setMaxAllowedWastePercent: (n: number) => void;
  setMinOffcutAreaSquareMetre: (n: number) => void;
  setRequireAdminPinForExceptions: (v: boolean) => void;
  setMaxDirectStockOutEtb: (n: number) => void;
  setOrderExpirationHours: (n: number) => void;
  setDefaultScrapAllowancePercent: (n: number) => void;
  setMaterialScrapAllowances: React.Dispatch<React.SetStateAction<ScrapAllowanceRow[]>>;
  setOverrides: React.Dispatch<React.SetStateAction<OverrideRow[]>>;
  hydrated: boolean;
}

interface SystemConfigResponse {
  etbPerSquareMetre: number;
  etbPerLitre: number;
  etbPerPiece: number;
  etbPerMetre: number;
  etbPerSheet: number;
  unitConversionDefaults?: ConversionRuleRow[];
  inkMlPerSquareMetre: number;
  maxAllowedWastePercent: number;
  minOffcutAreaSquareMetre: number;
  requireAdminPinForExceptions: boolean;
  maxDirectStockOutEtb: number;
  orderExpirationHours?: number;
  defaultScrapAllowancePercent?: number;
  materialScrapAllowances?: ScrapAllowanceRow[];
  materialOverrides: { materialName: string; etbValue: number }[];
}

/**
 * Loads the persisted system config into local editable state exactly once
 * (guarded by `hydrated`) so consecutive renders of the panel don't clobber
 * the user's in-progress edits.
 */
export function useOperationalConfigState(
  config: SystemConfigResponse | undefined,
): OperationalConfigState & OperationalConfigActions {
  const [etbPerSquareMetre, setEtbPerSquareMetre] = useState(0);
  const [etbPerLitre, setEtbPerLitre] = useState(0);
  const [etbPerPiece, setEtbPerPiece] = useState(0);
  const [etbPerMetre, setEtbPerMetre] = useState(0);
  const [etbPerSheet, setEtbPerSheet] = useState(0);
  const [unitConversionDefaults, setUnitConversionDefaults] = useState<ConversionRuleRow[]>([]);
  const [inkMlPerSquareMetre, setInkMlPerSquareMetre] = useState(0);
  const [maxAllowedWastePercent, setMaxAllowedWastePercent] = useState(0);
  const [minOffcutAreaSquareMetre, setMinOffcutAreaSquareMetre] = useState(0);
  const [requireAdminPinForExceptions, setRequireAdminPinForExceptions] = useState(true);
  const [maxDirectStockOutEtb, setMaxDirectStockOutEtb] = useState(0);
  const [orderExpirationHours, setOrderExpirationHours] = useState(12);
  const [defaultScrapAllowancePercent, setDefaultScrapAllowancePercent] = useState(0);
  const [materialScrapAllowances, setMaterialScrapAllowances] = useState<ScrapAllowanceRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!config || hydrated) return;
    setEtbPerSquareMetre(config.etbPerSquareMetre);
    setEtbPerLitre(config.etbPerLitre);
    setEtbPerPiece(config.etbPerPiece);
    setEtbPerMetre(config.etbPerMetre);
    setEtbPerSheet(config.etbPerSheet);
    setUnitConversionDefaults((config.unitConversionDefaults ?? []) as ConversionRuleRow[]);
    setInkMlPerSquareMetre(config.inkMlPerSquareMetre);
    setMaxAllowedWastePercent(config.maxAllowedWastePercent);
    setMinOffcutAreaSquareMetre(config.minOffcutAreaSquareMetre);
    setRequireAdminPinForExceptions(config.requireAdminPinForExceptions);
    setMaxDirectStockOutEtb(config.maxDirectStockOutEtb);
    setOrderExpirationHours(config.orderExpirationHours ?? 12);
    setDefaultScrapAllowancePercent(config.defaultScrapAllowancePercent ?? 0);
    setMaterialScrapAllowances((config.materialScrapAllowances ?? []).map((row) => ({ materialId: row.materialId, allowancePercent: row.allowancePercent })));
    setOverrides(config.materialOverrides.map((row) => ({ materialName: row.materialName, etbValue: row.etbValue })));
    setHydrated(true);
  }, [config, hydrated]);

  return {
    etbPerSquareMetre,
    etbPerLitre,
    etbPerPiece,
    etbPerMetre,
    etbPerSheet,
    unitConversionDefaults,
    inkMlPerSquareMetre,
    maxAllowedWastePercent,
    minOffcutAreaSquareMetre,
    requireAdminPinForExceptions,
    maxDirectStockOutEtb,
    orderExpirationHours,
    defaultScrapAllowancePercent,
    materialScrapAllowances,
    overrides,
    setEtbPerSquareMetre,
    setEtbPerLitre,
    setEtbPerPiece,
    setEtbPerMetre,
    setEtbPerSheet,
    setUnitConversionDefaults,
    setInkMlPerSquareMetre,
    setMaxAllowedWastePercent,
    setMinOffcutAreaSquareMetre,
    setRequireAdminPinForExceptions,
    setMaxDirectStockOutEtb,
    setOrderExpirationHours,
    setDefaultScrapAllowancePercent,
    setMaterialScrapAllowances,
    setOverrides,
    hydrated,
  };
}

export type { SystemConfigResponse };
