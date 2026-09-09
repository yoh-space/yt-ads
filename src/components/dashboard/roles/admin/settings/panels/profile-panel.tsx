"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { Profile } from "@/lib/operations-types";
import { Save, UserRound } from "lucide-react";
import { Button, Input } from "@/components/shared/ui";
import { FieldLabel, FormMessage, FormSection } from "../chrome/form";

/** Editable personal profile for the signed-in user (name + avatar URL). */
export function ProfilePanel({ profile }: { profile: Profile }) {
  const updateApplicationProfile = useMutation(api.users.updateApplicationProfile);
  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.updateUser({ name, image: image.trim() || null });
      if (result.error) throw new Error(result.error.message ?? "Unable to update the authentication profile.");
      await updateApplicationProfile({ name, image: image.trim() || undefined });
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/40 p-2">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-navy to-navy-2 text-xl font-bold text-white ring-2 ring-cyan/30">
            {profile.image ? (
              <img src={profile.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-foreground">{profile.name}</div>
            <div className="text-sm text-muted-foreground">{profile.email}</div>
            <span className="mt-2 inline-flex rounded-full bg-cyan/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-dark">
              {profile.role.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      <FormSection icon={<UserRound size={17} />} title="Profile information" note={profile.email}>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <FieldLabel>Display name</FieldLabel>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </div>

          <div>
            <FieldLabel>Profile image URL</FieldLabel>
            <Input
              placeholder="Optional image URL"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" type="submit" disabled={busy} className="inline-flex items-center gap-2">
              <Save size={15} />
              Save profile
            </Button>
            {message ? <FormMessage>{message}</FormMessage> : null}
          </div>
        </form>
      </FormSection>
    </div>
  );
}
