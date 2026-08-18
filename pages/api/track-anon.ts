import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { anon_id, ip, useragent } = req.body;
  if (!anon_id || !useragent) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const ipToHash = ip && typeof ip === 'string' && ip.trim() !== '' ? ip : 'unknown';
  const iphash = crypto.createHash("sha256").update(ipToHash).digest("hex");

  try {
    const existing = await prisma.verification.findUnique({ where: { anon_id } });
    const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (!existing) {
      await prisma.verification.create({
        data: { anon_id, iphash, useragent, verified: false, timestamp: new Date(), expireAt: defaultExpiry }
      });
    } else if (existing.iphash !== iphash || existing.useragent !== useragent) {
      await prisma.verification.update({
        where: { anon_id },
        data: { iphash, useragent, timestamp: new Date(), verified: false, expireAt: defaultExpiry }
      });
    }
  } catch (error) {
    console.warn("[track-anon] skipped because database is unavailable:", error);
  }
  return res.status(204).end();
}
