import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Login from "./login"; // Your client login component
import { redirect } from "next/navigation";
import { getServerInfoInternal } from "@/lib/serverInfo";
import { JWT_SECRET_BYTES } from "@/lib/jwtSecret";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (token) {
    try {
      const SECRET = JWT_SECRET_BYTES;
      await jwtVerify(token, SECRET);

      // If token valid, redirect to /study
      redirect("/study");
    } catch {
      // Invalid token, show login page
    }
  }

  const serverInfo = await getServerInfoInternal();
  return <Login serverInfo={serverInfo} />;
}
