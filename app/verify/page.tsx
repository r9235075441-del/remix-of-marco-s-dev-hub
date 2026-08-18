// app/verify/page.tsx
import crypto from "crypto";
import { Buffer } from "buffer";
import React from "react";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

function formatTimestamp(unix: number): string {
  const date = new Date(unix * 1000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}-${month}-${year} ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

function decryptToken(token: string, secret: string): any {
  try {
    const [ivBase64, encrypted] = token.split(":");
    if (!ivBase64 || !encrypted) throw new Error("Token format is invalid");
    const iv = Buffer.from(ivBase64, "base64");
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  if (!rawToken) redirect("/study/batches?toast=Missing%20Token");

  const token = decodeURIComponent(rawToken.replace(/ /g, "+"));
  const SECRET = process.env.SHORTNER_TOKEN_SECRET?.replace(/^"|"$/g, "");
  if (!SECRET) redirect("/study/batches?toast=SECRET%20not%20found");

  const payload = decryptToken(token, SECRET);
  if (!payload) redirect("/study/batches?toast=Token%20is%20invalid");
  if (payload.error) redirect("/study/batches?toast=Invalid%20Verification%20Token.%20try%20again");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    redirect("/study/batches?toast=Verification%20had%20already%20Expired.%20Please%20try%20again");
  }

  const verification = await prisma.verification.findUnique({
    where: { anon_id: payload.anon_id },
    include: { verifiedBatch: true }
  });
  if (!verification) {
    redirect("/study/batches?toast=Unknown%20Anon%20ID.%20refresh%20page%20and%20try%20again");
  }

  const alreadyVerified = verification.verifiedBatch?.some((vb) => vb.batchId === payload.batchid);
  if (alreadyVerified) {
    redirect("/study/batches?toast=You%20have%20already%20verified%20this%20batch");
  }

  const nowDate = new Date();
  const expiredAt = null; // Save permanently, never expire

  await prisma.verifiedBatch.create({
    data: {
      verificationId: verification.id,
      batchId: payload.batchid,
      verificationToken: token,
      verifiedAt: nowDate,
      expireAt: expiredAt,
    }
  });

  redirect(`/study/batches/${payload.batchid}?toast=Hurray,%20You%20have%20verified%20successfully%20for%20this%20Batch.`);
  return null;
}
