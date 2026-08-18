// pages/api/enrollBatch.ts
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

  const { batchId, name } = body;

  if (!batchId || !name) {
    return res.status(400).json({ success: false, message: "Missing batchId or name" });
  }

  try {
    const user = await authenticateUser(req, res);

    const existingEnrollment = await prisma.userEnrolledBatch.findFirst({
      where: { userId: user.id, batchId: batchId }
    });

    if (existingEnrollment) {
      return res.status(200).json({ success: true, message: "Already enrolled in this batch" });
    }

    await prisma.userEnrolledBatch.create({
      data: {
        userId: user.id,
        batchId: batchId,
        name: name
      }
    });

    return res.status(200).json({ success: true, message: "Batch enrolled successfully" });
  } catch (err: any) {
    console.error("Enroll error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
