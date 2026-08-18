import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { authenticateUser } from "@/utils/authenticateUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { page = "1" } = req.query;
  const pageNum = parseInt(page as string, 10);

  if (isNaN(pageNum) || pageNum <= 0) {
    return res.status(400).json({ message: "Invalid page parameter" });
  }

  try {
    await authenticateUser(req, res); // <-- secure route with token refresh

    // Proceed with your logic now user is authenticated
    const FIXED_LIMIT = 10;
    const skip = (pageNum - 1) * FIXED_LIMIT;

    const data = await prisma.batch.findMany({
      skip,
      take: FIXED_LIMIT,
      orderBy: { createdAt: "desc" },
    });

    const totalItems = await prisma.batch.count();

    return res.status(200).json({
      success: true,
      currentPage: pageNum,
      totalPages: Math.ceil(totalItems / FIXED_LIMIT),
      totalItems,
      data,
    });
  } catch (err: any) {
    return res.status(401).json({ message: err.message || "Unauthorized" });
  }
}
