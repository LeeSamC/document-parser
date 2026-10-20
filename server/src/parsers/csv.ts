import Papa from 'papaparse'
import type { ParsedDocument } from './types'

export function parseCsv(buffer: Buffer): ParsedDocument {
    const text = buffer.toString('utf8').replace(/^﻿/, "")
    const res = Papa.parse<string[]>(text, {skipEmptyLines: 'greedy'})
    const rows = res.data.map((r) => r.map((c) => String(c ?? '').trim()))
    const tables = rows.length >= 2 ? [{name: 'csv', headers: rows[0], rows: rows.slice(1)}] : []
    return { text: rows.map((r) => r.join(" | ")).join("\n"), tables, pageCount: null, metadata: {errors: res.errors.length}}
}