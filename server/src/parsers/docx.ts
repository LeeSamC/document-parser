import mammoth from 'mammoth'
import {parse} from 'node-html-parser'
import type { ParsedDocument, ParsedTable } from './types'

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
    const [raw, html] = await Promise.all([
        mammoth.extractRawText({buffer}),
        mammoth.convertToHtml({buffer})
    ])

    const root = parse(html.value)
    const tables: ParsedTable[] = []
    root.querySelectorAll('table').forEach((t, i) => {
        const rows = t
            .querySelectorAll('tr')
            .map((tr) => tr.querySelectorAll('th,td').map((c) => c.text.trim()))
            .filter((r) => r.some(Boolean))
        
        if(rows.length >= 2) tables.push({name: `table-${i + 1}`, headers: rows[0], rows: rows.slice(1)})
    })

    return {
        text: raw.value,
        tables,
        pageCount: null,
        metadata: {warnings: [...raw.messages, ...html.messages].map((m) => m.message).slice(0, 20)}

    }
}