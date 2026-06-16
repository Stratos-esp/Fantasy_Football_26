// Resultado de una propuesta de normas con mayoría de TODA la liga: los que no
// votan cuentan como "no". Se puede resolver en cuanto la mayoría es imposible
// o ya está alcanzada, cuando han votado todos, o si se fuerza (cierre del admin).
export type ProposalOutcome = "approved" | "rejected" | "pending";

export function proposalOutcome(yes: number, no: number, total: number, allVoted: boolean, force = false): ProposalOutcome {
  if (yes * 2 > total) return "approved";
  if (no * 2 >= total || allVoted || force) return "rejected";
  return "pending";
}
