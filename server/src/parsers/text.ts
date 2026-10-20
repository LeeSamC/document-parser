import { detectTextTables } from "./textTables";
import type { ParsedDocument } from "./types";

export function parseText(buffer: Buffer): ParsedDocument {
    const text = buffer.toString("utf8").replace(/^﻿/, "")
    return {text, tables:  detectTextTables(text), pageCount: null, metadata: {}}
}