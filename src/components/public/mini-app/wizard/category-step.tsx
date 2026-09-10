"use client";

import { SERVICE_CATEGORIES } from "@/shared/services";
import { getServiceLabel } from "@/constants/services";
import { Printer, Layers, Scissors, SunMedium, Zap, FolderDown, Shirt, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

const CATEGORY_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  LARGE_FORMAT_PRINTING: Layers,
  SIGNAGE_AND_DISPLAYS: SunMedium,
  FLATBED_UV_PRINTING: Printer,
  CNC_AND_LASER: Scissors,
  TEXTILE_AND_APPAREL: Shirt,
};

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  onNext: () => void;
  onBack?: () => void;
}

export function CategoryStep({ control, watch, setValue, errors, onNext, onBack }: StepProps) {
  const selectedCategory = watch("serviceId");
  const selectedCatId = watch("_selectedCategoryId") as string | undefined;

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">አጠቃቀ አይነት</h2>
        <p className="text-sm text-neutral-400 mt-1">የምርጫዎት አጠቃቀ አይነት መረጣት.</p>
      </div>

      <div className="space-y-3">
        {SERVICE_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.categoryId] ?? Layers;
          const isSelected = selectedCatId === category.categoryId;
          return (
            <button
              key={category.categoryId}
              type="button"
              onClick={() => {
                setValue("_selectedCategoryId" as any, category.categoryId, { shouldValidate: false });
                // Auto-select first service in category
                if (category.items.length > 0) {
                  setValue("serviceId", category.items[0].id as any, { shouldValidate: true });
                }
              }}
              className={`w-full p-3 rounded-sm border transition-colors text-left ${
                isSelected
                  ? "border-[#E5C07B] bg-[#22232A] text-white"
                  : "border-white/[0.08] bg-[#131418] text-neutral-300 hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isSelected ? "text-[#E5C07B]" : "text-neutral-500"} />
                <div>
                  <span className="font-semibold text-sm block">{category.categoryName}</span>
                  <span className="text-xs text-neutral-500 block">{category.items.length} አጠቃቀ</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 flex gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedCategory}
          className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </section>
  );
}
