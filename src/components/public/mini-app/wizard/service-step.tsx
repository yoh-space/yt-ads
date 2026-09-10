"use client";

import { SERVICE_CATEGORIES } from "@/shared/services";
import { getServiceLabel } from "@/constants/services";
import { Printer, Layers, Scissors, SunMedium, Zap, FolderDown, Shirt, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

const SERVICE_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  banner_print: Printer,
  sticker_white: Layers,
  sticker_transparent: Layers,
  sticker_reflective: Layers,
  sticker_mesh: Layers,
  sticker_frosted: Layers,
  hq_print_and_cut: Scissors,
  light_box_a1: SunMedium,
  light_box_a2: SunMedium,
  neon_light: Zap,
  roll_up_standard: FolderDown,
  roll_up_deluxe: FolderDown,
  uv_print_mica: Sparkles,
  uv_print_foam: Sparkles,
  uv_print_cladding: Sparkles,
  uv_print_canvas: Sparkles,
  foam_cutout: Scissors,
  foam_engrave: Scissors,
  mica_cutout: Scissors,
  mica_engrave: Scissors,
  dtf: Shirt,
  sublimation: Shirt,
};

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  onNext: () => void;
  onBack?: () => void;
}

export function ServiceStep({ control, watch, setValue, errors, onNext, onBack }: StepProps) {
  const selectedService = watch("serviceId") as string | undefined;
  const selectedCatId = watch("_selectedCategoryId") as string | undefined;

  // Flatten all services for easy lookup
  const allServices = SERVICE_CATEGORIES.flatMap((cat) => cat.items);

  // Filter by selected category if one is chosen, otherwise show all
  const services = selectedCatId
    ? SERVICE_CATEGORIES.find((c) => c.categoryId === selectedCatId)?.items ?? []
    : allServices;

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">አጠቃቀ</h2>
        <p className="text-sm text-neutral-400 mt-1">የምርጫዎት አጠቃቀ መረጣት.</p>
      </div>

      <div className="space-y-2">
        {services.map((service) => {
          const Icon = SERVICE_ICONS[service.id] ?? Printer;
          const isSelected = selectedService === service.id;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => setValue("serviceId" as any, service.id as any, { shouldValidate: true })}
              className={`w-full p-3 rounded-sm border transition-colors text-left ${
                isSelected
                  ? "border-[#E5C07B] bg-[#22232A] text-white"
                  : "border-white/[0.08] bg-[#131418] text-neutral-300 hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isSelected ? "text-[#E5C07B]" : "text-neutral-500"} />
                <div className="flex-1">
                  <span className="font-semibold text-sm block">{getServiceLabel(service.id, "am") ?? service.label}</span>
                  <span className="text-xs text-neutral-500">{service.label}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {errors.serviceId && <p className="text-xs text-rose-400">{errors.serviceId.message}</p>}

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
          disabled={!selectedService}
          className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </section>
  );
}
