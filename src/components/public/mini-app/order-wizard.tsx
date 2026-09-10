"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CompleteOrderPayloadSchema, type CompleteOrderPayloadInput } from "@/shared/order-schemas";
import { type WizardStep, nextStep, prevStep, stepNumber, stepLabel, WIZARD_TOTAL_STEPS } from "@/shared/wizard-steps";
import { WelcomeStep } from "./wizard/welcome-step";
import { ProfileStep } from "./wizard/profile-step";
import { AccountTypeStep } from "./wizard/account-type-step";
import { CompanyTinStep } from "./wizard/company-tin-step";
import { CategoryStep } from "./wizard/category-step";
import { ServiceStep } from "./wizard/service-step";
import { SpecificationsStep } from "./wizard/specifications-step";
import { DimensionsStep } from "./wizard/dimensions-step";
import { ArtworkStep } from "./wizard/artwork-step";
import { ReviewStep } from "./wizard/review-step";

const STEP_COMPONENTS: Record<WizardStep, (props: any) => ReactNode> = {
  welcome: WelcomeStep,
  profile: ProfileStep,
  "account-type": AccountTypeStep,
  "company-tin": CompanyTinStep,
  category: CategoryStep,
  service: ServiceStep,
  specifications: SpecificationsStep,
  dimensions: DimensionsStep,
  artwork: ArtworkStep,
  review: ReviewStep,
};

export interface OrderWizardProps {
  telegramId?: string | null;
  telegramInitData?: string | null;
  launchName?: string;
  launchPhone?: string;
  initialCompany?: string;
  initialTin?: string;
  initialNotes?: string;
  onSuccess?: (orderCode: string) => void;
  onCancel?: () => void;
}

const DRAFT_STORAGE_KEY = "yt-mini-app-draft";

export function OrderWizard({
  telegramId,
  telegramInitData,
  launchName,
  launchPhone,
  initialCompany,
  initialTin,
  initialNotes,
  onSuccess,
  onCancel,
}: OrderWizardProps) {
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const submitOrder = useMutation(api.orders.submit);
  const updateTelegramProfile = useMutation(api.users.updateTelegramProfile);
  const userProfile = useQuery(
    api.users.getByTelegramId,
    telegramId && telegramInitData && !launchPhone
      ? { telegramId, initData: telegramInitData }
      : "skip",
  );

  const verifiedPhone = launchPhone ?? userProfile?.phone ?? null;
  const phoneReady = Boolean(verifiedPhone);

  const [step, setStep] = useState<WizardStep>("welcome");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileStorageId, setFileStorageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

  const methods = useForm<CompleteOrderPayloadInput>({
    resolver: zodResolver(CompleteOrderPayloadSchema),
    defaultValues: {
      customerName: launchName ?? "",
      phone: verifiedPhone ?? "",
      accountType: "individual" as const,
      companyLegalName: initialCompany ?? "",
      tinNumber: initialTin ?? "",
      serviceId: undefined,
      specifications: {},
      dimensions: "",
      quantity: "1",
      notes: initialNotes ?? "",
      preferredDueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      length: undefined,
      width: undefined,
    },
    mode: "onChange",
  });

  const {
    control,
    watch,
    setValue,
    trigger,
    getValues,
        formState: { errors },
  } = methods;

  // Sync profile data when it loads
  useEffect(() => {
    if (userProfile) {
      setValue("customerName", userProfile.name || launchName || "", { shouldValidate: false });
      setValue("companyLegalName", userProfile.companyLegalName ?? initialCompany ?? "", { shouldValidate: false });
      setValue("tinNumber", userProfile.tinNumber ?? initialTin ?? "", { shouldValidate: false });
    }
  }, [userProfile, setValue, launchName, initialCompany, initialTin]);

  // Draft session persistence
  useEffect(() => {
    if (step === "welcome") {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          Object.keys(data).forEach((key) => {
            if (key !== "fileStorageId") setValue(key as keyof CompleteOrderPayloadInput, data[key]);
          });
        } catch {}
      }
    }
  }, [step, setValue]);

  const currentValues = watch();
  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft = { ...currentValues };
      delete (draft as any).fileStorageId;
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 300);
    return () => clearTimeout(timeout);
  }, [currentValues]);

  const estimatedArea = useMemo(() => {
    const qty = parseInt(currentValues.quantity || "1");
    if (currentValues.length && currentValues.width && qty > 0) {
      const area = currentValues.length * currentValues.width * qty;
      return { unitArea: (currentValues.length * currentValues.width).toFixed(2), totalArea: area.toFixed(2) };
    }
    return null;
  }, [currentValues.length, currentValues.width, currentValues.quantity]);

  const serviceFields = useMemo(() => {
    if (!currentValues.serviceId) return [];
    const { serviceSpecificationFields } = require("@/shared/service-specifications");
    return serviceSpecificationFields(currentValues.serviceId as string);
    }, [currentValues.serviceId]);

  const currentStepIdx = stepNumber(step);

  const goNext = async () => {
    setError(null);
    const fieldsToValidate = stepFieldsToValidate(step);
    const ok = await trigger(fieldsToValidate);
    if (!ok) return;

    const next = nextStep(step);
    if (next) {
      // When changing service selection, warn about clearing incompatible specs
      if (step === "service") {
        const newFields = serviceFields;
        if (newFields.length > 0) {
          const currentSpecs = currentValues.specifications || {};
          const staleKeys = Object.keys(currentSpecs).filter((k) => !newFields.some((f: any) => f.key === k));
          if (staleKeys.length > 0) {
            // eslint-disable-next-line no-alert
            if (!confirm(`Some specifications will be cleared: ${staleKeys.join(", ")}. Continue?`)) return;
          }
          const cleared: Record<string, string> = {};
          for (const f of newFields) {
            const val = currentSpecs[f.key];
            if (val && f.options.includes(val)) cleared[f.key] = val;
          }
          setValue("specifications", cleared, { shouldValidate: false });
        }
      }
      setStep(next);
    }
  };

  const goBack = () => {
    const prev = prevStep(step);
    if (prev) setStep(prev);
  };

    const handleCancel = () => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    onCancel?.();
  };

  async function uploadSelectedFile(): Promise<string | undefined> {
    if (!file) return undefined;
    try {
      const uploadUrl = await generateUploadUrl({});
      const form = new FormData();
      form.append("file", file);
      const uploadResult = await fetch(uploadUrl, { method: "POST", body: form });
      const json = await uploadResult.json();
      const storageId = json.ration || json.storagerId || json.storageId;
      if (storageId) {
        setFileStorageId(storageId);
        return storageId;
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload artwork file. Please try again.");
    }
    return undefined;
  }

  async function handleSubmit() {
    setError(null);
    const ok = await trigger([
      "customerName",
      "phone",
      "accountType",
      "companyLegalName",
      "tinNumber",
      "serviceId",
      "specifications",
      "dimensions",
      "length",
      "width",
      "quantity",
      "preferredDueDate",
      "notes",
    ]);
    if (!ok) return;

    setBusy(true);
    try {
      const storageId = await uploadSelectedFile();
      const values = getValues();

      await updateTelegramProfile({
        telegramId: telegramId!,
        initData: telegramInitData!,
        phone: verifiedPhone!,
        name: values.customerName,
        companyLegalName: values.companyLegalName,
        tinNumber: values.tinNumber,
        notes: values.notes,
      });

      const result = await submitOrder({
        clientName: values.customerName,
        phone: values.phone,
        telegramId: telegramId ?? undefined,
        serviceType: values.serviceId as any,
        serviceId: values.serviceId as any,
        specifications: values.specifications as Record<string, string> | undefined,
        dimensions: values.dimensions,
        quantity: values.quantity,
        length: values.length,
        width: values.width,
        accountType: values.accountType,
        companyLegalName: values.companyLegalName,
        tinNumber: values.tinNumber,
        notes: values.notes,
        preferredDueDate: values.preferredDueDate,
        fileStorageId: storageId ? (storageId as any) : undefined,
        fileName: file?.name || undefined,
      });

      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      onSuccess?.(result.order?.code ?? "");
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to submit order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <form className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between text-xs font-mono text-neutral-500 mb-1">
          <span>Step {currentStepIdx} of {WIZARD_TOTAL_STEPS}</span>
          <span>{stepLabel(step)}</span>
        </div>
        <div className="h-1.5 bg-[#1C1D24] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E5C07B] transition-all duration-300"
            style={{ width: `${(currentStepIdx / WIZARD_TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <StepComponent
          control={control}
          watch={watch}
          setValue={setValue}
          errors={errors}
          phoneReady={phoneReady}
          verifiedPhone={verifiedPhone}
          telegramId={telegramId}
          telegramInitData={telegramInitData}
          file={file}
          fileUrl={fileUrl}
          fileStorageId={fileStorageId}
          onFileChange={setFile}
          estimatedArea={estimatedArea}
          serviceFields={serviceFields}
          orders={undefined}
          onBack={goBack}
          onNext={goNext}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          busy={busy}
          error={error}
          allValues={currentValues}
        />
      </div>
    </form>
  );
}

function stepFieldsToValidate(step: WizardStep): (keyof CompleteOrderPayloadInput)[] {
  switch (step) {
    case "welcome":
    case "category":
      return [];
    case "profile":
      return ["phone"];
    case "account-type":
      return ["accountType"];
    case "company-tin":
      return ["companyLegalName", "tinNumber"];
    case "service":
      return ["serviceId"];
    case "specifications":
      return ["specifications"];
    case "dimensions":
      return ["dimensions", "length", "width", "quantity"];
    case "artwork":
      return ["notes"];
    case "review":
      return [
        "customerName", "phone", "accountType", "serviceId",
        "specifications", "dimensions", "length", "width", "quantity",
        "preferredDueDate", "notes",
      ];
    default:
      return [];
  }
}
