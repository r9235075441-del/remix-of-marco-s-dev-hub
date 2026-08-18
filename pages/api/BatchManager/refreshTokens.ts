import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

async function sendTelegramLog(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text: message, parse_mode: "Markdown" }),
    });
  } catch (err: any) {
    console.error("Failed to send Telegram log:", err);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const batches = await prisma.batch.findMany({
      where: { batchStatus: true },
      include: { enrolledTokens: true },
    });

    // Collect unique tokens keyed by ownerId:refreshToken
    const tokenMap = new Map<string, { ownerId: string; refreshToken: string; tokenIds: string[] }>();

    for (const batch of batches) {
      for (const token of batch.enrolledTokens) {
        if (!token.tokenStatus || !token.refreshToken) continue;
        const key = `${token.ownerId}:${token.refreshToken}`;
        if (!tokenMap.has(key)) {
          tokenMap.set(key, { ownerId: token.ownerId, refreshToken: token.refreshToken, tokenIds: [token.id] });
        } else {
          tokenMap.get(key)!.tokenIds.push(token.id);
        }
      }
    }

    for (const [, entry] of tokenMap.entries()) {
      const { ownerId, refreshToken, tokenIds } = entry;
      const randomId = uuidv4();

      try {
        const response = await fetch("https://api.penpencil.co/v3/oauth/refresh-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Randomid: randomId },
          body: JSON.stringify({ refresh_token: refreshToken, client_id: "system-admin" }),
        });

        if (!response.ok) throw new Error("Refresh failed");

        const { data } = await response.json();
        const access = data.access_token;
        const refresh = data.refresh_token;

        await prisma.enrolledToken.updateMany({
          where: { id: { in: tokenIds } },
          data: { accessToken: access, refreshToken: refresh, updatedAt: new Date(), tokenStatus: true, randomId },
        });

        await prisma.user.update({
          where: { id: ownerId },
          data: { ActualToken: access, ActualRefresh: refresh },
        });
      } catch (err: any) {
        console.error("Failed to refresh token for", ownerId, err);
        await prisma.enrolledToken.updateMany({
          where: { id: { in: tokenIds } },
          data: { tokenStatus: false, updatedAt: new Date() },
        });
      }
    }

    const now = new Date();
    const formattedDate = now.toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });

    await sendTelegramLog(`✅ *Batch Tokens Refreshed Successfully!*\n\n🗓 *Date (IST):* ${formattedDate}\n📦 *Batches Updated:* ${batches.length}\n🔑 *Tokens Refreshed:* ${tokenMap.size}`);

    return res.status(200).json({ success: true, message: "Token refresh cycle complete." });
  } catch (error) {
    console.error("Fatal refresh error:", error);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
}
