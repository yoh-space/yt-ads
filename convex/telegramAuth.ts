type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type VerifiedTelegramInitData = {
  telegramId: string;
  user: TelegramUser;
  authDate: number;
};

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string | ArrayBuffer, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? new TextEncoder().encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

/** Validates Telegram Web App initData using the bot token HMAC contract. */
export async function verifyTelegramInitData(initData: string, maxAgeSeconds = 24 * 60 * 60): Promise<VerifiedTelegramInitData> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!receivedHash || !Number.isInteger(authDate) || !userRaw) throw new Error("Invalid Telegram initData.");
  if (Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) throw new Error("Telegram session has expired.");

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await hmacSha256("WebAppData", token);
  const expectedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (expectedHash.length !== receivedHash.length) throw new Error("Invalid Telegram signature.");
  let mismatch = 0;
  for (let index = 0; index < expectedHash.length; index += 1) mismatch |= expectedHash.charCodeAt(index) ^ receivedHash.charCodeAt(index);
  if (mismatch !== 0) throw new Error("Invalid Telegram signature.");

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new Error("Invalid Telegram user payload.");
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) throw new Error("Invalid Telegram user payload.");
  return { telegramId: String(user.id), user, authDate };
}
