import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

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
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  try {
    const type = (req.query.type as string) || "all"; // all | guest | user
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, parseInt((req.query.limit as string) || "20", 10));
    const search = (req.query.search as string) || "";

    const where: any = {};
    if (type === "guest") where.isGuest = true;
    if (type === "user") where.isGuest = false;
    if (search) {
      where.OR = [
        { UserName: { contains: search } },
        { phoneNumber: { contains: search } },
        { deviceId: { contains: search } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const sessions = rows.map((u: any) => ({
      id: u.id,
      name: u.UserName,
      phoneNumber: u.phoneNumber,
      isGuest: Boolean(u.isGuest),
      deviceId: u.deviceId,
      userAgent: u.userAgent,
      tag: u.tag,
      lastSeenAt: u.lastSeenAt,
      createdAt: u.createdAt,
      accessToken: u.ActualToken,
      refreshToken: u.ActualRefresh,
      sessionRefreshToken: u.refreshToken,
      randomId: u.randomId,
    }));

    return res.status(200).json({ success: true, total, page, limit, sessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
}
