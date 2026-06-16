import { NextResponse } from "next/server";
import { withMember } from "@/lib/api-helpers";
import { cancelProposal, closeProposal, createProposal, ServiceError, voteProposal } from "@/lib/service";

type Payload = {
  action?: string;
  summary?: string;
  settings?: unknown;
  proposalId?: string;
  approve?: boolean;
};

export async function POST(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const body = await request.json().catch(() => null) as Payload | null;
  if (!body?.action) return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  return withMember(leagueId, async ({ db, league, member, user }) => {
    switch (body.action) {
      case "create":
        if (!body.settings) throw new ServiceError("Faltan los ajustes propuestos.");
        await createProposal(db, league, member, user.id, body.summary ?? "", body.settings);
        return NextResponse.json({ ok: true });
      case "vote":
        if (!body.proposalId || typeof body.approve !== "boolean") throw new ServiceError("Voto no válido.");
        await voteProposal(db, league, member, body.proposalId, body.approve);
        return NextResponse.json({ ok: true });
      case "close":
        if (!body.proposalId) throw new ServiceError("Falta la propuesta.");
        await closeProposal(db, league, member, body.proposalId);
        return NextResponse.json({ ok: true });
      case "cancel":
        if (!body.proposalId) throw new ServiceError("Falta la propuesta.");
        await cancelProposal(db, league, member, body.proposalId);
        return NextResponse.json({ ok: true });
      default:
        throw new ServiceError("Acción de propuesta desconocida.");
    }
  });
}
