"use client";
import { useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";
type Rule={id:string;section:string;rule_number:string|null;title:string;body:string};
export default function MemorialPage(){
 const [rules,setRules]=useState<Rule[]>([]);const [query,setQuery]=useState("");const [cat,setCat]=useState("Todas");const [loading,setLoading]=useState(true);const [err,setErr]=useState("");
 useEffect(()=>{(async()=>{const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){location.href="/login";return}const {data,error}=await s.from("memorial_rules").select("id,section,rule_number,title,body").eq("is_published",true).order("sort_order");if(error)setErr(error.message);else setRules(data||[]);setLoading(false)})()},[]);
 const cats=["Todas",...Array.from(new Set(rules.map(r=>r.section)))];const filtered=useMemo(()=>rules.filter(r=>(cat==="Todas"||r.section===cat)&&`${r.rule_number} ${r.section} ${r.title} ${r.body}`.toLowerCase().includes(query.toLowerCase())),[rules,cat,query]);
 return <AppShell title="Memorial" userName="UPALELE" role="membros"><section className="card"><div className="section-head"><div><h2>Memorial para todos</h2><p>Pesquisa nas regras publicadas no banco.</p></div><span className="badge">{rules.length} regras</span></div><input className="search" placeholder="Buscar regra, assunto ou palavra..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="chips">{cats.map(c=><button key={c} className={`chip ${cat===c?"active":""}`} onClick={()=>setCat(c)}>{c}</button>)}</div>{loading?<p className="muted">Carregando regras...</p>:err?<p className="error">{err}</p>:filtered.length?filtered.map(r=><article className="rule" key={r.id}><div className="rule-meta">{r.section} · item {r.rule_number||"sem número"}</div><h3>{r.title}</h3><p>{r.body}</p></article>):<div className="muted">Nenhuma regra encontrada. Se o memorial estiver vazio, execute `0002_seed_clan_data.sql` no SQL Editor.</div>}</section></AppShell>
}
