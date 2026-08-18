import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { authenticateUser } from "@/utils/authenticateUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: "Invalid JSON" });
    }
  }

  const { batchId } = body;

  if (!batchId) {
    return res.status(400).json({ success: false, message: "Missing batchId" });
  }

  try {
    const user = await authenticateUser(req, res);

    const deleted = await prisma.userEnrolledBatch.deleteMany({
      where: {
        userId: user.id,
        batchId: batchId
      }
    });

    if (deleted.count === 0) {
      return res.status(200).json({ success: true, message: "Batch not found or already removed" });
    }

    return res.status(200).json({ success: true, message: "Batch unenrolled successfully" });
  } catch (err: any) {
    console.error("Unenroll error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
