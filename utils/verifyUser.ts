// utils/verifyUser.ts
import { NextApiRequest } from "next";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

export const verifyUser = async (req: NextApiRequest) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      throw new Error("User not found");
    }

    return user; 
  } catch (err: any) {
    console.error("Token verification failed:", err);
    throw new Error("Unauthorized: Invalid or expired token");
  }
};
