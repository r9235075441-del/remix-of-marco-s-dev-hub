import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { parse } from "cookie";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

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
  try {
    const admin = verifyAdminTokenFromCookie(req);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.method === "GET") {
      const config = await prisma.serverConfig.findUnique({
        where: { id: 1 },
        include: { shortner_servers: true }
      });
      return res.status(200).json({ serverConfig: config });
    }

    if (req.method === "PUT") {
      const update: any = { ...req.body };

      if (update.password) {
        const salt = await bcrypt.genSalt(10);
        update.password = await bcrypt.hash(update.password, salt);
      } else {
        delete update.password;
      }

      delete update._id;
      delete update.__v;
      delete update.updatedAt;
      delete update.id;
      delete update.shortner_servers;

      const config = await prisma.serverConfig.upsert({
        where: { id: 1 },
        update: update,
        create: {
          id: 1,
          webName: update.webName || "PW-MARCO",
          registrationOpen: update.registrationOpen ?? true,
          sidebarLogoUrl: update.sidebarLogoUrl || "https://i.ibb.co/YBbwNGxz/Logo-pw-removebg-preview.png",
          sidebarTitle: update.sidebarTitle || "PW-MARCO",
          isDirectLoginOpen: update.isDirectLoginOpen ?? true,
          password: update.password || "",
          tg_bot: update.tg_bot || "",
          tg_channel: update.tg_channel || "",
          tg_username: update.tg_username || "",
          username: update.username || "admin",
        }
      });

      return res.status(200).json({ serverConfig: config });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err) {
    console.error("[serverConfig] Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
