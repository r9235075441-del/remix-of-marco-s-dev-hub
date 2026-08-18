import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import {
import { JWT_SECRET } from "@/lib/jwtSecret";
  DEFAULT_GLOBAL_TOKEN,
  checkPwToken,
  getGlobalTokenState,
} from "@/lib/globalToken";



function isAdmin(req: NextApiRequest) {
  const token = req.cookies?.admin_token;
  if (!token) return false;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return Boolean(decoded?.admin);
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAdmin(req)) return res.status(401).json({ message: "Unauthorized" });

  try {
    // Current global token + login state
    if (req.method === "GET") {
      const state = await getGlobalTokenState();
      const guestCount = await prisma.user.count({ where: { isGuest: true } as any });
      return res.status(200).json({ success: true, ...state, guestCount });
    }

    // Update global token / toggle login
    if (req.method === "PUT") {
      const {
        globalTokenId,
        globalTokenName,
        globalAccessToken,
        globalRefreshToken,
        globalRandomId,
        loginEnabled,
        guestLoginEnabled,
      } = req.body || {};

      const data: any = {};
      if (globalTokenId !== undefined) data.globalTokenId = globalTokenId || null;
      if (globalTokenName !== undefined) data.globalTokenName = globalTokenName || null;
      if (globalAccessToken !== undefined) data.globalAccessToken = globalAccessToken || null;
      if (globalRefreshToken !== undefined) data.globalRefreshToken = globalRefreshToken || null;
      if (globalRandomId !== undefined) data.globalRandomId = globalRandomId || null;
      if (typeof guestLoginEnabled === "boolean") data.guestLoginEnabled = guestLoginEnabled;

      const current = await getGlobalTokenState();
      const turningLoginOn =
        typeof loginEnabled === "boolean" && loginEnabled && !current.loginEnabled;
      if (typeof loginEnabled === "boolean") data.loginEnabled = loginEnabled;

      // Enabling login (or disabling guest access) revokes every guest session.
      if (turningLoginOn || guestLoginEnabled === false) {
        data.guestSessionEpoch = current.guestSessionEpoch + 1;
        await prisma.user.deleteMany({ where: { isGuest: true } as any });
      }

      await prisma.serverConfig.update({ where: { id: 1 }, data });

      // Keep live guest sessions on the newest token.
      if (data.globalAccessToken) {
        await prisma.user.updateMany({
          where: { isGuest: true } as any,
          data: {
            ActualToken: data.globalAccessToken,
            ActualRefresh: data.globalRefreshToken ?? current.globalRefreshToken,
            randomId: data.globalRandomId ?? current.globalRandomId,
          } as any,
        });
      }

      const state = await getGlobalTokenState();
      return res.status(200).json({ success: true, ...state });
    }

    // Verify any token (global token by default)
    if (req.method === "POST") {
      const { accessToken, userId } = req.body || {};
      let tokenToCheck: string | null = accessToken || null;

      if (!tokenToCheck && userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        tokenToCheck = user?.ActualToken || null;
      }
      if (!tokenToCheck) {
        const state = await getGlobalTokenState();
        tokenToCheck = state.globalAccessToken;
      }
      if (!tokenToCheck) {
        return res.status(400).json({ success: false, message: "No token to verify" });
      }

      const result = await checkPwToken(tokenToCheck);
      return res.status(200).json({ success: true, ...result });
    }

    // Revoke all guest sessions / reset token to default
    if (req.method === "DELETE") {
      const reset = req.query.reset === "true";
      const current = await getGlobalTokenState();
      const data: any = { guestSessionEpoch: current.guestSessionEpoch + 1 };
      if (reset) {
        data.globalTokenId = DEFAULT_GLOBAL_TOKEN.id;
        data.globalTokenName = DEFAULT_GLOBAL_TOKEN.name;
        data.globalAccessToken = DEFAULT_GLOBAL_TOKEN.accessToken;
        data.globalRefreshToken = DEFAULT_GLOBAL_TOKEN.refreshToken;
        data.globalRandomId = DEFAULT_GLOBAL_TOKEN.randomId;
      }
      await prisma.user.deleteMany({ where: { isGuest: true } as any });
      await prisma.serverConfig.update({ where: { id: 1 }, data });
      const state = await getGlobalTokenState();
      return res.status(200).json({ success: true, revoked: true, ...state });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
}
