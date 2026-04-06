export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function normalizeDateOnly(value: string | Date | null | undefined): string {
  if (!value) return ''

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return value.slice(0, 10)
}

export function parseDateAtNoon(value: string | Date | null | undefined) {
  const normalized = normalizeDateOnly(value)
  return new Date(`${normalized}T12:00:00`)
}

export function formatDate(date: string): string {
  return parseDateAtNoon(date).toLocaleDateString('pt-BR')
}

export function formatDateShort(date: string): string {
  return parseDateAtNoon(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function addMonths(dateStr: string, months: number): string {
  const d = parseDateAtNoon(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
