// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const REFRESH_API_PATH = "/api/TokenManager/refreshTokens";
const REFRESH_API_KEY = process.env.REFRESH_API_KEY;
const PUBLIC_API_PATHS = ["/api/auth"];
const ADMIN_API_PATHS = ["/api/admin"];
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const baseUrl = process.env.BASE_URL;
const isPublicApi = (pathname: string) =>
  PUBLIC_API_PATHS.some((publicPath) => pathname.startsWith(publicPath));

const isAdminApi = (pathname: string) =>
  ADMIN_API_PATHS.some((adminPath) => pathname.startsWith(adminPath));

// Add a web-compatible UUID v4 generator
function generateUUIDv4() {
  // https://stackoverflow.com/a/2117523/2715716
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get or set anon_id cookie
async function getOrSetAnonId(req: NextRequest, res?: NextResponse) {
  let anon_id = req.cookies.get("anon_id")?.value;
  if (!anon_id) {
    anon_id = generateUUIDv4();
    if (res) {
      res.cookies.set("anon_id", anon_id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (baseUrl) {
      fetch(`${baseUrl}/api/track-anon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anon_id,
          useragent: req.headers.get("user-agent"),
          ip: "",
        }),
        keepalive: true,
      }).catch((error) => {
        console.warn("Anonymous tracking failed:", error);
      });
    }
  }
  return anon_id;
}

export async function middleware(req: NextRequest) {

  const { pathname } = req.nextUrl;
  const adminToken = req.cookies.get("admin_token")?.value;

  const adminDashboard = req.nextUrl.clone();
  adminDashboard.pathname = "/admin/dashboard";

  if (pathname === "/admin/login" && adminToken) {
    try {
      const { payload } = await jwtVerify(adminToken, SECRET);
      if (payload?.admin) return NextResponse.redirect(adminDashboard);
    } catch { }
  }

  // ✅ Admin route protection
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";

    if (!adminToken) return NextResponse.redirect(url);

    try {
      const { payload } = await jwtVerify(adminToken, SECRET);
      if (!payload.admin) throw new Error("Not an admin");
    } catch {
      return NextResponse.redirect(url);
    }
  }

  const token = req.cookies.get("accessToken")?.value;

  if (pathname === REFRESH_API_PATH) {
    // check API key
    const apiKeyFromQuery = req.nextUrl.searchParams.get("key");
    const apiKeyFromHeader = req.headers.get("x-api-key");

    if (
      apiKeyFromQuery !== REFRESH_API_KEY &&
      apiKeyFromHeader !== REFRESH_API_KEY
    ) {
      return new Response("Unauthorized BABU", { status: 401 });
    }
    return NextResponse.next();
  }

  // Guest mode: when login is disabled, /auth simply hands out a guest session
  if (pathname === "/auth" && !token && req.nextUrl.searchParams.get("login") !== "1") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/guest";
    url.search = "";
    url.searchParams.set("next", "/study");
    url.searchParams.set("from", "auth");
    return NextResponse.redirect(url);
  }

  // NEW: If user is logged in and tries to access /auth, redirect to /study
  if (pathname === "/auth" && token) {
    try {
      await jwtVerify(token, SECRET);
      const url = req.nextUrl.clone();
      url.pathname = "/study";
      return NextResponse.redirect(url);
    } catch {
      // token invalid, allow to /auth but clear cookies inline to prevent infinite loop
      const res = NextResponse.next();
      res.cookies.set("accessToken", "", { path: "/", expires: new Date(0) });
      res.cookies.set("refreshToken", "", { path: "/", expires: new Date(0) });
      return res;
    }
  }

  // Batch verification for /study/batches/[batchid] and subpages
  // const batchMatch = pathname.match(/^\/study\/batches\/([^\/]+)(?:\/|$)/);
  // if (batchMatch) {
  //   let res = NextResponse.next();
  //   const batchId = batchMatch[1];
  //   const anon_id = await getOrSetAnonId(req, res);
  //   // Call check-verification API
  //   try {
  //     // Fetch user info from /api/AboutMe
  //     const aboutRes = await fetch(`${baseUrl}/api/AboutMe`, {
  //       method: "GET",
  //       headers: {
  //         cookie: req.headers.get("cookie") || "",
  //       },
  //     });

  //     if (!aboutRes.ok) {
  //       throw new Error("Failed to fetch /api/AboutMe");
  //     }

  //     const aboutJson = await aboutRes.json();
  //     const tag = aboutJson?.user?.tag;

  //     // Only check verification if tag is "user" or missing`${baseUrl}/api/auth/check-verification`
  //     if (!tag || tag === "user") {
  //       const apiRes = await fetch(`${baseUrl}/api/auth/check-verification`,
  //         {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ anon_id, batchId }),
  //         }
  //       );

  //       if (!apiRes.ok) {
  //         throw new Error("Failed to check verification");
  //       }

  //       const verification = await apiRes.json();

  //       if (!verification || verification.verified !== true) {
  //         const url = req.nextUrl.clone();
  //         url.pathname = "/key-generate";
  //         url.searchParams.set("anon_id", anon_id);
  //         url.searchParams.set("batchId", batchId);
  //         return NextResponse.redirect(url);
  //       }
  //     } else {
  //       console.log("User Tag:" + tag + ": skipping verifications");
  //     }
  //   } catch (err) {
  //     console.error("Middleware error:", err);
  //     const url = req.nextUrl.clone();
  //     url.pathname = "/key-generate";
  //     url.searchParams.set("anon_id", anon_id);
  //     url.searchParams.set("batchId", batchId);
  //     return NextResponse.redirect(url);
  //   }
  //   return res;
  // }

  const isApi = pathname.startsWith("/api/");
  const isProtectedApi = isApi && !(isPublicApi(pathname) || isAdminApi(pathname));
  const isStudyPage = pathname.startsWith("/study");
  const isWatchPage = pathname.startsWith("/watch");

  if (isProtectedApi || isStudyPage || isWatchPage) {
    if (!token) {
      return isApi ? redirectWithCookieClear(req) : toGuestGateway(req);
    }

    try {
      await jwtVerify(token, SECRET);

      // ✅ Inserted Telegram Check (only for /study/**)
      if (isStudyPage) {
        // try {
        //   const url = `${baseUrl}/api/CheckTgStatus`;




        //   const tgRes = await fetch(url, {
        //     method: "GET",
        //     headers: {
        //       cookie: req.headers.get("cookie") || "",
        //     },
        //   });

        //   const tgJson = await tgRes.json();

        //   if (!tgJson.success) {
        //     // const url = req.nextUrl.clone();
        //     // url.pathname = "/check";
        //     // return NextResponse.redirect(url);
        //   }
        // } catch (tgErr) {
        //   console.error("Telegram check failed:", tgErr);
        //   const url = req.nextUrl.clone();
        //   url.pathname = "/check";
        //   return NextResponse.redirect(url);
        // }
      }

      return NextResponse.next();
    } catch (err: any) {
      console.warn("JWT invalid or expired:", err);
      return isApi ? redirectWithCookieClear(req) : toGuestGateway(req);
    }
  }

  return NextResponse.next();
}

// Sends the visitor through the guest gateway, which either issues a guest
// session (login disabled) or forwards to /auth (login enabled).
function toGuestGateway(req: NextRequest) {
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/api/auth/guest";
  url.search = "";
  url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  res.cookies.set("accessToken", "", { path: "/", expires: new Date(0) });
  res.cookies.set("refreshToken", "", { path: "/", expires: new Date(0) });
  return res;
}

function redirectWithCookieClear(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/auth", req.url));

  res.cookies.set("accessToken", "", { path: "/", expires: new Date(0) });
  res.cookies.set("refreshToken", "", { path: "/", expires: new Date(0) });

  return res;
}

export const config = {
  matcher: [
    // Include all routes EXCEPT:
    // - _next (Next.js internal assets)
    // - static files (e.g., favicon, images)
    // - any file with an extension (e.g., .js, .css)
    "/((?!_next|favicon.ico|.*\\..*).*)",
  ],
};
