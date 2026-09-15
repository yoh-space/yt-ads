import type { Profile } from "@shared-lib/operations-types";
import type { Doc } from "@convex/dataModel";

/** Document shape of the users table returned by api.users.getCurrentProfile. */
export type ProfileDoc = Doc<"users">;

/** Converts a users-table document to the shared Profile type. */
export function toProfile(doc: ProfileDoc): Profile {
  return {
    id: doc._id,
    authUserId: doc.authUserId,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    active: doc.active,
    image: doc.image,
  };
}