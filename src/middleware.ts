import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = request.nextUrl.pathname.startsWith("/login")
  // /model ist die öffentliche RecruitOS-Landing-Page (TFP-Bewerbungsformular) —
  // bewusst ohne Login erreichbar; das Formular schreibt über /api/apply.
  const isPublic =
    isLogin ||
    request.nextUrl.pathname === "/model" ||
    // Persönliche Einladungs-Links: Gäste haben keinen Login
    request.nextUrl.pathname.startsWith("/einladung") ||
    // Öffentliche Event-Seite (Insta-Bio-Link) und Türsteher-Ansicht (Token in der URL)
    request.nextUrl.pathname.startsWith("/e/") ||
    request.nextUrl.pathname.startsWith("/tuer/")
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|ico)$).*)"],
}
