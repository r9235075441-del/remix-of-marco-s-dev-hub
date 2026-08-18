import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import prisma from "@/lib/prisma";
import { getVideoHeaders } from "@/utils/auth";
import { authenticateUser } from "@/utils/authenticateUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { batchId, subjectId, childId } = req.query;

  try {
    const PW_API = process.env.PW_API;

    const user = await authenticateUser(req, res);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!batchId || !subjectId || !childId) {
      return res.status(400).json({
        message: "`batchId`, `subjectId`, and `childId` are required",
      });
    }

    const batch = await prisma.batch.findUnique({
      where: { batchId: batchId as string },
      include: { enrolledTokens: true },
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    for (const token of batch.enrolledTokens) {
      if (!token.accessToken || !token.randomId) continue;

      try {
        const url = `${PW_API}/v1/videos/video-url-details?type=BATCHES&videoContainerType=DASH&reqType=query&childId=${childId}&parentId=${batchId}&clientVersion=201`;
        const headers = getVideoHeaders(token.accessToken, token.randomId);
        const response = await axios.get(url, { headers });
        return res.status(200).json(response.data);
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.warn(`Token for owner ${token.ownerId} failed. Removing it.`);

          await prisma.enrolledToken.delete({ where: { id: token.id } });

          // Also remove from user's enrolled batches - disabled to save permanently
          /*
          await prisma.userEnrolledBatch.deleteMany({
            where: {
              userId: token.ownerId,
              batchId: batch.batchId,
            },
          });
          */

          continue;
        } else {
          const status = error.response?.status || 500;
          return res.status(status).json({
            success: false,
            message: error.response?.data?.message || error.message || "Something went wrong",
          });
        }
      }
    }

    return res.status(403).json({
      success: false,
      message: "This Batch is unavailable. Please contact admin to add this batch.",
    });
  } catch (error: any) {
    console.error("Outer error in get-video-url:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected server error occurred",
    });
  }
}
