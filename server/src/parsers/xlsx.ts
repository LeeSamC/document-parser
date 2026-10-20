import ExcelJS from 'exceljs'
import type { ParsedDocument, ParsedTable } from './types'

function cellText(v: ExcelJS.CellValue, numFmt?: string): string {
    if(v === null || v === undefined) return ""
    if(v instanceof Date) return v.toISOString().slice(0, 10);
    if(typeof v === 'number') return numFmt?.includes('%') ? `${Math.round(v * 10000) / 100}%` : String(v)
    if(typeof v === 'object') {
        const o = v as unknown as Record<string, unknown>
        if('result' in o) return cellText(o.result as ExcelJS.CellValue, numFmt)
        if(Array.isArray(o.richText)) return (o.richText as {text: string}[]).map((r) => r.text).join('')
        if('text' in o) return String(o.text);
        return ""
    }

    return String(v).trim()
}

export async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const tables: ParsedTable[] = []
    const textParts: string[] = []

    wb.eachSheet((ws) => {
        const grid: string[][] = []
        for(let r = 1; r <= ws.rowCount; r++){
            const row = ws.getRow(r)
            const cells: string[] = []

            for(let c = 1; c <= ws.columnCount; c++) {
                const cell = row.getCell(c)
                cells.push(cellText(cell.value, cell.numFmt))
            }

            if(cells.some(Boolean)) grid.push(cells)
        }

        const headerIdx = grid.findIndex((r) => r.filter(Boolean).length >= 2)
        if(headerIdx >= 0 && grid.length - headerIdx >= 2) {
            tables.push({name: ws.name, headers: grid[headerIdx], rows: grid.slice(headerIdx + 1)})
        }
        textParts.push(`# Sheet: ${ws.name}`, ...grid.map((r) => r.join(" | ")))
    })

    return  {text: textParts.join("\n"), tables, pageCount: null, metadata: {sheets: wb.worksheets.map((w) => w.name)}}
}