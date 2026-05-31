import { prisma } from "../../database/prisma.js";

export const authRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  createRefreshToken(payload: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.authRefreshToken.create({
      data: {
        userId: payload.userId,
        tokenHash: payload.tokenHash,
        expiresAt: payload.expiresAt,
      },
    });
  },

  findRefreshToken(tokenHash: string) {
    return prisma.authRefreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  },

  revokeRefreshToken(tokenHash: string) {
    return prisma.authRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

