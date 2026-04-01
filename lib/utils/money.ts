const MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeMoneyString(value: string) {
  const trimmed = value
    .replace(/\s+/g, '')
    .replace(/^R\$/i, '')
    .trim()

  if (!trimmed) return ''

  const signal = trimmed.startsWith('-') ? '-' : ''
  const unsigned = trimmed.replace(/-/g, '')
  const commaCount = (unsigned.match(/,/g) || []).length
  const dotCount = (unsigned.match(/\./g) || []).length
  const commaThousandsPattern = /^\d{1,3}(,\d{3})+$/
  const dotThousandsPattern = /^\d{1,3}(\.\d{3})+$/

  if (commaCount > 0 && dotCount > 0) {
    const decimalIndex = Math.max(unsigned.lastIndexOf(','), unsigned.lastIndexOf('.'))
    const integer = unsigned.slice(0, decimalIndex).replace(/[^\d]/g, '')
    const decimal = unsigned.slice(decimalIndex + 1).replace(/[^\d]/g, '').slice(0, 2)
    if (!decimal) return ''
    return `${signal}${integer || '0'}.${decimal.padEnd(2, '0')}`
  }

  if (commaCount > 1 && dotCount === 0) {
    return commaThousandsPattern.test(unsigned)
      ? `${signal}${unsigned.replace(/[^\d]/g, '')}`
      : ''
  }

  if (dotCount > 1 && commaCount === 0) {
    return dotThousandsPattern.test(unsigned)
      ? `${signal}${unsigned.replace(/[^\d]/g, '')}`
      : ''
  }

  if (commaCount === 1 && dotCount === 0) {
    const [integer, decimal = ''] = unsigned.split(',')
    if (decimal.length <= 2) {
      return `${signal}${integer.replace(/[^\d]/g, '') || '0'}.${decimal.replace(/[^\d]/g, '').padEnd(2, '0')}`
    }
    if (/^\d{1,3},\d{3}$/.test(unsigned)) {
      return `${signal}${unsigned.replace(/[^\d]/g, '')}`
    }
    return ''
  }

  if (dotCount === 1 && commaCount === 0) {
    const [integer, decimal = ''] = unsigned.split('.')
    if (decimal.length <= 2) {
      return `${signal}${integer.replace(/[^\d]/g, '') || '0'}.${decimal.replace(/[^\d]/g, '').padEnd(2, '0')}`
    }
    if (/^\d{1,3}\.\d{3}$/.test(unsigned)) {
      return `${signal}${unsigned.replace(/[^\d]/g, '')}`
    }
    return ''
  }

  const digits = unsigned.replace(/[^\d]/g, '')
  return digits ? `${signal}${digits}` : ''
}

export function sanitizeMoneyDraft(value: string) {
  const cleaned = value.replace(/[^\d,.\-]/g, '')
  const signal = cleaned.startsWith('-') ? '-' : ''
  const unsigned = cleaned.replace(/-/g, '')
  const lastSeparatorIndex = Math.max(unsigned.lastIndexOf(','), unsigned.lastIndexOf('.'))

  if (lastSeparatorIndex === -1) {
    return `${signal}${unsigned.replace(/[^\d]/g, '')}`
  }

  const integer = unsigned.slice(0, lastSeparatorIndex).replace(/[^\d]/g, '')
  const separator = unsigned[lastSeparatorIndex]
  const decimal = unsigned.slice(lastSeparatorIndex + 1).replace(/[^\d]/g, '').slice(0, 2)
  return `${signal}${integer}${separator}${decimal}`
}

export function parseMoneyInput(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundMoney(value) : Number.NaN
  }

  const normalized = normalizeMoneyString(String(value ?? ''))
  if (!normalized) return Number.NaN

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? roundMoney(parsed) : Number.NaN
}

export function parseOptionalMoneyInput(value: unknown) {
  const parsed = parseMoneyInput(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoneyInput(value: unknown) {
  const parsed = parseMoneyInput(value)
  return Number.isFinite(parsed) ? MONEY_FORMATTER.format(parsed) : ''
}
