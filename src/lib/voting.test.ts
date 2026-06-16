import { describe, expect, it } from "vitest";
import { proposalOutcome } from "./voting";

describe("proposalOutcome (mayoría de toda la liga)", () => {
  it("aprueba cuando hay mayoría aunque no hayan votado todos", () => {
    expect(proposalOutcome(3, 0, 5, false)).toBe("approved"); // 3 de 5 > mitad
  });

  it("sigue pendiente sin mayoría todavía", () => {
    expect(proposalOutcome(2, 1, 5, false)).toBe("pending");
  });

  it("rechaza cuando la mayoría ya es imposible", () => {
    expect(proposalOutcome(1, 3, 5, false)).toBe("rejected"); // 3 noes: el sí no llega a 3
  });

  it("rechaza si han votado todos sin mayoría a favor", () => {
    expect(proposalOutcome(2, 2, 4, true)).toBe("rejected"); // empate = no hay mayoría
  });

  it("el admin puede cerrar y resuelve con los votos actuales", () => {
    expect(proposalOutcome(2, 1, 5, false, true)).toBe("rejected"); // forzado sin mayoría
    expect(proposalOutcome(3, 0, 5, false, true)).toBe("approved");
  });

  it("ligas de un solo miembro: su voto basta", () => {
    expect(proposalOutcome(1, 0, 1, false)).toBe("approved");
  });
});
