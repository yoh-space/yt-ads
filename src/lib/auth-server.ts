import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://local-placeholder.convex.cloud";
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://local-placeholder.convex.site";

export const {
  handler,
  isAuthenticated,
  fetchAuthQuery,
} = convexBetterAuthNextJs({ convexUrl, convexSiteUrl });
