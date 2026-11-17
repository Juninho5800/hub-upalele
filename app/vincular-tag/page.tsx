
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TagLinkContent } from "./tag-link-content";

export const dynamic = "force-dynamic";

export default async function TagLinkPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("player_tag, is_active, in_game_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[TAG LINK PAGE]", profileError);
    throw new Error("Não foi possível carregar seu perfil.");
  }

  if (!profile) {
    throw new Error("Perfil não encontrado. Entre em contato com a liderança.");
  }

  // Identifica um cadastro novo, ainda aguardando a primeira vinculação.
  const isInitialRegistration =
    profile.is_active === false &&
    !profile.player_tag &&
    profile.in_game_name === "Aguardando vinculação";

  // Jogadores ativos que já possuem TAG vão direto ao dashboard.
  if (profile.is_active && profile.player_tag) {
    redirect("/dashboard");
  }

  // Consulta a solicitação mais recente.
  const { data: latestRequest, error: requestError } = await supabase
    .from("tag_link_requests")
    .select("status, created_at, rejection_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) {
    console.error("[TAG LINK REQUEST]", requestError);
    throw new Error("Não foi possível consultar sua solicitação.");
  }

  // Perfil inativo que não é um cadastro inicial:
  // acesso bloqueado pela liderança.
  if (!profile.is_active && !isInitialRegistration) {
    return (
      <TagLinkContent
        playerName={profile.in_game_name}
        hasLinkedTag={Boolean(profile.player_tag)}
        isActive={false}
        latestRequest={null}
      />
    );
  }

  return (
    <TagLinkContent
      playerName={profile.in_game_name}
      hasLinkedTag={Boolean(profile.player_tag)}
      isActive={true}
      latestRequest={latestRequest}
    />
  );
}
