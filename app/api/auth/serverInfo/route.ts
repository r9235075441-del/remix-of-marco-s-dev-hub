import { NextResponse } from "next/server";
import { getServerInfoInternal } from "@/lib/serverInfo";

export async function GET() {
  try {
    const config = await getServerInfoInternal();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load server info" },
      { status: 500 }
    );
  }
}
