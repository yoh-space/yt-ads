"use client";

import { CircleDollarSign } from "lucide-react";
import { FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";

/** ETB valuation rates used by reconciliation & loss calculations when a
 *  material has no explicit price. */
export function ValuationSection({
  etbPerSquareMetre,
  setEtbPerSquareMetre,
  etbPerLitre,
  setEtbPerLitre,
  etbPerPiece,
  setEtbPerPiece,
  etbPerMetre,
  setEtbPerMetre,
  etbPerSheet,
  setEtbPerSheet,
}: {
  etbPerSquareMetre: number;
  setEtbPerSquareMetre: (n: number) => void;
  etbPerLitre: number;
  setEtbPerLitre: (n: number) => void;
  etbPerPiece: number;
  setEtbPerPiece: (n: number) => void;
  etbPerMetre: number;
  setEtbPerMetre: (n: number) => void;
  etbPerSheet: number;
  setEtbPerSheet: (n: number) => void;
}) {
  return (
    <FormSection
      icon={<CircleDollarSign size={17} />}
      tone="gold"
      title="የዕቃዎች ዋጋ ተመን"
      note="የጥሬ ዕቃዎች ነባሪ የመሸጫ እና የግዢ ዋጋ ማስተካከያ።"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumericField
          label="Price per m²"
          value={etbPerSquareMetre}
          onChange={setEtbPerSquareMetre}
          suffix="ETB"
          min={0}
          step="0.01"
          hint="Area materials (banner, vinyl, acrylic, foam, …)"
        />
        <NumericField
          label="Price per litre"
          value={etbPerLitre}
          onChange={setEtbPerLitre}
          suffix="ETB"
          min={0}
          step="0.01"
          hint="Ink materials"
        />
        <NumericField
          label="Price per piece"
          value={etbPerPiece}
          onChange={setEtbPerPiece}
          suffix="ETB"
          min={0}
          step="0.01"
          hint="Unit hardware (LEDs, electrical parts)"
        />
        <NumericField
          label="Price per metre"
          value={etbPerMetre}
          onChange={setEtbPerMetre}
          suffix="ETB"
          min={0}
          step="0.01"
          hint="Linear roll materials"
        />
        <NumericField
          label="Price per sheet"
          value={etbPerSheet}
          onChange={setEtbPerSheet}
          suffix="ETB"
          min={0}
          step="0.01"
          hint="Rigid sheet materials"
        />
      </div>
    </FormSection>
  );
}
