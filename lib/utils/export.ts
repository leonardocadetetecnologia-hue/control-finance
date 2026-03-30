import { formatBRL, formatDate } from './format'

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

export function exportCSV(rows: ExportRow[]) {
  const headers = ['Data','Descrição','Categoria','Tipo','Valor','Status','Recorrência']
  const lines = rows.map(r => [
    formatDate(r.date),
    `"${r.description.replace(/"/g,'""')}"`,
    r.category,
    r.type === 'income' ? 'Receita' : 'Despesa',
    r.value.toFixed(2).replace('.', ','),
    r.status,
    r.recMode,
  ].join(';'))
  const bom = '\uFEFF'
  download('finex-historico.csv', bom + [headers.join(';'), ...lines].join('\n'), 'text/csv;charset=utf-8')
}

export function exportJSON(rows: ExportRow[]) {
  download('finex-historico.json', JSON.stringify(rows, null, 2), 'application/json')
}

export async function exportXLSX(rows: ExportRow[]) {
  const XLSX = await import('xlsx')
  const data = rows.map(r => ({
    Data: formatDate(r.date),
    Descrição: r.description,
    Categoria: r.category,
    Tipo: r.type === 'income' ? 'Receita' : 'Despesa',
    Valor: r.value,
    Status: r.status,
    Recorrência: r.recMode,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
  XLSX.writeFile(wb, 'finex-historico.xlsx')
}
