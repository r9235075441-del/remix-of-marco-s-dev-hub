import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phoneNumber = body.phoneNumber || body.username || body.mobile;
    const searchParams = req.nextUrl.searchParams;
    const smsType = searchParams.get("smsType") || body.smsType || "0";

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    const apiRes = await fetch(
      `https://api.penpencil.co/v1/users/resend-otp?smsType=${smsType}`,
      {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          Randomid: uuidv4(),
        },
        body: JSON.stringify({
          mobile: phoneNumber,
          organizationId: "5eb393ee95fab7468a79d189",
        }),
      }
    );

    const data = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok || !data.success) {
      return NextResponse.json(
        { success: false, message: data.message || "Failed to resend OTP" },
        { status: apiRes.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dataFrom: data.dataFrom || "XMX_ER _API",
    });
  } catch (err: any) {
    console.error("Resend OTP error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
