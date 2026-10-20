import path from 'node:path'
import { parseCsv } from './csv'
import { parseDocx } from './docx'
import { parsePdf } from './pdf'
import { parseText } from './text'
import type { ParsedDocument } from './types'
import { parseXlsx } from './xlsx'

export type {ParsedDocument, ParsedTable} from './types'
export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md"] as const

export function isSupported(filename: string): boolean {
    return (SUPPORTED_EXTENSIONS as readonly string[]).includes(path.extname(filename).toLowerCase())
}

export async function parseBuffer(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const ext = path.extname(filename).toLowerCase()
    switch(ext) {
        case ".pdf":
            return parsePdf(buffer)
        case ".docx":
            return parseDocx(buffer)
        case ".xlsx":
            return parseXlsx(buffer)
        case ".csv":
            return parseCsv(buffer)
        case ".txt":
        case ".md":
            return parseText(buffer)
        default:
            throw new Error(`Unsupported file type "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`)
    }
}