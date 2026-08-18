import type { NextApiRequest, NextApiResponse } from "next";
import { clearAuthCookies } from "@/utils/authenticateUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    clearAuthCookies(res);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
