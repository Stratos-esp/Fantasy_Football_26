const WINDOWS_1252_BYTES = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function damageScore(value: string) {
  return [...value].reduce((score, char) => score + (
    char === "\ufffd" ? 8 : char === "\u00c3" || char === "\u00c2" || char === "\u00e2" ? 2 : 0
  ), 0);
}

function windows1252Bytes(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const byte = code <= 0xff ? code : WINDOWS_1252_BYTES.get(code);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  return Uint8Array.from(bytes);
}

export function repairTextEncoding(value: string) {
  let repaired = value;
  for (let attempt = 0; attempt < 2 && /[\u00c2\u00c3\u00e2]/.test(repaired); attempt += 1) {
    const bytes = windows1252Bytes(repaired);
    if (!bytes) break;
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (damageScore(decoded) >= damageScore(repaired)) break;
      repaired = decoded;
    } catch {
      break;
    }
  }
  return repaired.normalize("NFC");
}

export function repairTextTree<T>(value: T): T {
  if (typeof value === "string") return repairTextEncoding(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairTextTree(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, repairTextTree(item)]),
    ) as T;
  }
  return value;
}
