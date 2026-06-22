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
