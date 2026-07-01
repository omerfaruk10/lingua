// Minimal, dogru kacisli CSV uretici + tarayicidan indirme yardimcisi.

function escapeCell(value: string): string {
  // Virgul, tirnak veya satir sonu varsa tirnak icine al; ic tirnaklari ikiye katla.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

// toCsv'nin simetrigi: tirnakli alan, kacis tirnagi (""), virgul/satir sonu iceren
// hucreler, CRLF/LF ve bastaki UTF-8 BOM'u dogru ayristirir. Tamamen bos satirlar atlanir.
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = src.length

  while (i < len) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        field += ch
        i += 1
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
    } else if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
    } else if (ch === '\r') {
      i += 1
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else {
      field += ch
      i += 1
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

export function downloadCsv(filename: string, csv: string): void {
  // UTF-8 BOM: Excel'in Turkce/aksanli karakterleri dogru okumasi icin.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
