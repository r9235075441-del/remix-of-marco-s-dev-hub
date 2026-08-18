import prisma from "@/lib/prisma";
import { DEFAULT_SERVER_INFO } from "@/lib/serverInfo";

export async function getAllServerConfigs() {
  try {
    const configs = await prisma.serverConfig.findMany({
      include: { shortner_servers: true }
    });
    return configs.length ? configs : [DEFAULT_SERVER_INFO];
  } catch (error) {
    console.error("[getAllServerConfigs] Error fetching from DB, using fallback:", error);
    return [DEFAULT_SERVER_INFO];
  }
}
