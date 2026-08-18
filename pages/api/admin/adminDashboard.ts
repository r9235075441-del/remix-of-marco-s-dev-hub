import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { JWT_SECRET } from "@/lib/jwtSecret";



function verifyAdminTokenFromCookie(req: NextApiRequest) {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies.admin_token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && (decoded as any).admin) return decoded;
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const admin = verifyAdminTokenFromCookie(req);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [userCount, batchCount, config] = await Promise.all([
      prisma.user.count(),
      prisma.batch.count(),
      prisma.serverConfig.findUnique({ where: { id: 1 }, include: { shortner_servers: true } }),
    ]);

    return res.status(200).json({
      userCount,
      batchCount,
      serverConfig: config,
    });
  } catch (err) {
    console.error("[adminDashboard] Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
