import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_CHANNEL_ID = process.env.LOG_CHANNEL_ID!;
const BASE_URL = process.env.PW_API;
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_ACCESS_EXPIRES_SECONDS = Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 3600);
const JWT_REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 15);

async function sendTelegramLog(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err: any) {
    console.error("Failed to send Telegram log:", err);
  }
}

function normalizePhoneNumber(phone: string): string {
  phone = phone.trim().replace(/[^\d+]/g, "");
  return phone.startsWith("+") ? phone : "+91" + phone;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phoneNumber = body.phoneNumber || body.username;
    const otp = body.otp;

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { success: false, message: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Automatically use Prisma instead of Mongoose
    const config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
    const isDirectLogin = config?.isDirectLoginOpen ?? false;

    let user = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });

    if (!isDirectLogin && !user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const randomId = uuidv4();
    const response = await fetch(`${BASE_URL}/v3/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Randomid: randomId,
      },
      body: JSON.stringify({
        username: phoneNumber,
        otp: otp,
        client_id: "system-admin",
        client_secret: "KjPXuAVfC5xbmgreETNMaL7z",
        grant_type: "password",
        organizationId: "5eb393ee95fab7468a79d189",
        latitude: 0,
        longitude: 0,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data) {
      return NextResponse.json({ success: false, message: "OTP verification failed!", data }, { status: 401 });
    }

    if (!user && isDirectLogin) {
      const userImage = data.data.user.imageId;
      user = await prisma.user.create({
        data: {
          UserName: (data.data.user.firstName + " " + (data.data.user.lastName || "")).trim(),
          phoneNumber: normalizedPhone,
          telegramId: null,
          photoUrl: userImage?.baseUrl && userImage?.key ? userImage.baseUrl + userImage.key : null,
          tag: "user",
          tagExpiry: null,
          hasLoggedIn: false,
        }
      });
    }

    if (!user) {
      return NextResponse.json({ success: false, message: "Failed to load or create user" }, { status: 500 });
    }

    const realAccessToken = data.data.access_token;
    const realRefreshToken = data.data.refresh_token;

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        ActualToken: realAccessToken,
        ActualRefresh: realRefreshToken,
        randomId: randomId,
      }
    });

    // Sync all existing tokens synchronously first (takes milliseconds) so the user can immediately access current courses
    await prisma.enrolledToken.updateMany({
      where: { ownerId: user.id },
      data: {
        accessToken: realAccessToken,
        refreshToken: realRefreshToken,
        updatedAt: new Date(),
        randomId: randomId,
        tokenStatus: true,
      },
    });

    // Run heavy Penpencil batch fetching and upserting asynchronously in the background
    const syncBatchesPromise = (async () => {
      try {
        const { getBatchInfo } = await import("@/lib/batch");

        async function fetchPurchasedBatches(accessToken: string, amount: string) {
          const rid = uuidv4();
          const response = await fetch(
            `${BASE_URL}/batch-service/v1/batches/purchased-batches?page=1&type=ALL&amount=${amount}`,
            {
              method: "GET",
              headers: {
                accept: "application/json, text/plain, */*",
                authorization: `Bearer ${accessToken}`,
                "client-id": "5eb393ee95fab7468a79d189",
                "client-type": "WEB",
                "client-version": "1.1.1",
                randomid: rid,
              },
            }
          );
          const resData = await response.json().catch(() => ({}));
          if (!resData.success || !Array.isArray(resData.data)) return [];
          return resData.data.map((item: any) => item.batch || item);
        }

        const [paidBatches, freeBatches] = await Promise.all([
          fetchPurchasedBatches(realAccessToken, "paid"),
          fetchPurchasedBatches(realAccessToken, "free")
        ]);
        const allBatches = [...paidBatches, ...freeBatches];

        for (const batch of allBatches) {
          const batchDetails = await getBatchInfo(batch._id, "details");
          const batchPrice = batchDetails?.fee?.total || 0;
          const batchDoc = {
            batchName: batchDetails?.name || batch.name || "Unknown Batch",
            batchPrice: batchPrice,
            batchImage:
              batchDetails?.iosPreviewImageUrl ||
              (batchDetails?.previewImage?.baseUrl && batchDetails?.previewImage?.key
                ? batchDetails.previewImage.baseUrl + batchDetails.previewImage.key
                : ""),
            template: batchDetails?.template || "NORMAL",
            BatchType: batchPrice > 0 ? ("PAID" as const) : ("FREE" as const),
            language: batchDetails?.language || "English",
            byName: batchDetails?.byName || "Unknown",
            startDate: batchDetails?.startDate || "",
            endDate: batchDetails?.endDate || "",
            batchStatus: !(batchDetails?.isBlocked || batch.isBlocked),
          };

          const upsertedBatch = await prisma.batch.upsert({
            where: { batchId: batch._id },
            update: batchDoc,
            create: {
              batchId: batch._id,
              ...batchDoc,
            },
          });

          // Update or create enrolled tokens (for video access)
          const existingToken = await prisma.enrolledToken.findFirst({
            where: { ownerId: user!.id, batchId: upsertedBatch.id },
          });

          if (existingToken) {
            await prisma.enrolledToken.update({
              where: { id: existingToken.id },
              data: {
                accessToken: realAccessToken,
                refreshToken: realRefreshToken,
                tokenStatus: true,
                randomId,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.enrolledToken.create({
              data: {
                ownerId: user!.id,
                batchId: upsertedBatch.id,
                accessToken: realAccessToken,
                refreshToken: realRefreshToken,
                tokenStatus: true,
                randomId,
              },
            });
          }
        }
        console.log(`[Batch Sync Success] for user ${user!.phoneNumber}`);
      } catch (syncErr) {
        console.error("[Background Batch Sync Error]:", syncErr);
      }
    })();

    // Defer execution until after response has been sent on platforms that support it (Vercel)
    if (typeof (req as any).waitUntil === "function") {
      (req as any).waitUntil(syncBatchesPromise);
    }

    const payload = {
      userId: user.id,
      name: user.UserName,
      telegramId: user.telegramId,
      PhotoUrl: user.photoUrl,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRES_SECONDS,
    });

    let refreshToken = "";
    while (true) {
      refreshToken = crypto.randomBytes(64).toString("hex");
      const existing = await prisma.user.findFirst({ where: { refreshToken } });
      if (!existing) break;
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshToken,
        hasLoggedIn: true,
      }
    });

    const res = NextResponse.json({
      success: true,
      message: "OTP verified",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.UserName,
        telegramId: user.telegramId,
        photoUrl: user.photoUrl,
      },
    });

    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set("accessToken", accessToken, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 15,
      sameSite: isProd ? "none" : "lax",
    });
    res.cookies.set("refreshToken", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      maxAge: 60 * 60 * 24 * JWT_REFRESH_EXPIRES_DAYS,
      sameSite: isProd ? "none" : "lax",
    });

    return res;
  } catch (err: any) {
    console.error("OTP Verification Error:", err);
    return NextResponse.json({ success: false, message: "Server error", err: err.message }, { status: 500 });
  }
}
