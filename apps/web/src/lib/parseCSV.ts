/**
 * Parse CSV text into headers + rows with quoted-field handling.
 * Returns null if the input is empty or contains only whitespace.
 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return null
  const result: string[][] = []
  for (const line of lines) {
    const row: string[] = []
    let col = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            col += '"'
            i++
          } else inQuotes = false
        } else {
          col += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          row.push(col)
          col = ''
        } else {
          col += ch
        }
      }
    }
    row.push(col)
    result.push(row)
  }
  return { headers: result[0], rows: result.slice(1) }
}
