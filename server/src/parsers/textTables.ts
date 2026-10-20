import type { ParsedTable } from "./types"; 

/**
 * Heuristic table detection for plain text /PDF text
 * 3 plus consecutive lines whose cells are separated by tabs, pipes or 2 plus spaces
 * and that share the same column count (>= 3 columns)
 */

export function detectTextTables(text: string): ParsedTable[] {
    const tables: ParsedTable[] = []
    let block: string[][] = []

    const flush = () => {
        if(block.length >= 3) {
            tables.push({name: `text-table-${tables.length + 1}`, headers: block[0], rows: block.slice(1)})
        }
        block= []
    }
    for(const line of text.split(/\r?\n/)) {
        const cells = line
            .trim()
            .split(/\t+|\s{2,}|\s*\|\s*/)
            .map((c) => c.trim())
            .filter(Boolean)

        if(cells.length >= 3 && (block.length === 0 || cells.length === block[0].length)) {
            block.push(cells)
        }else{
            flush()
            if(cells.length >= 3) block.push(cells)
        }
    }
    flush()
    return tables
}