import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getHeaders } from "@/utils/auth";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN || "8124407694:AAFHNHL5NOWvkwqeYNp5MmwLVshumBjU07o";
const TELEGRAM_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "-1002959186885";

async function sendTelegramLog(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err: any) {
    console.error("Failed to send Telegram log:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phoneNumber = body.phoneNumber || body.username;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    function normalizePhoneNumber(phone: string): string {
      phone = phone.trim().replace(/[^\d+]/g, ""); 
      if (!phone.startsWith("+")) {
        return "+91" + phone;
      }
      return phone;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    let config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
    
    // Automatically seed the database configuration if it doesn't exist
    if (!config) {
      config = await prisma.serverConfig.create({
        data: {
          id: 1,
          webName: "PW-MARCO",
          registrationOpen: true,
          sidebarLogoUrl: "https://example.com/logo.png",
          sidebarTitle: "PW-MARCO",
          isDirectLoginOpen: true,
          password: "admin",
          tg_bot: "",
          tg_channel: "",
          tg_username: "",
          username: "admin"
        }
      });
    }

    if (!config.isDirectLoginOpen) {
      const user = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
      if (!user) {
        return NextResponse.json(
          { success: false, message: "User not found!" },
          { status: 401 }
        );
      }
    }

    const response = await fetch(
      "https://api.penpencil.co/v1/users/get-otp?smsType=0&fallback=true",
      {
        method: "POST",
        headers: {
          ...getHeaders(""),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: phoneNumber,
          countryCode: "+91",
          organizationId: "5eb393ee95fab7468a79d189",
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status !== 201) {
      if (
        data?.error?.message === "User does not exist" &&
        data?.errorFrom === "User Microservice"
      ) {
        return NextResponse.json(
          { success: false, message: "This number is not registered on the real PW app." },
          { status: 404 }
        );
      }

      await sendTelegramLog(
        `PenPencil OTP API failed:\nStatus: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`
      );

      return NextResponse.json(
        { success: false, message: data?.error?.message || "Failed to send OTP" },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, message: `Login error: ${err.message || "Internal Server Error"}` },
      { status: 500 }
    );
  }
}
