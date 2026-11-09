/**
 * RFC4180-ish CSV parser (handles quoted fields, `""` escapes, commas/CRLF inside quotes).
 * Returns rows; empty rows are dropped.
 */
export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
  }
  return rows
}
