import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

export { convexUrl };

export const convex = new ConvexReactClient(convexUrl ?? "https://local-placeholder.convex.cloud");