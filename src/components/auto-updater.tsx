"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";

/**
 * Desktop-only background service that checks for application updates on
 * startup and applies them with zero manual intervention.
 *
 * When running inside a Tauri WebView an available update is downloaded in
 * the background and a non-intrusive toast prompts for a restart. On Windows
 * the update is installed in passive mode, so the app relaunches automatically
 * after installation. Anywhere else (normal browser or the plain Next dev
 * server) this component renders nothing and stays inert, keeping the shared
 * web client untouched.
 */
export function AutoUpdater() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!isTauri()) return;

    async function run() {
      let update: Update | null;
      try {
        update = await check();
      } catch {
        return;
      }
      if (!update) return;

      toast("An update is available. Download & Restart?", {
        description: `v${update.version} is ready to install`,
        duration: 20000,
        action: {
          label: "Update",
          onClick: () => {
            void apply(update);
          },
        },
      });
    }

    async function apply(update: Update) {
      try {
        const progress = toast.loading(`Downloading & installing v${update.version}…`);
        await update.downloadAndInstall((event) => {
          if (event.event === "Progress") {
            toast.loading(`Downloading update…`, { id: progress });
          }
        });
        toast.dismiss(progress);
        toast.success("Update installed. Restarting…");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Update failed.");
      }
    }

    void run();
  }, []);

  return null;
}
