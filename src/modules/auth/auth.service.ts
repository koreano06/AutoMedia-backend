import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export const authService = {
  login(payload: { email?: string; username?: string }) {
    const user = {
      id: "user_admin",
      name: "Administrador",
      email: payload.email || "admin@automedia.local",
      username: payload.username || "admin",
      role: "admin",
    };
    const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "7d" });
    return { user, token };
  },

  me() {
    return { id: "user_admin", name: "Administrador", username: "admin", role: "admin" };
  },
};
