import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { send } from 'expo-push-easy';

async function loadServiceAccount() {
  const explicitPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
  const fallbackPath = path.resolve(process.cwd(), 'service-account.json');
  const filePath = explicitPath ? path.resolve(process.cwd(), explicitPath) : fallbackPath;

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const token = process.env.PUSH_TOKEN;
  if (!token) {
    throw new Error('Set PUSH_TOKEN to the Expo or FCM token you want to test.');
  }

  const title = process.env.PUSH_TITLE ?? 'expo-push-easy test';
  const body = process.env.PUSH_BODY ?? 'This is a secure local test send.';
  const deepLink = process.env.PUSH_DEEP_LINK ?? 'expo-push-easy://test';

  const serviceAccount = await loadServiceAccount();
  const result = await send(
    token,
    {
      title,
      body,
      deepLink,
      data: { source: 'convex-example', mode: 'local-test' },
    },
    { serviceAccount },
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});