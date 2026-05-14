import { z } from "zod";

export const platformParamSchema = z.object({ platform: z.string().min(1) });
