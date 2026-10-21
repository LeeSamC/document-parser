import type {ActivityStatus, RiskStatus, Severity} from '../db/schema'

export function parseNumber(s?: string | null): number | null {
    if(!s) return null
    const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : null
}

export function parsePercent(s?: string | null): number | null {
    const n = parseNumber(s)
    if(n === null) return null
    const hasPct = !!s && s.includes("%")
    const v = !hasPct && n > 0 && n < 1 ? n * 100 : n
    return Math.max(0, Math.min(100, Math.round(v * 100) / 100))
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

export function parseDate(s?: string | null): string | null {
    if(!s) return null
    const t = s.trim()
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return valid(+m[1], +m[2], +m[3])
    m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
    if(m) {
        let d = +m[1]
        let mo = +m[2]
        let y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
        if(mo > 12 && d <= 12) [d, mo] = [mo, d]
        return valid(y, mo, d)
    }
    m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/)
    if (m) return valid(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1])
    m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
    if (m) return valid(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
    return null
}

function valid(y: number, mo: number, d: number): string | null {
    if(!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (dt.getUTCMonth() !== mo - 1) return null
    return dt.toISOString().slice(0, 10)
}

export function normalizeStatus(raw: string | undefined, percent: number | null): ActivityStatus {
    const s = (raw ?? "").toLowerCase()
    if(/cancel|dropped/.test(s)) return "cancelled"
    if(/complete|done|finished|achieved|closed/.test(s)) return "completed"
    if(/delay|overdue|late|behind/.test(s)) return "delayed"
    if(/risk|concern|red/.test(s)) return "at_risk"
    if(/progress|ongoing|under way|underway|started|active/.test(s)) return "in_progress";
    if(/not started|pending|planned|upcoming|to do|todo|not yet/.test(s)) return "not_started";
    if(percent !== null) return percent >= 100 ? "completed" : percent > 0 ? "in_progress" : "not_started"
    return "not_started"
}

export function normalizeSeverity(raw?: string): Severity {
  const s = (raw ?? "").toLowerCase();
  if (/crit|extreme|very high/.test(s)) return "critical";
  if (/high|major|severe/.test(s)) return "high";
  if (/low|minor|negligible/.test(s)) return "low";
  return "medium";
}

export function normalizeRiskStatus(raw?: string): RiskStatus {
  const s = (raw ?? "").toLowerCase();
  if (/clos|resolv/.test(s)) return "closed";
  if (/mitigat|monitor|ongoing|progress/.test(s)) return "mitigating";
  return "open";
}

export const clean = (s: string | undefined | null): string | null => {
    const v = (s ?? "").replace(/\s+/g, " ").trim()
    return v ? v : null;
}