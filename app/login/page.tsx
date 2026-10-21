"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = "/dashboard";
    } catch (err) { setMessage(err instanceof Error ? err.message : "Erro ao conectar."); }
    finally { setBusy(false); }
  }
  return <main className="main"><section className="card form"><div className="brand"><img src="/assets/upalele-logo.png" alt="UPALELE"/><div><b>CLAN HUB</b><small>UPALELE · #PLV2VQ0P</small></div></div><span className="badge gold">ACESSO DO CLÃ</span><h1>Entrar no Clan Hub</h1><p className="muted">Use o usuário criado no Supabase. O cadastro público está desativado nesta primeira versão.</p><form onSubmit={submit}><label className="field-label" htmlFor="email">E-mail</label><input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label className="field-label" htmlFor="password">Senha</label><input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn primary" style={{width:"100%",marginTop:16}} disabled={busy}>{busy?"Entrando...":"Entrar"}</button>{message&&<p className="error">{message}</p>}</form></section></main>;
}
