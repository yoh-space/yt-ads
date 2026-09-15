import { ScreenPlaceholder } from "@/components/screen-placeholder";

export default function receptionist_queue() {
  return <ScreenPlaceholder title={"Queue"}
  hint={"Reception queue - api.customerOrders.getReceptionQueue (wiring in Phase 7)"} />;
}
