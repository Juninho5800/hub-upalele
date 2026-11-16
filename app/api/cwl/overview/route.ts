import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type WarPayload = {
  opponent?: {
    name?: string | null;
    tag?: string | null;
  };
};

type WarRecord = {
  id: string;
  status: string | null;
  clan_stars: number | null;
  opponent_stars: number | null;
  team_size: number | null;
  war_start: string | null;
  war_end: string | null;
  raw_payload: unknown;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao consultar perfil CWL:", profileError);
      return NextResponse.json(
        { error: "Não foi possível validar suas permissões." },
        { status: 500 }
      );
    }

    // Todos os cargos ativos podem consultar o painel do CWL.
    // Ações administrativas continuam protegidas nas rotas próprias.
    if (profile?.is_active !== true || !profile.role) {
      return NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 }
      );
    }

    const { data: seasons, error: seasonError } = await supabase
      .from("cwl_seasons")
      .select(
        "id,season,league_name,group_number,selection_month,status"
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (seasonError) throw seasonError;

    const season = seasons?.[0];

    if (!season) {
      return NextResponse.json({
        success: true,
        season: null,
        rounds: [],
      });
    }

    const { data: rounds, error: roundsError } = await supabase
      .from("cwl_rounds")
      .select("id,round_number,war_id,status,processed_at")
      .eq("season_id", season.id)
      .order("round_number", { ascending: true });

    if (roundsError) throw roundsError;

    const warIds = (rounds ?? [])
      .map((round) => round.war_id)
      .filter((id): id is string => Boolean(id));

    let wars: WarRecord[] = [];

    if (warIds.length > 0) {
      const { data, error } = await supabase
        .from("wars")
        .select(
          "id,status,clan_stars,opponent_stars,team_size,war_start,war_end,raw_payload"
        )
        .in("id", warIds);

      if (error) throw error;

      wars = (data ?? []) as WarRecord[];
    }

    const warById = new Map(
      wars.map((war) => [war.id, war])
    );

    const result = (rounds ?? []).map((round) => {
      const war = round.war_id
        ? warById.get(round.war_id)
        : null;

      const payload = war?.raw_payload as WarPayload | null;
      const opponent = payload?.opponent;

      return {
        id: round.id,
        roundNumber: round.round_number,
        status: round.status,
        warId: round.war_id,
        warStatus: war?.status ?? null,
        opponentName: opponent?.name ?? null,
        opponentTag: opponent?.tag ?? null,
        clanStars: war?.clan_stars ?? null,
        opponentStars: war?.opponent_stars ?? null,
        teamSize: war?.team_size ?? null,
        warStart: war?.war_start ?? null,
        warEnd: war?.war_end ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      season,
      rounds: result,
    });
  } catch (error) {
    console.error("Erro ao consultar painel CWL:", error);

    return NextResponse.json(
      { error: "Não foi possível carregar o painel da CWL." },
      { status: 500 }
    );
  }
}
