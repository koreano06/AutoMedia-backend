import { z } from "zod";

export const runDiagnosticsChecksSchema = z.object({
  checks: z.array(z.string()).optional(),
});

