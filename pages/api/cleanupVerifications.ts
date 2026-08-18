// pages/api/trigger-cleanup.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = Date.now();

  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return res.status(200).json({ status: "skipped", reason: "recent cleanup already done" });
  }

  lastCleanupTime = now;

  try {
    const deleted = await prisma.verifiedBatch.deleteMany({
      where: {
        expireAt: {
          not: null,
          lte: new Date()
        }
      }
    });

    return res.status(200).json({ status: "cleaned", deleted: deleted.count });
  } catch (error) {
    console.warn("[cleanupVerifications] skipped because database is unavailable:", error);
    return res.status(200).json({ status: "skipped", reason: "database unavailable" });
  }
}
