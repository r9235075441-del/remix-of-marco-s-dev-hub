import prisma from "@/lib/prisma";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { anon_id, batchId } = req.body;
  if (!anon_id) return res.status(400).json({ error: "anon_id is required" });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const doc = await prisma.verification.findUnique({
    where: { anon_id },
    include: { verifiedBatch: true }
  });

  if (!doc) {
    return res.status(200).json({ verified: false });
  }

  if (batchId) {
    const isVerified = doc.verifiedBatch?.some((vb) => vb.batchId === batchId) || false;
    return res.status(200).json({ verified: isVerified });
  }

  const verifiedBatchIds = doc.verifiedBatch?.map((vb) => vb.batchId) || [];
  return res.status(200).json({
    verified: doc.verified,
    verifiedBatchIds
  });
}