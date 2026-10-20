export interface ParsedTable {
    name: string;
    headers: string[]
    rows: string[][]
}

export interface ParsedDocument {
    text: string
    tables: ParsedTable[]
    pageCount: number | null
    metadata: Record<string, unknown>
}