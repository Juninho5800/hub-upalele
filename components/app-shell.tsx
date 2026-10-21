
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const clanLinks = [
  { href: "/dashboard", icon: "⌂", label: "Visão geral" },
  { href: "/memorial", icon: "▤", label: "Memorial" },
  { href: "/ataques", icon: "◎", label: "Assistente de ataques" },
  { href: "/war-room", icon: "⚔", label: "War Room" },
  { href: "/membros", icon: "♙", label: "Membros" },
  { href: "/ganchos", icon: "⚑", label: "Ganchos ativos" },
  { href: "/historico", icon: "◷", label: "Histórico punitivo" },
  { href: "/eventos", icon: "▦", label: "Eventos" },
];

const leadershipLinks = [
  { href: "/votacoes", icon: "⚖", label: "Votações" },
  { href: "/lideranca", icon: "♛", label: "Central da liderança" },
];

type AppShellProps = {
  title: string;
  userName: string;
  role: string;
  children: React.ReactNode;
};

export function AppShell({
  title,
  userName,
  role,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const isLeader = role === "leader" || role === "co_leader";

  function renderLink(link: (typeof clanLinks)[number]) {
    const active =
      pathname === link.href ||
      (link.href !== "/dashboard" &&
        pathname.startsWith(`${link.href}/`));

    return (
      <Link
        className={`navlink${active ? " active" : ""}`}
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
      >
        <span className="nav-icon" aria-hidden="true">
          {link.icon}
        </span>
        <span>{link.label}</span>
        {active && <span className="nav-indicator" />}
      </Link>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
      <img
  src="/assets/upalele-banner.png"
  alt="UPALELE — Clash of Clans"
/>

          <div className="brand-copy">
            <b>UPALELE</b>
            <small>CLAN COMMAND CENTER</small>
<small>#PLV2VQQP</small>
          </div>
        </Link>

        <div className="clan-status">
          <span className="status-dot" />
          <span>PAINEL DO CLÃ</span>
        </div>

        <div className="nav-label">OPERAÇÕES</div>

        <nav className="nav" aria-label="Navegação principal">
          {clanLinks.map(renderLink)}
        </nav>

        {isLeader && (
          <>
            <div className="nav-label">COMANDO</div>
            <nav className="nav" aria-label="Navegação da liderança">
              {leadershipLinks.map(renderLink)}
            </nav>
          </>
        )}

        <div className="side-note">
          <div className="side-note-title">
            <span className="status-dot" />
            UPALELE
          </div>
          <p>Estratégia, disciplina e vitória.</p>
          <span className="side-note-caption">
            CENTRAL DE OPERAÇÕES
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div className="page-heading">
            <div className="eyebrow">
              UPALELE <span className="heading-divider">/</span>{" "}
              CENTRAL DO CLÃ
            </div>

            <h1>{title}</h1>

            <div className="user-meta">
              <span className="user-avatar">
                {userName.trim().charAt(0).toUpperCase() || "U"}
              </span>
              <span>{userName}</span>
              <span className="meta-separator">·</span>
              <span className="role-label">
                {role === "leader"
                  ? "Liderança"
                  : role === "co_leader"
                    ? "Coliderança"
                    : "Membro"}
              </span>
            </div>
          </div>

          <div className="header-actions">
            <span className="session-status">
              <span className="status-dot" />
              CONECTADO
            </span>
            <SignOutButton />
          </div>
        </header>

        <div className="page-content">{children}</div>

        <footer className="footer">
          <span>
            <strong>UPALELE</strong> · Clan Hub
          </span>
          <span>ESTRATÉGIA • UNIÃO • VITÓRIA</span>
        </footer>
      </main>
    </div>
  );
}
