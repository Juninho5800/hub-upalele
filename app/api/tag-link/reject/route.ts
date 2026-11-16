
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    // 2. Validar cargo
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
        { error: "Somente líder e colíder podem rejeitar solicitações." },
        { status: 403 }
      );
    }

    // 3. Validar dados recebidos
    const body = await request.json();

    const requestId =
      typeof body?.requestId === "string" ? body.requestId : "";

    const reason =
      typeof body?.reason === "string"
        ? body.reason.trim().slice(0, 500)
        : null;

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

    // 4. Executar rejeição no banco
    const admin = createAdminClient();

    const { data, error: rejectionError } = await admin.rpc(
      "reject_tag_link_request",
      {
        p_request_id: requestId,
        p_reviewer_id: user.id,
        p_reason: reason,
      }
    );

    if (rejectionError) throw rejectionError;

    return NextResponse.json({
      success: true,
      message: "Solicitação rejeitada.",
      result: data,
    });
  } catch (error) {
    console.error("[TAG LINK REJECTION]", error);

    return NextResponse.json(
      { error: "Não foi possível rejeitar a solicitação." },
      { status: 500 }
    );
  }
}
