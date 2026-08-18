import { getServerInfoInternal } from "@/lib/serverInfo";
import HomePageClient from "./components/HomePageClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const serverInfo = await getServerInfoInternal();
  return <HomePageClient serverInfo={serverInfo} />;
}