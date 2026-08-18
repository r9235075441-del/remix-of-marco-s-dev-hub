import { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getGlobalTokenState } from "@/lib/globalToken";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ACCESS_EXPIRES_SECONDS = Number(
  process.env.JWT_ACCESS_EXPIRES_SECONDS
);
const JWT_REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS);

const generateAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${JWT_ACCESS_EXPIRES_SECONDS}s`,
  });

type JwtPayload = {
  userId: string;
  name: string;
  telegramId: string | null;
  PhotoUrl: string | null;
};

const generateRefreshToken = () => crypto.randomBytes(32).toString("hex");

export async function authenticateUser(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  if (!accessToken || !refreshToken) {
    clearAuthCookies(res);
    throw new Error("Unauthorized: No tokens provided");
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw new Error("User not found");
    await assertGuestSessionValid(user, res);
    return user;
  } catch (err: any) {
    if (err.name !== "TokenExpiredError") {
      clearAuthCookies(res);
      throw new Error("Unauthorized: Invalid access token");
    }

    try {
      const decoded = jwt.verify(accessToken, JWT_SECRET, {
        ignoreExpiration: true,
      }) as JwtPayload;

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) throw new Error("User not found");

      if (user.refreshToken !== refreshToken) {
        clearAuthCookies(res);
        throw new Error("Unauthorized: Refresh token mismatch");
      }

      const payload = {
        userId: user.id,
        name: user.UserName,
        telegramId: user.telegramId,
        PhotoUrl: user.photoUrl,
      };
      const newAccessToken = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken();

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      await assertGuestSessionValid(user, res);

      res.setHeader("Set-Cookie", [
        `accessToken=${newAccessToken}; Path=/; HttpOnly; SameSite=None; Max-Age=${JWT_ACCESS_EXPIRES_SECONDS}; Secure;`,
        `refreshToken=${newRefreshToken}; Path=/; HttpOnly; SameSite=None; Max-Age=${60 * 60 * 24 * JWT_REFRESH_EXPIRES_DAYS}; Secure;`,
      ]);

      return user;
    } catch {
      clearAuthCookies(res);
      throw new Error("Unauthorized: Refresh token invalid or expired");
    }
  }
}

/**
 * Guest sessions die when the admin enables login, disables guest access,
 * or bumps the guest epoch (revoke all). Guests also always ride the newest
 * global token.
 */
async function assertGuestSessionValid(user: any, res: NextApiResponse) {
  if (!user?.isGuest) return;
  const state = await getGlobalTokenState();
  if (state.loginEnabled || !state.guestLoginEnabled || user.guestEpoch !== state.guestSessionEpoch) {
    clearAuthCookies(res);
    throw new Error("Guest session revoked. Please login.");
  }
  if (state.globalAccessToken && user.ActualToken !== state.globalAccessToken) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ActualToken: state.globalAccessToken,
        ActualRefresh: state.globalRefreshToken,
        randomId: state.globalRandomId,
      } as any,
    });
    user.ActualToken = state.globalAccessToken;
    user.ActualRefresh = state.globalRefreshToken;
    user.randomId = state.globalRandomId;
  }
}

function clearAuthCookies(res: NextApiResponse) {
  res.setHeader("Set-Cookie", [
    `accessToken=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure`,
    `refreshToken=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure`,
  ]);
}
export { clearAuthCookies };
