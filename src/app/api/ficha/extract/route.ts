import { NextResponse } from "next/server";
import { extractFichaWithVision } from "@/lib/ficha-vision";
import { getCurrentSessionProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const { user, profile } = await getCurrentSessionProfile();
  if (!user || !profile?.active) {
    return NextResponse.json({ ok: false, message: "Sessao expirada. Faca login novamente." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("ficha");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Envie uma foto da ficha." }, { status: 400 });
    }
    const result = await extractFichaWithVision(file);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("api/ficha/extract", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "Nao foi possivel ler a ficha agora. Tente novamente." }, { status: 500 });
  }
}
