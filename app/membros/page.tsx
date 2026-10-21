
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { RosterNotesManager } from "@/components/roster-notes-manager";

export const dynamic = "force-dynamic";

type ClanMember = {
  tag: string;
  name: string;
  role?: string;
  expLevel?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  clanRank?: number;
};

type ClanMembersResponse = {
  memberList?: ClanMember[];
  message?: string;
};

const roleLabels: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Ancião",
  member: "Membro",
};

const noteLabels: Record<string, string> = {
  newcomer: "Novato para próxima guerra",
  multiple_accounts: "Múltiplas contas",
  temporary_inactivity: "Inatividade temporária",
  general: "Observação geral",
};

export default async function MembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("in_game_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) redirect("/login");

  const token = process.env.CLASH_OF_CLANS_API_TOKEN;
  const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

  let members: ClanMember[] = [];
  let apiError = "";

  if (!token || !clanTag) {
    apiError =
      "A integração com o Clash of Clans não está configurada no servidor.";
  } else {
    try {
      const response = await fetch(
  `https://https://cocproxy.royaleapi.dev/v1/clans/${encodeURIComponent(
    clanTag.trim()
  )}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  }
);
      if (!response.ok) {
        console.error(
          "Erro ao consultar membros do Clash of Clans:",
          response.status
        );

        apiError =
          response.status === 403
            ? "A API recusou a consulta. Confira as permissões e a validade do token."
            : "Não foi possível carregar os membros do clã. Tente novamente mais tarde.";
      } else {
        const result =
          (await response.json()) as ClanMembersResponse;

        members = result.memberList ?? [];
        members.sort(
          (a, b) =>
            (a.clanRank ?? Number.MAX_SAFE_INTEGER) -
            (b.clanRank ?? Number.MAX_SAFE_INTEGER)
        );
      }
    } catch {
      apiError =
        "Falha de conexão ao consultar os membros do Clash of Clans.";
    }
  }

  const { data: notes, error: notesError } = await supabase
  .from("roster_notes")
  .select("id, member_name, note_type, details, is_active")
  .eq("is_active", true)
  .order("note_type");
const canManageNotes = [
  "leader",
  "co_leader",
  "coLeader",
].includes(profile.role ?? "");

const playerNames = Array.from(
  new Set([
    ...members.map((member) => member.name),
    ...(notes ?? []).map((note) => note.member_name),
  ])
).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <AppShell
      title="Membros"
      userName={profile.in_game_name || "Jogador"}
      role={profile.role}
    >
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Elenco oficial do UPALELE</h2>
            <p>
              Participantes atuais do clã, carregados pela API
              do Clash of Clans.
            </p>
          </div>
          <span className="badge">
            {members.length} jogadores
          </span>
        </div>

        {apiError ? (
          <p className="error">{apiError}</p>
        ) : members.length === 0 ? (
          <p className="muted">
            A API não retornou membros para este clã.
          </p>
        ) : (
          <>
            <div className="member-summary">
              <div>
                <span className="stat-label">Membros encontrados</span>
                <strong>{members.length}</strong>
              </div>
              <div>
                <span className="stat-label">Liderança</span>
                <strong>
                  {members.filter(
                    (m) =>
                      m.role === "leader" ||
                      m.role === "coLeader"
                  ).length}
                </strong>
              </div>
              <div>
                <span className="stat-label">Troféus totais</span>
                <strong>
                  {members
                    .reduce((sum, m) => sum + (m.trophies ?? 0), 0)
                    .toLocaleString("pt-BR")}
                </strong>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Jogador</th>
                    <th>Tag</th>
                    <th>Cargo</th>
                    <th>Nível</th>
                    <th>Troféus</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => (
                    <tr key={member.tag}>
                      <td>{member.clanRank ?? index + 1}</td>
                      <td>
                        <strong>{member.name}</strong>
                      </td>
                      <td>
                        <code>{member.tag}</code>
                      </td>
                      <td>
                        <span className="badge">
                          {roleLabels[member.role ?? "member"] ??
                            "Membro"}
                        </span>
                      </td>
                      <td>{member.expLevel ?? "—"}</td>
                      <td>
                        {(member.trophies ?? 0).toLocaleString(
                          "pt-BR"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

            {notesError ? (
        <section className="card" style={{ marginTop: 16 }}>
          <p className="error">
            Não foi possível carregar as observações:{" "}
            {notesError.message}
          </p>
        </section>
      ) : (
        <RosterNotesManager
          notes={notes ?? []}
          playerNames={playerNames}
          canManage={canManageNotes}
        />
      )}
    </AppShell>

  );
}
