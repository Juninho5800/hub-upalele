import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", requestUrl.origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[AUTH CALLBACK]", error);
    return NextResponse.redirect(
      new URL("/login?error=confirmation_failed", requestUrl.origin)
    );
  }

  return NextResponse.redirect(
    new URL("/vincular-tag", requestUrl.origin)
  );
}
