
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClanMembers } from "@/lib/clash/raid-api";
import { normalizeTag } from "@/lib/clash/strategy";

export const dynamic = "force-dynamic";

function mapClashRole(role: string) {
  switch (role) {
    case "leader":
      return "leader";
    case "coLeader":
      return "co_leader";
    case "admin":
      return "elder";
    case "member":
      return "member";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    // 1. Validar sessão
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

    // 2. Validar se o usuário é líder ou colíder
    const { data: reviewer, error: reviewerError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (reviewerError) throw reviewerError;

    if (
      !reviewer ||
      !reviewer.is_active ||
      !["leader", "co_leader"].includes(reviewer.role)
    ) {
      return NextResponse.json(
        { error: "Somente líder e colíder podem aprovar solicitações." },
        { status: 403 }
      );
    }

    // 3. Validar solicitação
    const body = await request.json();
    const requestId =
      typeof body?.requestId === "string" ? body.requestId : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestId
      )
    ) {
      return NextResponse.json(
        { error: "ID da solicitação inválido." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: linkRequest, error: requestError } = await admin
      .from("tag_link_requests")
      .select("id, user_id, player_tag, status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    if (!linkRequest || linkRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Solicitação não encontrada ou já analisada." },
        { status: 404 }
      );
    }

    // 4. Consultar novamente os membros oficiais do clã
    const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

    if (!clanTag) {
      throw new Error("TAG do clã não configurada.");
    }

    const members = await getClanMembers(clanTag);

    const member = members.find(
      (item) =>
        normalizeTag(item.tag) === normalizeTag(linkRequest.player_tag)
    );

    if (!member) {
      return NextResponse.json(
        { error: "Esse jogador não pertence mais ao clã." },
        { status: 403 }
      );
    }

    // 5. Converter cargo oficial para o cargo do sistema
    const dbRole = mapClashRole(member.role);

    if (!dbRole) {
      return NextResponse.json(
        { error: "Cargo do jogador não reconhecido pela aplicação." },
        { status: 400 }
      );
    }

    // 6. Executar aprovação no banco
    const { data, error: approvalError } = await admin.rpc(
      "approve_tag_link_request",
      {
        p_request_id: requestId,
        p_reviewer_id: user.id,
        p_player_tag: member.tag,
        p_in_game_name: member.name,
        p_role: dbRole,
      }
    );

    if (approvalError) throw approvalError;

    return NextResponse.json({
      success: true,
      message: "Jogador aprovado e perfil atualizado.",
      result: data,
    });
  } catch (error) {
    console.error("[TAG LINK APPROVAL]", error);

    return NextResponse.json(
      { error: "Não foi possível aprovar a solicitação." },
      { status: 500 }
    );
  }
}
