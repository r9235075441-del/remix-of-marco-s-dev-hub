import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { authenticateUser } from "@/utils/authenticateUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, page = "1" } = req.query;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Missing or invalid `name` query" });
  }

  const limit = 10;
  const currentPage = parseInt(page as string, 10);
  const skip = (currentPage - 1) * limit;

  try {
    await authenticateUser(req, res);

    const query = {
      batchName: { contains: name }
    };

    const totalItems = await prisma.batch.count({ where: query });
    const batches = await prisma.batch.findMany({
      where: query,
      skip,
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: batches,
      currentPage,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
    });
  } catch (error) {
    console.error("Database search error:", error);
    return res.status(500).json({ message: "Error While Searching Batches" });
  }
}
