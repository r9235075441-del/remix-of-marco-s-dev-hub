import prisma from "@/lib/prisma";

/**
 * Default global PW token used for guest sessions.
 * Can be changed any time from Admin Panel → Tokens.
 */
export const DEFAULT_GLOBAL_TOKEN = {
  id: "6a717a7a7daa01670de8120f",
  name: "Guest User",
  accessToken:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODU2Njg0NDQsImV4cCI6MTc4NjI3MzI0NC42NjYsImRhdGEiOnsiX2lkIjoiNjliMDJiMWQwZDI5OTRmMTcxM2JjOTM4IiwidXNlcm5hbWUiOiI5Mjc3MDk3NzQ1IiwiZmlyc3ROYW1lIjoiTXkgbGlmZSBpcyBtYWhhZGV2IGppIiwibGFzdE5hbWUiOiJNeSBsaWZlIGlzIG1haGFkZXYgamkiLCJvcmdhbml6YXRpb24iOnsiX2lkIjoiNWViMzkzZWU5NWZhYjc0NjhhNzlkMTg5Iiwid2Vic2l0ZSI6InBoeXNpY3N3YWxsYWguY29tIiwibmFtZSI6IlBoeXNpY3N3YWgifSwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwib25lUm9sZXMiOltdLCJ0eXBlIjoiVVNFUiJ9LCJqdGkiOiJSRjV0WXVvVVFaQ0FYYkFYejVBS1JnXzY5YjAyYjFkMGQyOTk0ZjE3MTNiYzkzOCJ9.tq86P-Sc8Eo3yDf6DAbfUxx7WNPjug09OIPRbpq4ET8",
  refreshToken:
    "f69f7ae6aa9185fb121e09d6f360349c239d1fdc2b6efde59e31b3853819a01a",
  randomId: null as string | null,
};

export type GlobalTokenState = {
  loginEnabled: boolean;
  guestLoginEnabled: boolean;
  guestSessionEpoch: number;
  globalTokenId: string | null;
  globalTokenName: string | null;
  globalAccessToken: string | null;
  globalRefreshToken: string | null;
  globalRandomId: string | null;
};

/** Reads the global token/login state, falling back to the built-in defaults. */
export async function getGlobalTokenState(): Promise<GlobalTokenState> {
  try {
    const config: any = await prisma.serverConfig.findUnique({ where: { id: 1 } });
    return {
      loginEnabled: Boolean(config?.loginEnabled ?? false),
      guestLoginEnabled: Boolean(config?.guestLoginEnabled ?? true),
      guestSessionEpoch: Number(config?.guestSessionEpoch ?? 1),
      globalTokenId: config?.globalTokenId ?? DEFAULT_GLOBAL_TOKEN.id,
      globalTokenName: config?.globalTokenName ?? DEFAULT_GLOBAL_TOKEN.name,
      globalAccessToken:
        config?.globalAccessToken ?? DEFAULT_GLOBAL_TOKEN.accessToken,
      globalRefreshToken:
        config?.globalRefreshToken ?? DEFAULT_GLOBAL_TOKEN.refreshToken,
      globalRandomId: config?.globalRandomId ?? DEFAULT_GLOBAL_TOKEN.randomId,
    };
  } catch {
    return {
      loginEnabled: false,
      guestLoginEnabled: true,
      guestSessionEpoch: 1,
      globalTokenId: DEFAULT_GLOBAL_TOKEN.id,
      globalTokenName: DEFAULT_GLOBAL_TOKEN.name,
      globalAccessToken: DEFAULT_GLOBAL_TOKEN.accessToken,
      globalRefreshToken: DEFAULT_GLOBAL_TOKEN.refreshToken,
      globalRandomId: DEFAULT_GLOBAL_TOKEN.randomId,
    };
  }
}

/** Checks a PW access token against the upstream API. */
export async function checkPwToken(accessToken: string) {
  try {
    const res = await fetch("https://api.penpencil.co/v3/oauth/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "client-id": "5eb393ee95fab7468a79d189",
        "client-type": "WEB",
        "content-type": "application/json",
        randomid: "72012a4a-a2a2-4ec4-a6c0-cf9bd4c1b0eb",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    const body: any = await res.json().catch(() => ({}));
    return {
      valid: res.ok,
      status: res.status,
      name:
        body?.data?.firstName || body?.data?.username || body?.data?.email || null,
      message: res.ok ? "Token is valid" : body?.message || "Token is invalid or expired",
    };
  } catch (err: any) {
    return {
      valid: false,
      status: 0,
      name: null,
      message: err?.message || "Unable to reach PW servers",
    };
  }
}
