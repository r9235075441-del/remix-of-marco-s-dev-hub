import prisma from "@/lib/prisma";
import crypto from "crypto";
import KeyGenerateClient from "./KeyGenerateClient";
import { getBatchInfo } from "@/lib/batch";
import axios from "axios";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function encryptToken(payload: object, secret: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "base64");
  encrypted += cipher.final("base64");
  return `${iv.toString("base64")}:${encrypted}`;
}

export default async function KeyGeneratePage({ searchParams }: { searchParams?: Promise<{ [key: string]: string }> }) {
  const params = searchParams ? await searchParams : {};
  const anon_id = params.anon_id || "";
  const batchId = params.batchId || "";

  let iphash = "";
  let useragent = "";
  let token = "";
  let batchName = "Batch";
  let batchImage = "";
  let shortnerServers: any[] = [];

  if (anon_id) {
    const verification = await prisma.verification.findUnique({
      where: { anon_id },
      include: { verifiedBatch: true }
    });
    if (verification) {
      iphash = verification.iphash || "";
      useragent = verification.useragent || "";
      const alreadyVerified = verification.verifiedBatch?.some((vb) => vb.batchId === batchId);
      if (alreadyVerified) redirect(`/study/batches/${batchId}`);
    }
  }

  if (batchId) {
    const batchInfo = await getBatchInfo(batchId, "details");
    batchName = batchInfo?.name || "Batch";
    batchImage = batchInfo?.iosPreviewImageUrl || "";
    if (!batchImage) {
      const batchDoc = await prisma.batch.findUnique({ where: { batchId } });
      if (batchDoc) {
        batchName = batchDoc.batchName || batchName;
        batchImage = batchDoc.batchImage || batchImage;
      }
    }
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 10 * 60;
  const timestamp = new Date().toISOString();
  const redirectTo = `/study/batches/${batchId}`;

  const payload = { anon_id, batchid: batchId, iphash, useragent, iat, exp, timestamp, redirectTo };

  const SECRET = process.env.SHORTNER_TOKEN_SECRET?.replace(/^"|"$/g, "");
  if (anon_id && batchId && iphash && useragent && SECRET) {
    token = encryptToken(payload, SECRET);
  }

  const config = await prisma.serverConfig.findUnique({
    where: { id: 1 },
    include: { shortner_servers: true }
  });

  if (config && Array.isArray(config.shortner_servers)) {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;
    const verifyUrl = `${baseUrl}/verify?token=${encodeURIComponent(token)}`;

    shortnerServers = await Promise.all(
      config.shortner_servers
        .filter((s) => s.enabled)
        .map(async (s) => {
          let apiUrl = s.api_url
            .replace("{api_key}", encodeURIComponent(s.api_key))
            .replace("{api}", encodeURIComponent(s.api_key))
            .replace("{url}", encodeURIComponent(verifyUrl));
          let shortenedUrl = "";
          try {
            const response = await axios.get(apiUrl);
            if (response.data && response.data.shortenedUrl) {
              shortenedUrl = response.data.shortenedUrl;
            }
          } catch (err) {
            shortenedUrl = "";
          }
          return { name: s.name, api_url: s.api_url, api_key: s.api_key, shortenedUrl };
        })
    );
  }

  return (
    <KeyGenerateClient
      anon_id={anon_id}
      batchId={batchId}
      iphash={iphash}
      useragent={useragent}
      token={token}
      batchName={batchName}
      batchImage={batchImage}
      shortnerServers={shortnerServers}
    />
  );
}
