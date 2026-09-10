export const ETHIOPIAN_MOBILE_REGEX = /^(\+251|0)(9|7)\d{8}$/;

export function stripPhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

export function normalizePhone(raw: string): string | null {
  const cleaned = stripPhone(raw).trim();
  if (!cleaned) return null;

  if (cleaned.startsWith("+251")) {
    const rest = cleaned.slice(4);
    if (rest.startsWith("9") || rest.startsWith("7")) {
      if (/^(9|7)\d{8}$/.test(rest)) {
        return `+251${rest}`;
      }
    }
    return null;
  }

  if (cleaned.startsWith("09") || cleaned.startsWith("07")) {
    if (ETHIOPIAN_MOBILE_REGEX.test(cleaned)) {
      return `+251${cleaned.slice(1)}`;
    }
    return null;
  }

  return null;
}

export function isValidEthiopianPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

export function displayPhone(normalized: string): string {
  if (!normalized.startsWith("+251")) return normalized;
  const digits = normalized.slice(4);
  if (digits.length === 9) {
    return `${digits.slice(0, 1)}-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return normalized;
}
