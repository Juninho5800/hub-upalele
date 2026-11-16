
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCapitalRaidSeasons,
  getClanMembers,
} from "@/lib/clash/raid-api";
import { normalizeTag } from "@/lib/clash/strategy";

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
      console.error("[RAID TEST] Erro ao consultar perfil:", profileError);

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

    // 3. Validar configuração do clã
    const clanTag =
      process.env.CLASH_OF_CLANS_CLAN_TAG ||
      process.env.CLAN_TAG;

    if (!clanTag) {
      return NextResponse.json(
        { error: "TAG do clã não configurada." },
        { status: 500 }
      );
    }

    // 4. Consultar dados do Raide
    const [raidResult, clanMembers] = await Promise.all([
      getCapitalRaidSeasons(clanTag, 10),
      getClanMembers(clanTag),
    ]);

    const seasons = raidResult.items ?? [];
    const currentSeason = seasons[0];

    if (currentSeason) {
      const participants = new Map(
        (currentSeason.members ?? []).map((member) => [
          normalizeTag(member.tag),
          member,
        ])
      );

      const completeMemberList = clanMembers.map((member) => {
        const raidMember = participants.get(
          normalizeTag(member.tag)
        );

        return {
          tag: member.tag,
          name: member.name,
          attacks: raidMember?.attacks ?? 0,
          attackLimit: raidMember?.attackLimit ?? 5,
          bonusAttackLimit: raidMember?.bonusAttackLimit ?? 0,
          capitalResourcesLooted:
            raidMember?.capitalResourcesLooted ?? 0,
          participated: (raidMember?.attacks ?? 0) > 0,
        };
      });

      currentSeason.members = completeMemberList;
    }

    return NextResponse.json({
      success: true,
      clanTag,
      totalSeasons: seasons.length,
      totalClanMembers: clanMembers.length,
      seasons,
    });
  } catch (error) {
    console.error("Erro ao consultar Raide:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao consultar Raide.",
      },
      { status: 500 }
    );
  }
}
