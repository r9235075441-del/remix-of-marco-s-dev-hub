import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getGlobalTokenState } from "@/lib/globalToken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";
const ACCESS_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 3600);
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

export const dynamic = "force-dynamic";

function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/study";
  if (next.startsWith("/api")) return "/study";
  return next;
}

/**
 * Guest gateway.
 * - Login enabled  -> send visitor to /auth
 * - Login disabled -> create a per-device guest session that runs on the
 *   global PW token, then continue to the requested page.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const state = await getGlobalTokenState();

  if (state.loginEnabled || !state.guestLoginEnabled) {
    const res = NextResponse.redirect(new URL("/auth?login=1", req.url));
    res.cookies.set("accessToken", "", { path: "/", expires: new Date(0) });
    res.cookies.set("refreshToken", "", { path: "/", expires: new Date(0) });
    res.cookies.set("guest_id", "", { path: "/", expires: new Date(0) });
    return res;
  }

  // One guest identity per device (guest_id cookie).
  let deviceId = req.cookies.get("guest_id")?.value || crypto.randomUUID();
  const phoneNumber = `guest_${deviceId}`;
  const userAgent = req.headers.get("user-agent") || "";

  const guest = await prisma.user.upsert({
    where: { phoneNumber },
    update: {
      ActualToken: state.globalAccessToken,
      ActualRefresh: state.globalRefreshToken,
      randomId: state.globalRandomId,
      guestEpoch: state.guestSessionEpoch,
      isGuest: true,
      lastSeenAt: new Date(),
      userAgent,
    } as any,
    create: {
      UserName: state.globalTokenName || "Guest User",
      phoneNumber,
      tag: "guest",
      isGuest: true,
      deviceId,
      userAgent,
      guestEpoch: state.guestSessionEpoch,
      hasLoggedIn: true,
      lastSeenAt: new Date(),
      ActualToken: state.globalAccessToken,
      ActualRefresh: state.globalRefreshToken,
      randomId: state.globalRandomId,
    } as any,
  });

  const refreshToken = crypto.randomBytes(32).toString("hex");
  const accessToken = jwt.sign(
    {
      userId: guest.id,
      name: guest.UserName,
      telegramId: guest.telegramId,
      PhotoUrl: guest.photoUrl,
      guest: true,
      epoch: state.guestSessionEpoch,
    },
    JWT_SECRET,
    { expiresIn: `${ACCESS_SECONDS}s` }
  );

  await prisma.user.update({
    where: { id: guest.id },
    data: { refreshToken },
  });

  const res = NextResponse.redirect(new URL(next, req.url));
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("accessToken", accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: ACCESS_SECONDS,
  });
  res.cookies.set("refreshToken", refreshToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 24 * REFRESH_DAYS,
  });
  res.cookies.set("guest_id", deviceId, {
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
