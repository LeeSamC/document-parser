import type {DocType} from "../db/schema"

const RULES: [DocType, RegExp][] = [
    ["terms_of_reference", /terms[\s_-]*of[\s_-]*reference|\btor\b/i],
    ["lessons_learned", /lessons?[\s_-]*learn/i],
    ["risk_register", /risk[\s_-]*(register|log)|issue[\s_-]*log/i],
    ["quarterly_report", /quarterly|\bq[1-4]\b/i],
    ["annual_report", /annual/i],
    ["steering_committee_report", /steering|monthly[\s_-]*report/i],
    ["micro_plan", /micro[\s_-]*plan|work[\s_-]*plan|gantt|timeline/i],
    ["meal_framework", /meal|results[\s_-]*framework|log[\s_-]*frame|logframe|indicator/i],
    ["budget", /budget|expenditure|financial/i],
    ["meeting_minutes", /minutes|meeting/i],
]

export function classifyDocument(filename: string, text: string): DocType {
    for (const [type, re] of RULES) if(re.test(filename)) return type
    const head = text.slice(0, 3000)
    for ( const [type, re] of RULES) if(re.test(head)) return type
    return 'other'
}

export function detectPeriod(filename: string, text: string): string | null {
  const hay = `${filename}\n${text.slice(0, 3000)}`;
  let m = hay.match(/(?<![A-Za-z])Q([1-4])\s*[-/ ]?\s*(?:FY)?\s*(20\d{2})(?!\d)/i);
  if (m) return `${m[2]}-Q${m[1]}`;
  m = hay.match(/(?<!\d)(20\d{2})\s*[-/ ]?\s*Q([1-4])(?!\d)/i);
  if (m) return `${m[1]}-Q${m[2]}`;
  return null;
}
