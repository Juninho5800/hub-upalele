"use client";
import { createClient } from "@/lib/supabase/client";
export function SignOutButton() {
  return <button className="btn" onClick={async()=>{const supabase=createClient();await supabase.auth.signOut();window.location.href="/login";}}>Sair</button>;
}
