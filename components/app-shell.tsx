
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const clanGroups = [
  {
    label: "VISÃO GERAL",
    links: [
      { href: "/dashboard", icon: "🏠", label: "Visão geral" },
    ],
  },
  {
    label: "CLÃ",
    links: [
      { href: "/membros", icon: "👥", label: "Membros" },
      { href: "/memorial", icon: "📜", label: "Memorial" },
    ],
  },
  {
    label: "GUERRA",
    links: [
      { href: "/war-room", icon: "⚔️", label: "War Room" },
      { href: "/ataques", icon: "🎯", label: "Assistente de ataques" },
      { href: "/cwl", icon: "🏆", label: "CWL — Liga" },
      { href: "/ganchos", icon: "🚩", label: "Ganchos ativos" },
    ],
  },
];

const leadershipLinks = [
  { href: "/lideranca", icon: "👑", label: "Central da liderança" },
  { href: "/solicitacoes", icon: "📩", label: "Solicitações" },
  { href: "/votacoes", icon: "🗳️", label: "Votações" },
  { href: "/ocorrencias", icon: "🚨", label: "Central de ocorrências" },
  { href: "/historico", icon: "📋", label: "Histórico punitivo" },
];

const communityLinks = [
  { href: "/eventos", icon: "🎉", label: "Eventos" },
];

type NavLink = {
  href: string;
  icon: string;
  label: string;
};

type AppShellProps = {
  title: string;
  userName: string;
  role: string;
  children: React.ReactNode;
};

const mobileLinks: NavLink[] = [
  { href: "/dashboard", icon: "🏠", label: "Início" },
  { href: "/membros", icon: "👥", label: "Membros" },
  { href: "/war-room", icon: "⚔️", label: "Guerra" },
  { href: "/cwl", icon: "🏆", label: "CWL" },
];

export function AppShell({
  title,
  userName,
  role,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const normalizedRole = (role ?? "").trim().toLowerCase();

  const isLeader = [
    "leader",
    "co_leader",
    "coleader",
  ].includes(normalizedRole);

  const roleDisplay: Record<string, { label: string; icon: string }> = {
    leader: { label: "Líder", icon: "👑" },
    co_leader: { label: "Colíder", icon: "🛡️" },
    coleader: { label: "Colíder", icon: "🛡️" },
    elder: { label: "Ancião", icon: "⭐" },
    member: { label: "Membro", icon: "⚔️" },
  };

  const currentRole = roleDisplay[normalizedRole] ?? {
    label: normalizedRole
      ? normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1)
      : "Membro",
    icon: "⚔️",
  };

  const allMoreLinks = [
    ...clanGroups.flatMap((group) => group.links),
    ...communityLinks,
    ...(isLeader ? leadershipLinks : []),
  ].filter(
    (link) => !mobileLinks.some((mobile) => mobile.href === link.href)
  );

  const isMoreActive = allMoreLinks.some(
    (link) =>
      pathname === link.href ||
      pathname.startsWith(`${link.href}/`)
  );

  function isActive(link: NavLink) {
    return (
      pathname === link.href ||
      (link.href !== "/dashboard" &&
        pathname.startsWith(`${link.href}/`))
    );
  }

  function renderLink(link: NavLink) {
    const active = isActive(link);

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

        {clanGroups.map((group) => (
          <section key={group.label}>
            <div className="nav-label">{group.label}</div>
            <nav className="nav" aria-label={group.label}>
              {group.links.map(renderLink)}
            </nav>
          </section>
        ))}

        {isLeader && (
          <section>
            <div className="nav-label">COMANDO — LIDERANÇA</div>
            <nav
              className="nav"
              aria-label="Navegação exclusiva da liderança"
            >
              {leadershipLinks.map(renderLink)}
            </nav>
          </section>
        )}

        <section>
          <div className="nav-label">COMUNIDADE</div>
          <nav className="nav" aria-label="Comunidade">
            {communityLinks.map(renderLink)}
          </nav>
        </section>

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
                {currentRole.icon} {currentRole.label}
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

      {/* Menu expandido para celular */}
      {moreOpen && (
        <>
          <button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />

          <nav
            className="mobile-more-panel"
            aria-label="Mais funcionalidades"
          >
            <div className="mobile-more-heading">
              <strong>MAIS FUNCIONALIDADES</strong>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {allMoreLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`mobile-more-link${isActive(link) ? " active" : ""}`}
                onClick={() => setMoreOpen(false)}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
                <span className="mobile-more-arrow">›</span>
              </Link>
            ))}
          </nav>
        </>
      )}

      {/* Navegação inferior mobile */}
      <nav className="mobile-nav" aria-label="Navegação principal">
        {mobileLinks.map((link) => {
          const active = isActive(link);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`mobile-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <span className="mobile-nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`mobile-nav-item${moreOpen || isMoreActive ? " active" : ""}`}
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          aria-label="Mais funcionalidades"
        >
          <span className="mobile-nav-icon">☰</span>
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
