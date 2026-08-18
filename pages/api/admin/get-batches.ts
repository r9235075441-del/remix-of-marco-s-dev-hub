import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import axios from "axios";
import { getHeaders } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return handleGetBatches(req, res);
  if (req.method === "POST") return handleCheckActiveTokens(req, res);
  return res.status(405).json({ message: "Method not allowed" });
}

async function handleGetBatches(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
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
            { batchName: { contains: search as string } },
            { batchId: { contains: search as string } },
            { byName: { contains: search as string } },
            { language: { contains: search as string } },
          ],
        }
      : {};

    const [batches, totalBatches] = await Promise.all([
      prisma.batch.findMany({
        where: searchFilter,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        include: {
          enrolledTokens: {
            include: { user: { select: { id: true, UserName: true, phoneNumber: true, telegramId: true } } }
          }
        },
      }),
      prisma.batch.count({ where: searchFilter }),
    ]);

    const batchesWithUsers = batches.map((batch) => {
      const { enrolledTokens, ...batchWithoutTokens } = batch;
      const enrolledUsers = enrolledTokens.map((t) => ({
        id: t.user.id,
        UserName: t.user.UserName,
        phoneNumber: t.user.phoneNumber,
        telegramId: t.user.telegramId,
        tokenStatus: t.tokenStatus,
        updatedAt: t.updatedAt,
      }));
      return { ...batchWithoutTokens, enrolledUsers };
    });

    return res.status(200).json({
      batches: batchesWithUsers,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalBatches / limitNum),
        totalBatches,
        hasNextPage: pageNum * limitNum < totalBatches,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching batches:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function handleCheckActiveTokens(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "changeme");
    if (!decoded || typeof decoded !== "object" || !(decoded as any).admin) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ message: "Batch ID is required" });

    const batch = await prisma.batch.findUnique({
      where: { batchId },
      include: { enrolledTokens: true },
    });
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const PW_API = process.env.PW_API;
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const t of batch.enrolledTokens) {
      if (!t.accessToken || !t.randomId) {
        failedCount++;
        results.push({ userId: t.ownerId, status: "no_token", message: "No access token or random ID" });
        continue;
      }

      try {
        const url = `${PW_API}/v1/users/user-profile-info?fields=cohortId`;
        const response = await axios.get(url, { headers: getHeaders(t.accessToken) });
        if (response.data.success === true) {
          successCount++;
          results.push({ userId: t.ownerId, status: "success", message: "Token is active" });
        }
      } catch (error: any) {
        failedCount++;
        results.push({ userId: t.ownerId, status: "failed", message: error.response?.data?.message || "Token check failed" });
      }
    }

    return res.status(200).json({ batchId, totalTokens: batch.enrolledTokens.length, successCount, failedCount, results });
  } catch (error: any) {
    console.error("Error checking active tokens:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
