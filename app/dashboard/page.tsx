import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
export default async function Dashboard() {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("in_game_name,role,is_active").eq("id",user.id).maybeSingle();
 if(!profile || !profile.is_active) return <main className="main"><section className="card"><h1>Perfil do clã não encontrado</h1><p className="muted">Sua conta autenticou, mas não há perfil ativo em public.profiles associado a este UID. Peça à liderança para conferir o cadastro.</p><p className="muted">UID atual: {user.id}</p></section></main>;
 const [{count:rulesCount},{count:punishmentsCount},{count:historyCount},{data:hooks}] = await Promise.all([
  supabase.from("memorial_rules").select("*",{count:"exact",head:true}).eq("is_published",true),
  supabase.from("punishments").select("*",{count:"exact",head:true}).eq("status","active"),
  supabase.from("historical_punishment_records").select("*",{count:"exact",head:true}),
  supabase.from("punishments").select("member_name,reason,punishment_label").eq("status","active").order("created_at",{ascending:false}).limit(5)
 ]);
 return <AppShell title="Visão geral" userName={profile.in_game_name} role={profile.role}><div className="grid stats">{[[ "Regras do memorial",rulesCount??0,"regras publicadas"],["Ganchos ativos",punishmentsCount??0,"registros marcados ativos"],["Histórico antigo",historyCount??0,"linhas importadas"],["Seu acesso",profile.role,"perfil autenticado"]].map(([label,value,note])=><section className="card" key={String(label)}><div className="stat-label">{label}</div><div className="stat-number">{value}</div><div className="muted">{note}</div></section>)}</div><div className="grid content-grid"><div><section className="banner"><span className="badge gold">⚔ WAR ROOM</span><h2>Guerra de clãs</h2><p>O banco está preparado para receber os dados de guerra. A API ainda não está conectada.</p><p><Link className="btn primary" href="/ataques">Abrir assistente de ataques →</Link></p></section><section className="card"><div className="section-head"><div><h2>Ganchos ativos</h2><p>Registros importados para conferência</p></div><Link className="btn" href="/ganchos">Ver todos</Link></div><div className="list">{hooks?.length?hooks.map((h,i)=><div className="item" key={i}><div className="avatar">{h.member_name.slice(0,2).toUpperCase()}</div><div className="item-main"><b>{h.member_name}</b><small>{h.reason||h.punishment_label}</small></div></div>):<p className="muted">Ainda não há ganchos carregados. Execute a importação inicial do projeto.</p>}</div></section></div><div className="card"><div className="section-head"><div><h2>Acesso rápido</h2><p>Conteúdo conectado ao banco</p></div></div><div className="list">{[["/memorial","Consultar memorial","Pesquisar regras"],["/historico","Histórico punitivo","Consultar registros antigos"],["/membros","Cadastro operacional","Novatos e observações"]].map(([href,title,sub])=><Link className="item" href={href} key={href}><div className="avatar">→</div><div className="item-main"><b>{title}</b><small>{sub}</small></div></Link>)}</div></div></div></AppShell>;
}
