export type Language = "am" | "en";

/**
 * The active step of the traditional (text-first) order flow. When set, plain
 * text/photos/contacts from the user are interpreted by that step's handler.
 */
export type FlowStep =
  | "service"
  | "other_spec" // waiting for a free-text service description ("ሌላ")
  | "dimensions"
  | "file"
  | "phone"
  | "order_code";

export interface OrderDraft {
  /** Canonical service type stored on the order (e.g. "Banner (Flex)"). */
  serviceType?: string;
  /** Human label used in the chat summary for the chosen service. */
  serviceLabel?: string;
  /** Raw dimensions label, e.g. "2m × 3m". */
  dimensions?: string;
  /** Calculated area in m² for the summary. */
  area?: number;
  fileStorageId?: string;
  fileName?: string;
  phone?: string;
}

export interface TelegramSessionData {
  language: Language;
  step?: FlowStep;
  draft?: OrderDraft;
}

export interface MiniAppOrderPayload {
  code: string;
  clientName: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
}

export type OrderStatus = "Received" | "In Production" | "Ready for Pickup" | "Completed";