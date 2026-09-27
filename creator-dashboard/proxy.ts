import { NextResponse, type NextRequest } from "next/server";
import { getRoleFromRequest } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const role = await getRoleFromRequest(req);
  if (role) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals and any request for a static file (has a dot in the last segment).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
