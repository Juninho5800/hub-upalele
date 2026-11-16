"use client";

import { useState } from "react";
import { CwlSelectionPanel } from "@/components/cwl-selection-panel";
import { CwlWarPanel } from "@/components/cwl-war-panel";
import { CwlLineupPanel } from "@/components/cwl-lineup-panel";
import { CwlPerformancePanel } from "@/components/cwl-performance-panel";
import { CwlRotationPanel } from "@/components/cwl-rotation-panel";
import { CwlRotationHistoryPanel } from "@/components/cwl-rotation-history-panel";

const tabs = [
  { id: "overview", number: "01", label: "Visão geral", icon: "◈" },
  { id: "lineup", number: "02", label: "Escalação", icon: "♙" },
  { id: "rotation", number: "03", label: "Rodízio", icon: "⟳" },
  { id: "performance", number: "04", label: "Desempenho", icon: "▥" },
  { id: "selection", number: "05", label: "Seleção mensal", icon: "♛" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const styles = {
  container: {
    display: "grid",
    gap: 22,
    minWidth: 0,
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    padding: "28px",
    borderRadius: 18,
    border: "1px solid rgba(212, 175, 55, 0.25)",
    background:
      "linear-gradient(120deg, #20242d 0%, #29232a 58%, #351f27 100%)",
  },

  eyebrow: {
    color: "#e5bd61",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
  },

  heading: {
    color: "#ffffff",
    fontSize: "clamp(25px, 3vw, 34px)",
    fontWeight: 850,
    letterSpacing: "-0.04em",
    margin: "9px 0 6px",
  },

  description: {
    color: "#b9c0cc",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },

  tabsContainer: {
    display: "flex",
    gap: 8,
    overflowX: "auto" as const,
    padding: 5,
    borderRadius: 13,
    border: "1px solid var(--border, #414957)",
    background: "var(--card, #222630)",
    scrollbarWidth: "thin" as const,
  },

  tab: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    flex: "1 0 auto",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: 9,
    padding: "12px 16px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 750,
    transition: "all 160ms ease",
    whiteSpace: "nowrap" as const,
  },

  content: {
    minWidth: 0,
    padding: 4,
  },

  history: {
    border: "1px solid var(--border, #414957)",
    borderRadius: 14,
    background: "var(--card, #222630)",
    overflow: "hidden",
  },
};

export function CwlDashboard({ role }: { role: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const canManage = role === "leader" || role === "co_leader";

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <div style={styles.eyebrow}>
          UPALELE · CLAN WAR LEAGUE
        </div>

        <h2 style={styles.heading}>
          Gerenciamento da CWL
        </h2>

        <p style={styles.description}>
          Central de controle da liga. Gerencie confrontos,
          escalação, rodízio, desempenho e seleção mensal.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              background: "rgba(212,175,55,0.13)",
              border: "1px solid rgba(212,175,55,0.3)",
              color: "#e8c66e",
              padding: "7px 11px",
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            CENTRAL COMPETITIVA
          </span>

          <span style={{ color: "#aeb6c4", fontSize: 12 }}>
            CLÃ #PLV2VQQP
          </span>
        </div>
      </section>

      <section>
        <div
          style={{
            marginBottom: 10,
            color: "var(--muted, #a4adbd)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
          }}
        >
          NAVEGAÇÃO DA LIGA
        </div>

        <div
          role="tablist"
          aria-label="Áreas de gerenciamento da CWL"
          style={styles.tabsContainer}
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`cwl-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tab,
                  color: selected ? "#ffffff" : "#aeb6c4",
                  background: selected
                    ? "linear-gradient(135deg, #a92e40, #d94357)"
                    : "transparent",
                  borderColor: selected
                    ? "rgba(255,255,255,0.12)"
                    : "transparent",
                  boxShadow: selected
                    ? "0 5px 18px rgba(180,45,65,0.22)"
                    : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color: selected ? "#ffe2a0" : "#aeb6c4",
                  }}
                >
                  {tab.icon}
                </span>

                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        id={`cwl-panel-${activeTab}`}
        role="tabpanel"
        aria-label={tabs.find((tab) => tab.id === activeTab)?.label}
        style={styles.content}
      >
        {activeTab === "overview" && <CwlWarPanel canManage={canManage} />}

        {activeTab === "lineup" && <CwlLineupPanel canManage={canManage} />}

        {activeTab === "rotation" && (
          <div style={{ display: "grid", gap: 18 }}>
            <CwlRotationPanel canManage={canManage} />

            <details style={styles.history}>
              <summary
                style={{
                  cursor: "pointer",
                  padding: "17px 20px",
                  color: "var(--foreground, #ffffff)",
                  fontWeight: 750,
                  fontSize: 14,
                }}
              >
                ◷ Histórico de substituições
              </summary>

              <div
                style={{
                  padding: 18,
                  borderTop: "1px solid var(--border, #414957)",
                }}
              >
                <CwlRotationHistoryPanel />
              </div>
            </details>
          </div>
        )}

        {activeTab === "performance" && <CwlPerformancePanel />}

        {activeTab === "selection" && <CwlSelectionPanel />}
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          padding: "14px 4px",
          borderTop: "1px solid var(--border, #414957)",
          color: "var(--muted, #a4adbd)",
          fontSize: 11,
          letterSpacing: "0.06em",
        }}
      >
        <span>UPALELE · CLAN WAR LEAGUE</span>
        <span>ESTRATÉGIA · UNIÃO · VITÓRIA</span>
      </footer>
    </div>
  );
}
