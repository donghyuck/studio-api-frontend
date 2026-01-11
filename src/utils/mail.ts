// src/utils/mail.ts
export type EmailChip = {
  /** 화면에 보여줄 라벨 (name 있으면 name, 없으면 email) */
  label: string;
  /** 순수 이메일(없을 수도 있음) */
  email?: string;
  /** 표시 이름(없을 수도 있음) */
  name?: string;
  /** 원본 토큰 */
  raw: string;
};

function stripQuotes(s: string) {
  return s.replace(/^"+|"+$/g, "").trim();
}

/**
 * 쉼표로 구분된 from/to/cc 같은 헤더 문자열을
 * [{label,name,email,raw}, ...] 로 파싱
 *
 * 예:
 *  - "\"홍길동\" <hong@a.com>, test@b.com"
 *  - "홍길동 <hong@a.com>"
 *  - "test@b.com"
 */
export function parseEmailHeader(
  raw?: string | null,
  opts?: { dedupe?: boolean }
): EmailChip[] {
  const input = (raw ?? "").trim();
  if (!input) return [];

  // 1) 쉼표 분리 (단순 split, 일반적인 메일헤더에 충분)
  const parts = input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const out: EmailChip[] = [];

  for (const p of parts) {
    // 2) <email> 추출
    const emailMatch = p.match(/<\s*([^>]+)\s*>/);
    const email = emailMatch?.[1]?.trim();

    // 3) name 추출: <...> 앞부분 또는 전체
    let namePart = p;
    if (emailMatch) {
      namePart = p.slice(0, emailMatch.index).trim();
    }
    const name = namePart ? stripQuotes(namePart) : undefined;

    const label = name && name.length > 0 ? name : (email ?? p);

    out.push({
      label,
      name: name && name.length > 0 ? name : undefined,
      email,
      raw: p,
    });
  }

  if (opts?.dedupe) {
    // email이 있으면 email 기준, 없으면 raw 기준으로 중복 제거
    const seen = new Set<string>();
    return out.filter((x) => {
      const key = (x.email ?? x.raw).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return out;
}
