import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

/**
 * Next.js App Router route handlers for UploadThing file uploads.
 */
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
