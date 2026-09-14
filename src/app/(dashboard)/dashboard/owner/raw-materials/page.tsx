import { RawMaterialsView } from "@/components/dashboard/roles/owner/raw-materials/raw-materials-view";

export const metadata = {
  title: "Raw Materials | YT Advertising Owner",
  description: "Single source of truth for all operational raw materials and specifications.",
};

export default function OwnerRawMaterialsPage() {
  return <RawMaterialsView />;
}
