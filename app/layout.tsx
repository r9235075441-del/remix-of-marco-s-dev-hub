// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import NetworkStatus from '@/components/NetworkStatus';

import RootInitializer from "@/app/components/RootInitializer";
import TriggerCleanup from "@/app/TriggerCleanup";

const inter = Inter({ subsets: ["latin"] });

import { getServerInfoInternal } from "@/lib/serverInfo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Server-side function to fetch server info
async function getServerInfo() {
  return await getServerInfoInternal();
}

export async function generateMetadata(): Promise<Metadata> {
  const serverInfo = await getServerInfo();

  return {
    title:
      serverInfo?.webName || process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO",
    description: "PW-MARCO ~ MANZIL MILEGI YHI SE",
    authors: [
      { name: "PW-MARCO", url: "https://t.me/official_marco_22" },
      { name: "PW-MARCO Team", url: "https://t.me/official_marco_22" },
    ],
    creator: "PW-MARCO",

    icons: {
      icon: serverInfo?.sidebarLogoUrl || "/favicon.ico", // fallback to public/favicon.ico
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch server info on the server side (will be cached from metadata generation)
  const serverInfo = await getServerInfo();

  return (
    <html lang="en">
      <body className={inter.className}>
        <RootInitializer serverInfo={serverInfo}>{children}</RootInitializer>
                <NetworkStatus />

        <Toaster position="top-right" richColors closeButton />
        <TriggerCleanup />
      </body>
    </html>
  );
}
