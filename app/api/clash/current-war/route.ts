
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Validar autenticação
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

    // 2. Validar se o perfil está ativo
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[CURRENT WAR] Erro ao consultar perfil:", profileError);

      return NextResponse.json(
        { error: "Não foi possível validar seu perfil." },
        { status: 500 }
      );
    }

    if (!profile || profile.is_active !== true) {
      return NextResponse.json(
        { error: "Acesso permitido somente para membros aprovados." },
        { status: 403 }
      );
    }

    // 3. Consultar configuração da API
    const token = process.env.CLASH_OF_CLANS_API_TOKEN;
    const clanTag = process.env.CLASH_OF_CLANS_CLAN_TAG;

    if (!token || !clanTag) {
      return NextResponse.json(
        { error: "Token ou TAG do clã não configurado." },
        { status: 500 }
      );
    }

    const normalizedTag = clanTag.trim().replace(/^#/, "");
    const encodedTag = encodeURIComponent(`#${normalizedTag}`);

    // 4. Consultar guerra atual
    const response = await fetch(
      `https://cocproxy.royaleapi.dev/v1/clans/${encodedTag}/currentwar`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (response.status === 404) {
      const details = await response.text();

      console.error("[Clash API] current-war:", {
        status: response.status,
        details,
      });

      return NextResponse.json({
        connected: true,
        inWar: false,
        message: "A API não encontrou dados de guerra para este clã.",
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Falha ao consultar a guerra na API do Clash of Clans.",
          status: response.status,
          details:
            response.status === 403
              ? "Confira a chave da API e o IP autorizado."
              : response.status === 429
                ? "Limite de consultas atingido. Tente novamente mais tarde."
                : "Confira a configuração e tente novamente.",
        },
        { status: response.status }
      );
    }

    const war = await response.json();

    return NextResponse.json({
      connected: true,
      inWar: war.state !== "notInWar",
      state: war.state,
      teamSize: war.teamSize,
      attacksPerMember: war.attacksPerMember ?? null,
      preparationStartTime: war.preparationStartTime ?? null,
      startTime: war.startTime ?? null,
      endTime: war.endTime ?? null,
      clan: war.clan
        ? {
            tag: war.clan.tag,
            name: war.clan.name,
            stars: war.clan.stars,
            destructionPercentage: war.clan.destructionPercentage,
            attacks: war.clan.attacks ?? 0,
            members: war.clan.members ?? [],
          }
        : null,
      opponent: war.opponent
        ? {
            tag: war.opponent.tag,
            name: war.opponent.name,
            stars: war.opponent.stars,
            destructionPercentage: war.opponent.destructionPercentage,
            attacks: war.opponent.attacks ?? 0,
            members: war.opponent.members ?? [],
          }
        : null,
    });
  } catch (error) {
    console.error("[Clash API] Erro ao consultar current-war:", error);

    return NextResponse.json(
      { error: "Não foi possível conectar à API do Clash of Clans." },
      { status: 502 }
    );
  }
}
