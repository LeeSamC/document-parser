import type { ActivityStatus, RiskStatus, Severity } from "../db/schema";
import type {ParsedTable} from "../parsers/types"
import { clean, normalizeRiskStatus, normalizeSeverity, normalizeStatus, parseDate, parseNumber, parsePercent } from "./normalize";

export type EntityKind = "activity" | "indicator" | "budget" | "risk"

export interface ExtractedActivity {
    code: string | null; title: string; description: string | null; owner: string | null; component: string | null;
    startDate: string | null; endDate: string | null; status: ActivityStatus; percentComplete: number | null;
    dependsOn: string | null; sourceRef: string;
}
export interface ExtractedIndicator {
  code: string | null; name: string; unit: string | null; baseline: number | null; target: number | null;
  actual: number | null; period: string | null; sourceRef: string;
}
export interface ExtractedBudgetLine {
  activityCode: string | null; activityTitle: string | null; budgeted: number | null; actual: number | null;
  currency: string | null; sourceRef: string;
}
export interface ExtractedRisk {
  description: string; severity: Severity; likelihood: string | null; status: RiskStatus;
  mitigation: string | null; owner: string | null; sourceRef: string;
}

export interface ExtractedData {
  activities: ExtractedActivity[];
  indicators: ExtractedIndicator[];
  budgetLines: ExtractedBudgetLine[];
  risks: ExtractedRisk[];
  tablesMatched: { table: string; kind: EntityKind; rows: number }[];
  tablesSkipped: string[];
}

const SYN: Record<EntityKind, Record<string, string[]>> = {
  activity: {
    title: ["activity", "activitytitle", "activityname", "task", "taskname", "milestone", "deliverable", "description"],
    code: ["code", "id", "ref", "reference", "activityid", "activitycode", "no", "number", "#"],
    startDate: ["start", "startdate", "plannedstart", "begin", "from"],
    endDate: ["end", "enddate", "duedate", "deadline", "plannedend", "targetdate", "completiondate", "to"],
    status: ["status", "progressstatus", "activitystatus"],
    percentComplete: ["complete", "percentcomplete", "%complete", "progress", "completion", "%", "percent"],
    owner: ["responsible", "owner", "be", "beneficiaryentity", "entity", "lead", "agency", "responsibleparty", "implementer"],
    component: ["component", "output", "outcome", "workstream", "pillar"],
    dependsOn: ["dependency", "dependencies", "dependson", "predecessor", "predecessors", "prerequisite"],
  },
  indicator: {
    name: ["indicator", "indicatorname", "indicatordescription", "kpi", "outcome", "output"],
    code: ["code", "id", "ref", "indicatorid", "no", "#"],
    baseline: ["baseline", "baselinevalue"],
    target: ["target", "targetvalue", "endtarget", "loptarget"],
    actual: ["actual", "achieved", "current", "result", "currentvalue", "actualvalue", "achievement"],
    unit: ["unit", "uom", "measure", "unitofmeasure"],
    period: ["period", "reportingperiod", "quarter", "year"],
  },
  budget: {
    budgeted: ["budget", "budgeted", "budgetedamount", "planned", "plannedbudget", "allocation", "allocated", "approved", "approvedbudget"],
    title: ["activity", "activitytitle", "activityname", "description", "line", "budgetline", "item"],
    code: ["code", "id", "ref", "activitycode", "activityid", "no", "#"],
    actual: ["actual", "actuals", "expenditure", "spent", "expended", "actualexpenditure", "actualspend", "disbursed", "spend"],
    currency: ["currency", "ccy"],
  },
  risk: {
    description: ["risk", "riskdescription", "riskevent", "issue", "riskissue", "description"],
    severity: ["severity", "impact", "rating", "level", "riskrating", "riskscore", "priority"],
    likelihood: ["likelihood", "probability"],
    mitigation: ["mitigation", "mitigationaction", "action", "correctiveaction", "response", "mitigationmeasures"],
    status: ["status", "riskstatus"],
    owner: ["owner", "responsible", "riskowner", "assignedto"],
  },
};

const REQUIRED: Record<EntityKind, (m: Record<string, number>) => boolean> = {
    activity: (m) => "title" in m && ["startDate", "endDate", "status", "percentComplete"].some((f) => f in m),
    indicator: (m) => "name" in m && ["baseline", "target", "actual"].some((f) => f in m),
    budget: (m) => "budgeted" in m && ("title" in m || "code" in m),
    risk: (m) => "description" in m && ["severity", "likelihood", "mitigation"].some((f) => f in m),
}

const KIND_ORDER: EntityKind[] = ['indicator', 'risk', 'budget', 'activity']
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%#]+/g, "")

function mapColumns(kind: EntityKind, headers: string[]): Record<string, number> {
    const nh = headers.map(norm)
    const used = new Set<number>()
    const map: Record<string, number> = {}

    for(const [field, syns] of Object.entries(SYN[kind])) {
        let idx = nh.findIndex((h, i) => !used.has(i) && syns.includes(h))
        if(idx < 0) idx = nh.findIndex((h, i) => !used.has(i) && h.length > 2 && syns.some((s) => s.length >= 5 && h.includes(s)))
        if(idx >= 0) {
            map[field] = idx
            used.add(idx)
        }
    }

    return map
}

function classifyTable(t: ParsedTable): {kind: EntityKind; map: Record<string, number>} | null {
    let best: {kind: EntityKind; map: Record<string, number>; score: number} | null = null
    for(const kind of KIND_ORDER) {
        const map = mapColumns(kind, t.headers)
        if(!REQUIRED[kind](map)) continue
        const score = Object.keys(map).length
        if(!best || score > best.score) best = {kind, map, score}
    }

    return best
}

export function extractStructured(tables: ParsedTable[]): ExtractedData {
  const out: ExtractedData = { activities: [], indicators: [], budgetLines: [], risks: [], tablesMatched: [], tablesSkipped: [] };

  for (const table of tables) {
    const cls = classifyTable(table);
    if (!cls) {
      out.tablesSkipped.push(table.name);
      continue;
    }
    const { kind, map } = cls;
    let count = 0;

    table.rows.forEach((row, i) => {
      const get = (f: string) => (f in map ? clean(row[map[f]]) : null);
      const first = clean(row.find((c) => c?.trim()) ?? "");
      if (!first || /^(sub)?total\b/i.test(first) || row.filter((c) => c?.trim()).length < 2) return;
      const sourceRef = `${table.name} row ${i + 2}`;

      if (kind === "activity") {
        const title = get("title");
        if (!title) return;
        const pct = parsePercent(get("percentComplete"));
        out.activities.push({
          code: get("code"), title, description: null, owner: get("owner"), component: get("component"),
          startDate: parseDate(get("startDate")), endDate: parseDate(get("endDate")),
          status: normalizeStatus(get("status") ?? undefined, pct), percentComplete: pct,
          dependsOn: get("dependsOn"), sourceRef,
        });
      } else if (kind === "indicator") {
        const name = get("name");
        if (!name) return;
        out.indicators.push({
          code: get("code"), name, unit: get("unit"), baseline: parseNumber(get("baseline")),
          target: parseNumber(get("target")), actual: parseNumber(get("actual")), period: get("period"), sourceRef,
        });
      } else if (kind === "budget") {
        const budgeted = parseNumber(get("budgeted"));
        const actual = parseNumber(get("actual"));
        if (budgeted === null && actual === null) return;
        const raw = row.join(" ");
        const currency = get("currency") ?? (raw.match(/\b(USD|TTD|EUR|GBP)\b/i)?.[1]?.toUpperCase() ?? (raw.includes("$") ? "USD" : null));
        out.budgetLines.push({ activityCode: get("code"), activityTitle: get("title"), budgeted, actual, currency, sourceRef });
      } else {
        const description = get("description");
        if (!description) return;
        out.risks.push({
          description, severity: normalizeSeverity(get("severity") ?? undefined), likelihood: get("likelihood"),
          status: normalizeRiskStatus(get("status") ?? undefined), mitigation: get("mitigation"), owner: get("owner"), sourceRef,
        });
      }
      count++;
    });
    out.tablesMatched.push({ table: table.name, kind, rows: count });
  }
  return out;
}