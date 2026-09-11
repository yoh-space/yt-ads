"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CompleteOrderPayloadSchema, type CompleteOrderPayloadInput } from "@/shared/order-schemas";
import { type WizardStep, nextStep, prevStep, stepLabel, stepNumber, totalSteps } from "@/shared/wizard-steps";
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

const StepRegistry: Record<WizardStep, (props: any) => ReactNode> = {
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
  /** When editing an existing order, pre-populate the wizard form with these values.
   *  If provided, they override the default values from launchName/etc.
   */
  initialValues?: Partial<CompleteOrderPayloadInput>;
  editingOrderId?: string | null;
  editRevision?: number | null;
  editingOrderCode?: string | null;
  onSuccess?: (orderCode: string, isEdit?: boolean) => void;
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
  initialValues,
  editingOrderId,
  editRevision,
  editingOrderCode,
  onSuccess,
  onCancel,
}: OrderWizardProps) {
  const isEdit = Boolean(editingOrderId);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const submitOrder = useMutation(api.orders.submit);
  const updateCustomerOrder = useMutation(api.orders.updateCustomerOrder);
  const updateTelegramProfile = useMutation(api.users.updateTelegramProfile);
  const userProfile = useQuery(
    api.users.getByTelegramId,
    telegramId && telegramInitData && !launchPhone
      ? { telegramId, initData: telegramInitData }
      : "skip",
  );

  const verifiedPhone = launchPhone ?? userProfile?.phone ?? null;
  const phoneReady = Boolean(verifiedPhone);

  const [step, setStep] = useState<WizardStep>(isEdit ? "category" : "welcome");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileStorageId, setFileStorageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<CompleteOrderPayloadInput>({
    resolver: zodResolver(CompleteOrderPayloadSchema),
    defaultValues: {
      customerName: initialValues?.customerName ?? launchName ?? "",
      phone: initialValues?.phone ?? verifiedPhone ?? "",
      accountType: initialValues?.accountType ?? ("individual" as const),
      companyLegalName: initialValues?.companyLegalName ?? initialCompany ?? "",
      tinNumber: initialValues?.tinNumber ?? initialTin ?? "",
      serviceId: initialValues?.serviceId,
      specifications: initialValues?.specifications ?? {},
      dimensions: initialValues?.dimensions ?? "",
      quantity: initialValues?.quantity ?? "1",
      notes: initialValues?.notes ?? initialNotes ?? "",
      preferredDueDate: initialValues?.preferredDueDate ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
      length: initialValues?.length,
      width: initialValues?.width,
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

  // Sync profile data when it loads (only for new orders)
  useEffect(() => {
    if (userProfile && !isEdit) {
      setValue("customerName", userProfile.name || launchName || "", { shouldValidate: false });
      setValue("companyLegalName", userProfile.companyLegalName ?? initialCompany ?? "", { shouldValidate: false });
      setValue("tinNumber", userProfile.tinNumber ?? initialTin ?? "", { shouldValidate: false });
    }
  }, [userProfile, setValue, launchName, initialCompany, initialTin, isEdit]);

  // Draft session persistence (only for new orders)
  useEffect(() => {
    if (!isEdit && step === "welcome") {
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
  }, [step, setValue, isEdit]);

  const currentValues = watch();
  useEffect(() => {
    if (isEdit) return;
    const timeout = setTimeout(() => {
      const draft = { ...currentValues };
      delete (draft as any).fileStorageId;
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 300);
    return () => clearTimeout(timeout);
  }, [currentValues, isEdit]);

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

  const currentStepIdx = stepNumber(step, { accountType: currentValues.accountType, serviceId: currentValues.serviceId });
  const totalStepsCount = totalSteps({ accountType: currentValues.accountType, serviceId: currentValues.serviceId });

  const goNext = async () => {
    setError(null);
    const fieldsToValidate = stepFieldsToValidate(step, currentValues.accountType);
    const ok = await trigger(fieldsToValidate);
    if (!ok) return;

    // Block widths that cannot fit any available roll before advancing, so the
    // customer fixes the size instead of the order being rejected on submit.
    if (step === "dimensions" && currentValues.serviceId && currentValues.width) {
      try {
        const { resolveRollSubstrate } = require("@/shared/roll-width");
        resolveRollSubstrate(currentValues.serviceId as string, currentValues.width);
      } catch (err) {
        setError((err as Error)?.message ?? "This width cannot be produced from an available roll.");
        return;
      }
    }

    const next = nextStep(step, { accountType: currentValues.accountType, serviceId: currentValues.serviceId });
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
    const prev = prevStep(step, { accountType: currentValues.accountType, serviceId: currentValues.serviceId });
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
    const fieldsToValidate: (keyof CompleteOrderPayloadInput)[] = [
      "customerName",
      "phone",
      "accountType",
      ...(currentValues.accountType !== "individual" ? (["companyLegalName", "tinNumber"] as (keyof CompleteOrderPayloadInput)[]) : []),
      "serviceId",
      "specifications",
      "dimensions",
      "quantity",
      "preferredDueDate",
      "notes",
    ];
    const ok = await trigger(fieldsToValidate);
    if (!ok) return;

    setBusy(true);
    try {
      const storageId = await uploadSelectedFile();
      const values = getValues();

      if (telegramId && telegramInitData && verifiedPhone) {
        await updateTelegramProfile({
          telegramId,
          initData: telegramInitData,
          phone: verifiedPhone,
          name: values.customerName,
          companyLegalName:
            values.accountType === "individual" ? undefined : values.companyLegalName,
          tinNumber:
            values.accountType === "individual" ? undefined : values.tinNumber,
          notes: values.notes,
        });
      }

      if (isEdit && editingOrderId) {
        await updateCustomerOrder({
          orderId: editingOrderId as any,
          telegramId: telegramId ?? "",
          initData: telegramInitData ?? "",
          editRevision: editRevision ?? 1,
          customerName: values.customerName,
          phone: values.phone,
          accountType: values.accountType,
          companyLegalName:
            values.accountType === "individual" ? undefined : values.companyLegalName,
          tinNumber:
            values.accountType === "individual" ? undefined : values.tinNumber,
          serviceId: values.serviceId as any,
          specifications: values.specifications as Record<string, string> | undefined,
          dimensions: values.dimensions,
          quantity: values.quantity,
          length: values.length,
          width: values.width,
          notes: values.notes,
          fileStorageId: storageId ? (storageId as any) : undefined,
          fileName: file?.name || undefined,
        });

        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        onSuccess?.(editingOrderCode ?? editingOrderId, true);
      } else {
        const result = await submitOrder({
          clientName: values.customerName,
          phone: values.phone,
          telegramId: telegramInitData ? telegramId ?? undefined : undefined,
          telegramInitData: telegramInitData ?? undefined,
          serviceType: values.serviceId as any,
          serviceId: values.serviceId as any,
          specifications: values.specifications as Record<string, string> | undefined,
          dimensions: values.dimensions,
          quantity: values.quantity,
          length: values.length,
          width: values.width,
          accountType: values.accountType,
          companyLegalName:
            values.accountType === "individual" ? undefined : values.companyLegalName,
          tinNumber:
            values.accountType === "individual" ? undefined : values.tinNumber,
          notes: values.notes,
          preferredDueDate: values.preferredDueDate,
          fileStorageId: storageId ? (storageId as any) : undefined,
          fileName: file?.name || undefined,
        });

        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        onSuccess?.(result.order?.code ?? "", false);
      }
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to save order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const StepComponent = StepRegistry[step];

  return (
    <form className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between text-xs font-mono text-neutral-500 mb-1">
          <span>Step {currentStepIdx} of {totalStepsCount}</span>
          <span>{stepLabel(step)}</span>
        </div>
        <div className="h-1.5 bg-[#1C1D24] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E5C07B] transition-all duration-300"
            style={{ width: `${(currentStepIdx / totalStepsCount) * 100}%` }}
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
          isEdit={isEdit}
          allValues={currentValues}
        />
      </div>
    </form>
  );
}

function stepFieldsToValidate(step: WizardStep, accountType?: string): (keyof CompleteOrderPayloadInput)[] {
  switch (step) {
    case "welcome":
    case "category":
      return [];
    case "profile":
      return ["phone", "customerName"];
    case "account-type":
      return ["accountType"];
    case "company-tin":
      return accountType === "individual" ? [] : ["companyLegalName", "tinNumber"];
    case "service":
      return ["serviceId"];
    case "specifications":
      return ["specifications"];
    case "dimensions":
      return ["dimensions", "quantity"];
    case "artwork":
      return ["notes"];
    case "review":
      return [
        "customerName", "phone", "accountType", "serviceId",
        "specifications", "dimensions", "quantity",
        "preferredDueDate", "notes",
      ];
    default:
      return [];
  }
}
