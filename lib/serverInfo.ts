import prisma from "@/lib/prisma";

export const DEFAULT_SERVER_INFO = {
  webName: process.env.NEXT_PUBLIC_APP_NAME || "VDK Study",
  sidebarLogoUrl: "/logo.png",
  sidebarTitle: "VDK Study",
  tg_channel: "VdkStudy",
  tg_username: "VdkStudy",
  isDirectLoginOpen: true,
  tg_bot: "PWRAUTHBOT",
  shortner_servers: []
};

let cachedConfig: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 10000; // 10 seconds in-memory cache TTL

export async function getServerInfoInternal() {
  const now = Date.now();
  if (cachedConfig && (now - lastFetchTime < CACHE_TTL)) {
    return cachedConfig;
  }

  try {
    const rawConfig = await prisma.serverConfig.findUnique({ 
      where: { id: 1 },
      include: { shortner_servers: true }
    });

    if (!rawConfig) {
      console.warn("[getServerInfoInternal] Server config not found in database. Using fallbacks.");
      cachedConfig = DEFAULT_SERVER_INFO;
      lastFetchTime = now;
      return DEFAULT_SERVER_INFO;
    }

    const result = {
      webName: String(rawConfig.webName || DEFAULT_SERVER_INFO.webName),
      sidebarLogoUrl: String(rawConfig.sidebarLogoUrl || DEFAULT_SERVER_INFO.sidebarLogoUrl),
      sidebarTitle: String(rawConfig.sidebarTitle || DEFAULT_SERVER_INFO.sidebarTitle),
      tg_channel: String(rawConfig.tg_channel || DEFAULT_SERVER_INFO.tg_channel),
      tg_username: String(rawConfig.tg_username || DEFAULT_SERVER_INFO.tg_username),
      isDirectLoginOpen: Boolean(rawConfig.isDirectLoginOpen ?? DEFAULT_SERVER_INFO.isDirectLoginOpen),
      tg_bot: String(rawConfig.tg_bot || DEFAULT_SERVER_INFO.tg_bot),
      shortner_servers: Array.isArray(rawConfig.shortner_servers) 
        ? rawConfig.shortner_servers.map((s: any) => ({
            name: String(s.name),
            enabled: Boolean(s.enabled),
            api_url: String(s.api_url),
            api_key: String(s.api_key)
          }))
        : DEFAULT_SERVER_INFO.shortner_servers
    };

    cachedConfig = result;
    lastFetchTime = now;
    return result;
  } catch (error) {
    console.error("[getServerInfoInternal] Error fetching from DB, using fallbacks:", error);
    return DEFAULT_SERVER_INFO;
  }
}
