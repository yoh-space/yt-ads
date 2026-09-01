import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  throw new Error("Could not load .env.local. Make sure it exists in the project root.");
}

const TELEGRAM_API = "https://api.telegram.org";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured. Add it to .env.local");
  }
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured. Add it to .env.local");
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram`;
  const endpoint = `${TELEGRAM_API}/bot${token}/setWebhook`;

  console.log(`Registering webhook -> ${webhookUrl}`);

  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
  };
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) payload.secret_token = webhookSecret;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { ok: boolean; description?: string };

  if (result.ok) {
    console.log(`✅ Webhook registered successfully: ${webhookUrl}`);
  } else {
    console.error(`❌ Webhook registration failed: ${result.description ?? "Unknown error"}`);
    process.exitCode = 1;
  }

  const info = await fetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
  const infoResult = (await info.json()) as { result?: { url?: string; pending_update_count?: number } };
  if (infoResult.result) {
    console.log("Current webhook info:");
    console.log(`  URL:     ${infoResult.result.url ?? "(none)"}`);
    console.log(`  Pending: ${infoResult.result.pending_update_count ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
