
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTag } from "@/lib/clash/strategy";

export const dynamic = "force-dynamic";

// ======================================================
// AUTENTICAÇÃO E PERMISSÕES
// ======================================================

async function getAuthorizedClient(leadershipOnly = false) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Erro ao consultar perfil CWL:", profileError);

    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Não foi possível validar suas permissões." },
        { status: 500 }
      ),
    };
  }

  if (profile?.is_active !== true || !profile.role) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Sem permissão." },
        { status: 403 }
      ),
    };
  }

  if (
    leadershipOnly &&
    !["leader", "co_leader"].includes(profile.role)
  ) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Sem permissão para administrar a escalação." },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, response: null };
}

// ======================================================
// GET - CONSULTAR ESCALAÇÃO
// Permitido para todos os perfis ativos
// ======================================================

export async function GET(request: Request) {
  try {
    const auth = await getAuthorizedClient();

    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get("roundId")?.trim();

    if (!roundId) {
      return NextResponse.json(
        { error: "Informe o roundId." },
        { status: 400 }
      );
    }

    const { data: round, error: roundError } = await auth.supabase
      .from("cwl_rounds")
      .select("id,season_id,round_number,status,war_id")
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) throw roundError;

    if (!round) {
      return NextResponse.json(
        { error: "Rodada não encontrada." },
        { status: 404 }
      );
    }

    const [
      { data: participants, error: participantsError },
      { data: lineups, error: lineupsError },
    ] = await Promise.all([
      auth.supabase
        .from("cwl_participants")
        .select(
          "id,player_tag,player_name,town_hall_level,selection_position,initial_role,attacks_count,total_stars,average_stars,average_destruction,selection_score"
        )
        .eq("season_id", round.season_id)
        .order("selection_position", { ascending: true }),

      auth.supabase
        .from("cwl_lineups")
        .select(
          "id,participant_id,role,slot_position,status,created_at,updated_at"
        )
        .eq("round_id", roundId)
        .order("role", { ascending: true })
        .order("slot_position", { ascending: true }),
    ]);

    if (participantsError) throw participantsError;
    if (lineupsError) throw lineupsError;

    return NextResponse.json({
      success: true,
      round,
      participants: participants ?? [],
      lineups: lineups ?? [],
    });
  } catch (error) {
    console.error("Erro ao consultar escalação CWL:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a escalação.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// POST - SALVAR ESCALAÇÃO E AUDITORIA
// Exclusivo para líder e colíder
// ======================================================

export async function POST(request: Request) {
  try {
    const auth = await getAuthorizedClient(true);

    if (auth.response) return auth.response;

    const { supabase } = auth;

    let body: {
      roundId?: string;
      starters?: string[];
      reserves?: string[];
      reason?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const roundId =
      typeof body.roundId === "string"
        ? body.roundId.trim()
        : "";

    const starters = body.starters;
    const reserves = body.reserves;

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (
      !roundId ||
      !Array.isArray(starters) ||
      !Array.isArray(reserves) ||
      starters.length !== 15 ||
      reserves.length !== 5
    ) {
      return NextResponse.json(
        {
          error:
            "A escalação precisa conter exatamente 15 titulares e 5 reservas.",
        },
        { status: 400 }
      );
    }

    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json(
        {
          error:
            "Informe uma justificativa entre 5 e 500 caracteres.",
        },
        { status: 400 }
      );
    }

    const allTags = [...starters, ...reserves];

    if (
      allTags.some(
        (tag) => typeof tag !== "string" || !tag.trim()
      )
    ) {
      return NextResponse.json(
        { error: "Há tags de jogadores inválidas." },
        { status: 400 }
      );
    }

    const normalizedTags = allTags.map((tag) =>
      normalizeTag(tag)
    );

    if (
      normalizedTags.some((tag) => !tag) ||
      new Set(normalizedTags).size !== 20
    ) {
      return NextResponse.json(
        {
          error:
            "Um jogador não pode ocupar mais de uma posição na escalação.",
        },
        { status: 400 }
      );
    }

    // Confirma a rodada.
    const { data: round, error: roundError } = await supabase
      .from("cwl_rounds")
      .select("id,season_id,round_number")
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) throw roundError;

    if (!round) {
      return NextResponse.json(
        { error: "Rodada não encontrada." },
        { status: 404 }
      );
    }

    // Busca participantes da temporada.
    const { data: participants, error: participantsError } =
      await supabase
        .from("cwl_participants")
        .select("id,player_tag,player_name")
        .eq("season_id", round.season_id);

    if (participantsError) throw participantsError;

    const participantByTag = new Map(
      (participants ?? []).map((participant) => [
        normalizeTag(participant.player_tag),
        participant,
      ])
    );

    const missingTags = normalizedTags.filter(
      (tag) => !participantByTag.has(tag)
    );

    if (missingTags.length > 0) {
      return NextResponse.json(
        {
          error:
            "Existem jogadores que não estão cadastrados nesta temporada.",
          missingTags,
        },
        { status: 400 }
      );
    }

    const starterIds = starters.map(
      (tag) => participantByTag.get(normalizeTag(tag))!.id
    );

    const reserveIds = reserves.map(
      (tag) => participantByTag.get(normalizeTag(tag))!.id
    );

    // Salva escalação e auditoria em uma única transação.
    const { data, error } = await supabase.rpc(
      "cwl_save_lineup",
      {
        p_round_id: roundId,
        p_starters: starterIds,
        p_reserves: reserveIds,
        p_reason: reason,
      }
    );

    if (error) {
      console.error("Erro ao salvar escalação CWL:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    const result = data as {
      success?: boolean;
      message?: string;
      round_id?: string;
      starters?: number;
      reserves?: number;
    } | null;

    if (!result || result.success !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            result?.message ??
            "O banco não confirmou a gravação da escalação.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message:
        result.message ??
        `Escalação da rodada ${round.round_number} salva e auditada com sucesso.`,
    });
  } catch (error) {
    console.error("Erro ao salvar escalação CWL:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a escalação.",
      },
      { status: 500 }
    );
  }
}
