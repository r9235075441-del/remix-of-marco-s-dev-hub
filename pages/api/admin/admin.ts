import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/jwtSecret";

const isProd = process.env.NODE_ENV === "production";

/**
 * Admin login.
 *
 * Order of checks:
 *  1. ServerConfig row in the database (created by `npm run seed`).
 *  2. ADMIN_USERNAME / ADMIN_PASSWORD environment variables — so the panel is
 *     reachable even before the database has been seeded (or if it is down).
 *
 * Every failure path returns JSON so the client never gets an HTML 500 page
 * (which showed up in the UI as "Network error. Please try again.").
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { username, password } = (req.body || {}) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Username and password required" });
    }

    let matched = false;

    // 1) Database-backed admin
    try {
      const config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
      if (config?.username && config?.password) {
        const passwordOk = config.password.startsWith("$2")
          ? await bcrypt.compare(password, config.password)
          : password === config.password;
        matched = passwordOk && username === config.username;
      }
    } catch (dbErr) {
      console.error("[admin login] Database unavailable, falling back to env:", dbErr);
    }

    // 2) Environment-variable admin
    if (!matched) {
      const envUser = process.env.ADMIN_USERNAME;
      const envPass = process.env.ADMIN_PASSWORD;
      if (envUser && envPass && username === envUser && password === envPass) {
        matched = true;
      }
    }

    if (!matched) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ admin: true, username }, JWT_SECRET, {
      expiresIn: "2h",
    });

    const cookieSecurity = isProd ? "; SameSite=Lax; Secure" : "; SameSite=Lax";

    res.setHeader("Set-Cookie", [
      `admin_token=${token}; Path=/; HttpOnly${cookieSecurity}; Max-Age=${60 * 60 * 2}`,
    ]);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[admin login] Unexpected error:", err);
    return res
      .status(500)
      .json({ success: false, message: err?.message || "Internal server error" });
  }
}
