import type { Role } from "@/lib/operations-types";

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function statusTone(status: string) {
  if (status === "Running" || status === "In production" || status === "Completed") return "success";
  if (status === "Maintenance" || status === "Paused") return "warning";
  if (status === "Unavailable") return "danger";
  return "neutral";
}
