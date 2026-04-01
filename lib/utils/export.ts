import { formatDate } from './format'

export interface ExportRow {
  date: string
  description: string
  category: string
  type: string
  value: number
  status: string
  recMode: string
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportCSV(rows: ExportRow[], filename = 'finance-control.csv') {
  const headers = ['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Status', 'Recorrencia']
  const lines = rows.map(row => [
    formatDate(row.date),
    `"${row.description.replace(/"/g, '""')}"`,
    row.category,
    row.type === 'income' ? 'Receita' : 'Despesa',
    row.value.toFixed(2).replace('.', ','),
    row.status,
    row.recMode,
  ].join(';'))
  download(filename, `\uFEFF${[headers.join(';'), ...lines].join('\n')}`, 'text/csv;charset=utf-8')
}

export function exportJSON(rows: ExportRow[]) {
  download('finance-control.json', JSON.stringify(rows, null, 2), 'application/json')
}

export async function exportXLSX(rows: ExportRow[]) {
  const XLSX = await import('xlsx')
  const data = rows.map(row => ({
    Data: formatDate(row.date),
    Descricao: row.description,
    Categoria: row.category,
    Tipo: row.type === 'income' ? 'Receita' : 'Despesa',
    Valor: row.value,
    Status: row.status,
    Recorrencia: row.recMode,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historico')
  XLSX.writeFile(wb, 'finance-control.xlsx')
}
