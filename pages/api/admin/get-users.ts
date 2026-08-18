import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import axios from "axios";
import { getHeaders } from "@/utils/auth";
import { JWT_SECRET } from "@/lib/jwtSecret";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return handleGetUsers(req, res);
  if (req.method === "POST") return handleCheckTokenStatus(req, res);
  return res.status(405).json({ message: "Method not allowed" });
}

async function handleGetUsers(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== "object" || !(decoded as any).admin) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { page = "1", limit = "10", search = "" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const searchFilter = search
      ? {
          OR: [
            { UserName: { contains: search as string } },
            { phoneNumber: { contains: search as string } },
            { telegramId: { contains: search as string } },
            { tag: { contains: search as string } },
          ],
        }
      : {};

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where: searchFilter,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        select: {
          id: true,
          UserName: true,
          phoneNumber: true,
          telegramId: true,
          photoUrl: true,
          tag: true,
          tagExpiry: true,
          hasLoggedIn: true,
          createdAt: true,
          updatedAt: true,
          enrolledBatches: true,
          enrolledTokens: {
            select: {
              batch: {
                select: {
                  batchId: true,
                  batchName: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: searchFilter }),
    ]);

    // Map enrolledTokens → batches (purchased/active batches) for frontend compatibility
    const usersWithBatches = users.map((user) => {
      const seenBatchIds = new Set<string>();
      const uniqueBatches: { batchId: string; batchName: string }[] = [];

      if (user.enrolledTokens) {
        for (const token of user.enrolledTokens) {
          if (token.batch && !seenBatchIds.has(token.batch.batchId)) {
            seenBatchIds.add(token.batch.batchId);
            uniqueBatches.push({
              batchId: token.batch.batchId,
              batchName: token.batch.batchName,
            });
          }
        }
      }

      return {
        id: user.id,
        UserName: user.UserName,
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        photoUrl: user.photoUrl,
        tag: user.tag,
        tagExpiry: user.tagExpiry,
        hasLoggedIn: user.hasLoggedIn,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        enrolledBatches: user.enrolledBatches || [],
        batches: uniqueBatches,
      };
    });

    return res.status(200).json({
      users: usersWithBatches,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalUsers / limitNum),
        totalUsers,
        hasNextPage: pageNum * limitNum < totalUsers,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function handleCheckTokenStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== "object" || !(decoded as any).admin) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ActualToken: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.ActualToken) {
      return res.status(200).json({ status: "no_token", message: "User has no access token" });
    }

    const PW_API = process.env.PW_API;
    const url = `${PW_API}/v1/users/user-profile-info?fields=cohortId,board`;

    try {
      const response = await axios.get(url, { headers: getHeaders(user.ActualToken) });
      if (response.data.success === true) {
        return res.status(200).json({ status: "valid", message: "Token is valid" });
      }
    } catch (error: any) {
      const status = error.response?.status || 500;
      if (status === 401) return res.status(200).json({ status: "expired", message: "User token expired" });
      return res.status(200).json({ status: "error", message: error.response?.data?.message || "Error checking token status" });
    }
  } catch (error: any) {
    console.error("Error checking token status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
