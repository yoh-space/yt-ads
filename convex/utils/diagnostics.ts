import { ConvexError } from "convex/values";

/** Preserve actionable mutation errors for clients instead of Convex's generic Server Error. */
export function throwAsConvexError(error: unknown): never {
  if (error instanceof ConvexError) throw error;
  const message = error instanceof Error && error.message ? error.message : String(error);
  throw new ConvexError(message);
}

/** Run a mutation body while preserving its actionable error message for clients. */
export async function runDiagnosable<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throwAsConvexError(error);
  }
}
