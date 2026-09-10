import { SERVICE_IDS, type ServiceId } from "./services";
import { findMaterialSpecification } from "./material-specifications";

export type ServiceSpecificationField = {
  key: string;
  label: string;
  material: string;
  options: readonly string[];
};

function catalogOptions(material: string, predicate?: (option: string) => boolean): readonly string[] {
  const options = findMaterialSpecification(material)?.specificationOptions ?? [];
  return predicate ? options.filter(predicate) : options;
}

const thicknessOptions = (material: string) => catalogOptions(material, (option) => /^\d+mm$/.test(option));
const colorOptions = (material: string) => catalogOptions(material, (option) => !/^\d+mm$/.test(option));
const field = (key: string, label: string, material: string, options = catalogOptions(material)): ServiceSpecificationField => ({ key, label, material, options });

export const SERVICE_SPECIFICATION_FIELDS: Record<ServiceId, readonly ServiceSpecificationField[]> = {
  banner_print: [field("rollWidth", "Roll substrate", "Banner Flex")],
  sticker_white: [field("rollWidth", "Roll substrate", "Frosted Sticker")],
  sticker_transparent: [field("rollWidth", "Roll substrate", "Transparent Sticker")],
  sticker_reflective: [field("rollWidth", "Roll substrate", "Reflective Sticker")],
  sticker_mesh: [field("rollWidth", "Roll substrate", "Mesh Sticker")],
  sticker_frosted: [field("rollWidth", "Roll substrate", "Frosted Sticker")],
  hq_print_and_cut: [field("rollWidth", "Roll substrate", "Banner Flex")],
  light_box_a1: [
    field("screenSize", "Digital screen size", "Digital Screen"),
    field("faceMaterial", "Face material", "Mica Sheet", (catalogOptions("Mica Sheet").length ? ["Mica Sheet"] : ["Mica"])),
    field("thickness", "Face thickness", "Mica", thicknessOptions("Mica")),
    field("color", "Face color", "Mica", colorOptions("Mica")),
    field("lightingType", "Lighting type", "LED Modules", ["LED Modules"]),
    field("ledColor", "LED color", "LED Modules"),
    field("powerSupply", "Power supply", "Power Supply"),
  ],
  light_box_a2: [
    field("screenSize", "Digital screen size", "Digital Screen"),
    field("faceMaterial", "Face material", "Mica Sheet", (catalogOptions("Mica Sheet").length ? ["Mica Sheet"] : ["Mica"])),
    field("thickness", "Face thickness", "Mica", thicknessOptions("Mica")),
    field("color", "Face color", "Mica", colorOptions("Mica")),
    field("lightingType", "Lighting type", "LED Modules", ["LED Modules"]),
    field("ledColor", "LED color", "LED Modules"),
    field("powerSupply", "Power supply", "Power Supply"),
  ],
  neon_light: [field("neonColor", "Neon color", "Neon Light Flex"), field("powerSupply", "Power supply", "Power Supply")],
  roll_up_standard: [field("standModel", "Stand model", "Roll-Up Stands", ["Standard Roll-Up Stand"])],
  roll_up_deluxe: [field("standModel", "Stand model", "Roll-Up Stands", ["Deluxe Roll-Up Stand"])],
  uv_print_mica: [field("thickness", "Mica thickness", "Mica", thicknessOptions("Mica")), field("color", "Mica color", "Mica", colorOptions("Mica"))],
  uv_print_foam: [field("thickness", "Foam thickness", "Foam Board")],
  uv_print_cladding: [field("color", "Cladding color", "Cladding")],
  uv_print_canvas: [field("rollWidth", "Canvas width", "Canvas")],
  foam_cutout: [field("thickness", "Foam thickness", "Foam Board")],
  foam_engrave: [field("thickness", "Foam thickness", "Foam Board")],
  mica_cutout: [field("thickness", "Mica thickness", "Mica", thicknessOptions("Mica")), field("color", "Mica color", "Mica", colorOptions("Mica"))],
  mica_engrave: [field("thickness", "Mica thickness", "Mica", thicknessOptions("Mica")), field("color", "Mica color", "Mica", colorOptions("Mica"))],
  dtf: [field("garmentSize", "T-shirt size", "T-Shirts"), field("filmWidth", "DTF film", "DTF Film")],
  sublimation: [field("garmentSize", "Garment size", "T-Shirts")],
};

export function serviceSpecificationFields(serviceId: string): readonly ServiceSpecificationField[] {
  return SERVICE_SPECIFICATION_FIELDS[serviceId as ServiceId] ?? [];
}

export function validateServiceSpecifications(serviceId: string, input?: Record<string, string>): Record<string, string> | undefined {
  const fields = serviceSpecificationFields(serviceId);
  if (fields.length === 0) return input && Object.keys(input).length ? input : undefined;
  if (!input) throw new Error("Select the required material specifications for this service.");
  const normalized: Record<string, string> = {};
  for (const specification of fields) {
    const value = input[specification.key]?.trim();
    if (!value || !specification.options.includes(value)) {
      throw new Error(`${specification.label} must be selected from the confirmed material catalog options.`);
    }
    normalized[specification.key] = value;
  }
  return normalized;
}

export const SERVICE_SPECIFICATION_SERVICE_IDS = SERVICE_IDS;
