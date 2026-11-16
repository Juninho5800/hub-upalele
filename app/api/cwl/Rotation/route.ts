import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AuthorizedClient = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  response: NextResponse | null;
};

async function getAuthorizedClient(
  leadershipOnly = false
): Promise<AuthorizedClient> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
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
      response: NextResponse.json(
        { error: "Não foi possível validar suas permissões." },
        { status: 500 }
      ),
    };
  }

  if (profile?.is_active !== true || !profile.role) {
    return {
      supabase,
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
      response: NextResponse.json(
        { error: "Sem permissão para administrar a rotação CWL." },
        { status: 403 }
      ),
    };
  }

  return { supabase, response: null };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthorizedClient();

    if (auth.response) return auth.response;

    const { supabase } = auth;
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get("roundId")?.trim();

    if (!roundId) {
      return NextResponse.json(
        { error: "Informe o roundId." },
        { status: 400 }
      );
    }

    const { data: round, error: roundError } = await supabase
      .from("cwl_rounds")
      .select("id,season_id,round_number,status")
      .eq("id", roundId)
      .maybeSingle();

    if (roundError) {
      console.error("Erro ao consultar rodada CWL:", roundError);
      return NextResponse.json(
        { error: "Não foi possível consultar a rodada." },
        { status: 500 }
      );
    }

    if (!round) {
      return NextResponse.json(
        { error: "Rodada não encontrada." },
        { status: 404 }
      );
    }

    const { data: substitutions, error: substitutionsError } =
      await supabase
        .from("cwl_substitutions")
        .select(
          "id,round_id,outgoing_participant_id,incoming_participant_id,action_type,original_substitution_id,outgoing_score,incoming_queue_position,reason,execution_type,performed_by,created_at"
        )
        .eq("round_id", roundId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (substitutionsError) {
      console.error("Erro ao consultar histórico CWL:", substitutionsError);
      return NextResponse.json(
        { error: "Não foi possível consultar o histórico de substituições." },
        { status: 500 }
      );
    }

    const participantIds = [
      ...new Set(
        (substitutions ?? [])
          .flatMap((item) => [
            item.outgoing_participant_id,
            item.incoming_participant_id,
          ])
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const { data: participants, error: participantsError } =
      participantIds.length > 0
        ? await supabase
            .from("cwl_participants")
            .select("id,player_name,player_tag")
            .eq("season_id", round.season_id)
            .in("id", participantIds)
        : { data: [], error: null };

    if (participantsError) {
      console.error("Erro ao consultar participantes CWL:", participantsError);
      return NextResponse.json(
        { error: "Não foi possível consultar os participantes da rodada." },
        { status: 500 }
      );
    }

    const participantMap = new Map(
      (participants ?? []).map((item) => [item.id, item])
    );

    const history = (substitutions ?? []).map((item) => ({
      ...item,
      outgoing_player:
        participantMap.get(item.outgoing_participant_id ?? "") ?? null,
      incoming_player:
        participantMap.get(item.incoming_participant_id ?? "") ?? null,
    }));

    return NextResponse.json({
      success: true,
      round,
      history,
      total: history.length,
    });
  } catch (error) {
    console.error("Erro inesperado ao consultar histórico CWL:", error);

    return NextResponse.json(
      { error: "Erro inesperado ao consultar o histórico CWL." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthorizedClient(true);

    if (auth.response) return auth.response;

    const { supabase } = auth;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const payload = body as {
      roundId?: unknown;
      outgoingParticipantId?: unknown;
      reason?: unknown;
    };

    const roundId =
      typeof payload.roundId === "string" ? payload.roundId.trim() : "";

    const outgoingParticipantId =
      typeof payload.outgoingParticipantId === "string"
        ? payload.outgoingParticipantId.trim()
        : "";

    const reason =
      typeof payload.reason === "string" ? payload.reason.trim() : "";

    if (!roundId || !outgoingParticipantId) {
      return NextResponse.json(
        { error: "Informe a rodada e o jogador titular." },
        { status: 400 }
      );
    }

    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json(
        { error: "A justificativa deve ter entre 5 e 500 caracteres." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "cwl_execute_substitution",
      {
        p_round_id: roundId,
        p_outgoing_participant_id: outgoingParticipantId,
        p_reason: reason,
      }
    );

    if (error) {
      console.error("Erro na substituição CWL:", error);

      const status =
        error.code === "42501"
          ? 403
          : error.code === "P0001"
            ? 409
            : error.code?.startsWith("22") ||
                error.code?.startsWith("23")
              ? 400
              : 500;

      return NextResponse.json(
        {
          success: false,
          error:
            status === 500
              ? "Não foi possível executar a substituição. Consulte os registros do servidor."
              : error.message,
        },
        { status }
      );
    }

    const result = data as {
      success?: boolean;
      message?: string;
      round_id?: string;
      outgoing_participant_id?: string;
      incoming_lineup_id?: string;
      outgoing_slot?: number;
      reserve_queue_position?: number;
      starters?: number;
      reserves?: number;
    } | null;

    if (!result || result.success !== true) {
      console.error(
        "A função de substituição não confirmou sucesso:",
        data
      );

      return NextResponse.json(
        {
          success: false,
          error:
            result?.message ??
            "A substituição não foi confirmada pelo banco de dados.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message:
        result.message ??
        "Substituição realizada e registrada com sucesso.",
    });
  } catch (error) {
    console.error("Erro inesperado na rotação CWL:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erro inesperado ao realizar a substituição.",
      },
      { status: 500 }
    );
  }
}
