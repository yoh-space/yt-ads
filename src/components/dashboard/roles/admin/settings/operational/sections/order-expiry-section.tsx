"use client";

import { Clock3 } from "lucide-react";
import { FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";

/** Telegram Mini App order expiration window. */
export function OrderExpirySection({
  orderExpirationHours,
  setOrderExpirationHours,
}: {
  orderExpirationHours: number;
  setOrderExpirationHours: (n: number) => void;
}) {
  return (
    <FormSection
      icon={<Clock3 size={17} />}
      tone="navy"
      title="የደንበኞች ትዕዛዝ አስተዳደር"
      note="የትዕዛዝ ጊዜ ማለቂያ እና የማዘጋጃ ደንቦች።"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumericField
          label="Order Expiration Window"
          value={orderExpirationHours}
          onChange={setOrderExpirationHours}
          suffix="hours"
          min={1}
          max={168}
          step={1}
          hint="Unpaid/unconfirmed orders auto-expire after this period."
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Orders submitted via Telegram Mini App will automatically expire if not confirmed within this
        window. Customers receive an Amharic notification when their order expires.
      </p>
    </FormSection>
  );
}
