import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(20),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(20).optional(),
});
