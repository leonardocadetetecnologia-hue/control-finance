'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/components/layout/DashboardShell'
import { apiRequest } from '@/lib/api'
import { formatBRL, MONTHS } from '@/lib/utils/format'
import { buildGCalUrl, downloadFinanceCalendarIcs } from '@/lib/utils/gcal'
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyDraft } from '@/lib/utils/money'
import { expandIncomeSourcesForMonth, expandTransactionsForMonth } from '@/lib/utils/finance'
import type { CalendarEvent, Installment, Transaction } from '@/lib/types'

type EventKind = 'payment' | 'receipt' | 'reminder_charge' | 'reminder_receive'
type ListFilter = 'all' | 'income' | 'expense' | 'reminder'

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

function isReminder(kind: EventKind) {
  return kind === 'reminder_charge' || kind === 'reminder_receive'
}

function getEventKind(event: CalendarEvent): EventKind {
  if ((event.category || '').startsWith('REMINDER_CHARGE')) return 'reminder_charge'
  if ((event.category || '').startsWith('REMINDER_RECEIVE')) return 'reminder_receive'
  return event.type === 'income' ? 'receipt' : 'payment'
}

function getEventTone(event: CalendarEvent) {
  return (event.category || '').startsWith('REMINDER_') ? 'reminder' : event.type
}

function getEventLabel(event: CalendarEvent) {
  const kind = getEventKind(event)
  if (kind === 'reminder_charge') return 'Cobrar'
  if (kind === 'reminder_receive') return 'Receber'
  return kind === 'receipt' ? 'Recebimento' : 'Pagamento'
}

function getEventRecurrenceText(event: CalendarEvent) {
  if (event.repeat === 'monthly') return 'Mensal'
  if (event.repeat === 'yearly') return 'Anual'
  return 'Unico'
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getEventDateForMonth(event: CalendarEvent, year: number, month: number) {
  if (event.repeat === 'monthly') {
    const sourceDate = event.date ? new Date(`${event.date}T12:00:00`) : null
    const day = String(Math.min(event.day || sourceDate?.getDate() || 1, getDaysInMonth(year, month))).padStart(2, '0')
    return `${year}-${String(month + 1).padStart(2, '0')}-${day}`
  }

  if (event.repeat === 'yearly' && event.date) {
    const sourceDate = new Date(`${event.date}T12:00:00`)
    const targetMonth = sourceDate.getMonth()
    const targetDay = String(Math.min(sourceDate.getDate(), getDaysInMonth(year, targetMonth))).padStart(2, '0')
    return `${year}-${String(targetMonth + 1).padStart(2, '0')}-${targetDay}`
  }

  if (event.date) return event.date

  const day = String(Math.min(event.day || 1, getDaysInMonth(year, month))).padStart(2, '0')
  return `${year}-${String(month + 1).padStart(2, '0')}-${day}`
}

function getEventDay(event: CalendarEvent) {
  return event.date ? new Date(`${event.date}T12:00:00`).getDate() : event.day || 1
}

export default function CalendarClient({
  initialEvents,
  initialTransactions,
}: {
  initialEvents: CalendarEvent[]
  initialTransactions: (Transaction & { installments?: Installment[] })[]
}) {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { incomeSources } = useApp()

  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [events, setEvents] = useState(initialEvents)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [newDay, setNewDay] = useState(1)
  const [eventKind, setEventKind] = useState<EventKind>('payment')
  const [evDesc, setEvDesc] = useState('')
  const [evVal, setEvVal] = useState('')
  const [evDay, setEvDay] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evRepeat, setEvRepeat] = useState<'once' | 'monthly' | 'yearly'>('once')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [listSearch, setListSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    openDay(new Date().getDate())
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('new')
    router.replace(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname)
  }, [pathname, router, searchParams])

  function changeMonth(delta: number) {
    let nextMonth = month + delta
    let nextYear = year
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }
    if (nextMonth < 0) {
      nextMonth = 11
      nextYear -= 1
    }
    setMonth(nextMonth)
    setYear(nextYear)
  }

  function closeEventModal() {
    setShowEventModal(false)
    setEditingEventId(null)
    setEventKind('payment')
    setEvDesc('')
    setEvVal('')
    setEvDay('')
    setEvDate('')
    setEvRepeat('once')
  }

  const dim = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const prevDim = new Date(year, month, 0).getDate()

  const visibleEvents = useMemo(() => {
    const mirroredIncomeSourceEvent = (event: CalendarEvent) =>
      !event.transaction_id
      && event.type === 'income'
      && event.repeat === 'monthly'
      && incomeSources.some((source) =>
        source.name === event.description
        && source.day === (event.day || source.day)
        && Math.abs(source.value - Number(event.value || 0)) < 0.001,
      )

    const standaloneEvents = events.filter((event) => !mirroredIncomeSourceEvent(event))

    const existingTransactionDates = new Set(
      standaloneEvents
        .filter(event => event.transaction_id)
        .map(event => `${event.transaction_id}|${getEventDateForMonth(event, year, month)}`),
    )

    const existingIncomeDates = new Set(
      standaloneEvents
        .filter(event => !event.transaction_id && event.type === 'income')
        .map(event => `${event.description}|${getEventDateForMonth(event, year, month)}|${Number(event.value || 0)}`),
    )

    const derivedEvents = expandTransactionsForMonth(initialTransactions, year, month)
      .filter(row => row.transactionId)
      .filter(row => !existingTransactionDates.has(`${row.transactionId}|${row.date}`))
      .map<CalendarEvent>((row, index) => ({
        id: `derived-${row.transactionId}-${row.date}-${index}`,
        user_id: '',
        transaction_id: row.transactionId,
        description: row.description,
        value: row.value,
        type: row.type,
        repeat: 'once',
        date: row.date,
        category: row.category,
      }))

    const derivedIncomeEvents = expandIncomeSourcesForMonth(incomeSources, year, month)
      .filter(row => !existingIncomeDates.has(`${row.description}|${row.date}|${row.value}`))
      .map<CalendarEvent>((row) => ({
        id: `source-${row.sourceId}-${row.date}`,
        user_id: '',
        description: row.description,
        value: row.value,
        type: 'income',
        repeat: 'monthly',
        day: new Date(`${row.date}T12:00:00`).getDate(),
        date: row.date,
        category: row.category,
      }))

    return [...standaloneEvents, ...derivedEvents, ...derivedIncomeEvents]
  }, [events, incomeSources, initialTransactions, month, year])

  const evMap: Record<number, CalendarEvent[]> = {}
  visibleEvents.forEach(event => {
    const resolvedDate = getEventDateForMonth(event, year, month)
    if (!resolvedDate) return

    const date = new Date(`${resolvedDate}T12:00:00`)
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate()
      if (!evMap[day]) evMap[day] = []
      evMap[day].push({ ...event, date: resolvedDate })
    }
  })

  const upcomingEvents = visibleEvents
    .map((event) => ({ ...event, date: getEventDateForMonth(event, year, month) }))
    .filter(event => {
      if (!event.date) return false
      const date = new Date(`${event.date}T12:00:00`)
      return date.getMonth() === month && date.getFullYear() === year
    })
    .sort((a, b) => {
      const dayA = getEventDay(a)
      const dayB = getEventDay(b)
    if (dayA !== dayB) return dayA - dayB
    return a.description.localeCompare(b.description)
    })

  const filteredUpcomingEvents = upcomingEvents.filter((event) => {
    const tone = getEventTone(event)
    const matchesFilter = listFilter === 'all'
      || (listFilter === 'reminder' && tone === 'reminder')
      || (listFilter === 'income' && tone === 'income')
      || (listFilter === 'expense' && tone === 'expense')

    const search = listSearch.trim().toLowerCase()
    const matchesSearch = !search
      || event.description.toLowerCase().includes(search)
      || getEventLabel(event).toLowerCase().includes(search)
      || String(getEventDay(event)).includes(search)

    return matchesFilter && matchesSearch
  })

  function openDay(day: number) {
    setEditingEventId(null)
    setNewDay(day)
    setEvDay(String(day))
    setEvDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setEventKind('payment')
    setEvDesc('')
    setEvVal('')
    setEvRepeat('once')
    setShowEventModal(true)
  }

  function openEditEvent(event: CalendarEvent) {
    if (event.transaction_id || event.id.startsWith('source-')) return

    const day = getEventDay(event)
    setEditingEventId(event.id)
    setNewDay(day)
    setEventKind(getEventKind(event))
    setEvDesc(event.description)
    setEvVal(event.value ? formatMoneyInput(event.value) : '')
    setEvRepeat(event.repeat)
    setEvDay(event.repeat === 'monthly' ? String(event.day || day) : String(day))
    setEvDate(event.date || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setShowEventModal(true)
  }

  async function saveEvent() {
    const rawValue = evVal.trim()
    const value = rawValue ? parseMoneyInput(rawValue) : 0
    if (!evDesc.trim()) {
      alert('Informe a descricao do evento.')
      return
    }
    if (rawValue && (!Number.isFinite(value) || value < 0)) {
      alert('Informe um valor no formato de reais.')
      return
    }
    if (!isReminder(eventKind) && value <= 0) {
      alert('Informe um valor maior que zero.')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        description: evDesc.trim(),
        value,
        type: eventKind === 'payment' ? 'expense' : 'income',
        repeat: evRepeat,
        category: eventKind === 'reminder_charge'
          ? 'REMINDER_CHARGE'
          : eventKind === 'reminder_receive'
            ? 'REMINDER_RECEIVE'
            : 'Outros',
      }

      if (evRepeat === 'monthly') payload.day = Number(evDay || newDay)
      else payload.date = evDate

      const endpoint = editingEventId ? `/api/events/${editingEventId}` : '/api/events'
      const method = editingEventId ? 'PATCH' : 'POST'
      const data = await apiRequest<CalendarEvent>(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      setEvents(prev => (
        editingEventId
          ? prev.map(event => (event.id === editingEventId ? data : event))
          : [...prev, data]
      ))
      closeEventModal()
      toast(editingEventId ? 'Evento atualizado' : 'Evento salvo')

      if (gcalConnected) {
        const calendarUrl = buildGCalUrl({
          title: `${getEventLabel({ ...data, category: payload.category })}: ${evDesc}`,
          date: data.date || evDate || `${year}-${String(month + 1).padStart(2, '0')}-${String(Number(evDay) || 1).padStart(2, '0')}`,
          description: value > 0 ? `Valor: ${formatBRL(value)}` : 'Lembrete criado no Finance Control',
          recurrence: evRepeat === 'monthly' ? 'MONTHLY' : evRepeat === 'yearly' ? 'YEARLY' : undefined,
        })
        window.open(calendarUrl, '_blank')
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function delEvent(id: string) {
    await apiRequest<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(event => event.id !== id))
    toast('Evento removido')
  }

  function exportMonthToGoogleCalendar() {
    const items = upcomingEvents.map(event => {
      const eventDate = getEventDateForMonth(event, year, month)
      const label = getEventLabel(event)
      const amount = event.value ? `Valor: ${formatBRL(event.value)}` : 'Lembrete sem valor'
      return {
        id: event.id,
        title: `${label}: ${event.description}`,
        date: eventDate,
        description: `${label} do Finance Control. ${amount}`,
      }
    })

    if (items.length === 0) {
      alert('Nao ha eventos neste mes para exportar.')
      return
    }

    downloadFinanceCalendarIcs(
      items,
      `finance-control-google-agenda-${year}-${String(month + 1).padStart(2, '0')}.ics`,
    )
    toast('Arquivo .ics gerado para importar no Google Agenda')
  }

  return (
    <div className="calendar-layout">
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '18px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="font-bebas" style={{ fontSize: '20px' }}>{MONTHS[month]} {year}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-ghost" onClick={() => changeMonth(-1)}>{'<'}</button>
            <button className="btn-ghost" onClick={() => changeMonth(1)}>{'>'}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, letterSpacing: '.8px', color: 'var(--text3)', padding: '10px 0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{day}</div>
          ))}
        </div>

        <div className="calendar-legend">
          <span className="calendar-legend-item"><span className="calendar-legend-dot income" /> Receita</span>
          <span className="calendar-legend-item"><span className="calendar-legend-dot expense" /> Despesa</span>
          <span className="calendar-legend-item"><span className="calendar-legend-dot reminder" /> Lembrete</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDow }, (_, index) => (
            <div key={`p${index}`} className="cal-day" style={{ opacity: 0.22 }}>
              <div className="day-num" style={{ color: 'var(--text3)' }}>{prevDim - firstDow + index + 1}</div>
            </div>
          ))}

          {Array.from({ length: dim }, (_, index) => {
            const day = index + 1
            const isToday = now.getDate() === day && now.getMonth() === month && now.getFullYear() === year
            const dayEvents = evMap[day] || []
            const hasIncome = dayEvents.some(event => getEventTone(event) === 'income')
            const hasExpense = dayEvents.some(event => getEventTone(event) === 'expense')
            const hasReminder = dayEvents.some(event => getEventTone(event) === 'reminder')
            const toneCount = [hasIncome, hasExpense, hasReminder].filter(Boolean).length
            const toneClass = toneCount > 1
              ? ' mixed-day'
              : hasIncome
                ? ' income-day'
                : hasExpense
                  ? ' expense-day'
                  : hasReminder
                    ? ' reminder-day'
                    : ''

            return (
              <div key={day} className={`cal-day${isToday ? ' today' : ''}${toneClass}`} onClick={() => openDay(day)}>
                <div className="day-num">{day}</div>
                {(hasIncome || hasExpense || hasReminder) && (
                  <div className="day-accent-bar">
                    {hasIncome && <span className="day-accent income" />}
                    {hasExpense && <span className="day-accent expense" />}
                    {hasReminder && <span className="day-accent reminder" />}
                  </div>
                )}
                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                  <div key={eventIndex} className={`day-evt ${getEventTone(event)}${event.transaction_id ? ' installment' : ''}`}>
                    {getEventLabel(event)}: {event.description.slice(0, 9)}
                  </div>
                ))}
                {dayEvents.length > 3 && <div style={{ fontSize: '10px', color: 'var(--text3)' }}>+{dayEvents.length - 3}</div>}
              </div>
            )
          })}

          {Array.from({ length: (7 - ((firstDow + dim) % 7)) % 7 }, (_, index) => (
            <div key={`n${index}`} className="cal-day" style={{ opacity: 0.22 }}>
              <div className="day-num" style={{ color: 'var(--text3)' }}>{index + 1}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-sidebar">
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Google Agenda</div>
          <button className="btn-ghost" style={{ width: '100%' }} onClick={() => setGcalConnected(prev => !prev)}>
            {gcalConnected ? 'Google Agenda conectada' : 'Conectar Google Agenda'}
          </button>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Lancamentos de {MONTHS[month]}</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={exportMonthToGoogleCalendar}>Google Agenda (.ics)</button>
              <button className="btn-primary" onClick={() => openDay(newDay)}>+ Evento</button>
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              className="fi"
              placeholder="Filtrar por descricao, tipo ou dia..."
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={listFilter === 'all' ? 'btn-primary' : 'btn-ghost'} onClick={() => setListFilter('all')}>Todos</button>
              <button className={listFilter === 'income' ? 'btn-primary' : 'btn-ghost'} onClick={() => setListFilter('income')}>Receitas</button>
              <button className={listFilter === 'expense' ? 'btn-primary' : 'btn-ghost'} onClick={() => setListFilter('expense')}>Despesas</button>
              <button className={listFilter === 'reminder' ? 'btn-primary' : 'btn-ghost'} onClick={() => setListFilter('reminder')}>Lembretes</button>
            </div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {filteredUpcomingEvents.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '14px', textAlign: 'center', padding: '18px 0' }}>Nenhum evento neste mes.</div>
            ) : filteredUpcomingEvents.map((event) => {
              const day = getEventDay(event)
              const tone = getEventTone(event)
              const calendarUrl = buildGCalUrl({
                title: `${getEventLabel(event)}: ${event.description}`,
                date: event.date || `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, getDaysInMonth(year, month))).padStart(2, '0')}`,
                description: event.value ? `Valor: ${formatBRL(event.value)}` : 'Lembrete do Finance Control',
                recurrence: event.repeat === 'monthly' ? 'MONTHLY' : event.repeat === 'yearly' ? 'YEARLY' : undefined,
              })

              return (
                <div key={event.id} className={`calendar-event-card ${tone}`}>
                  <div className="calendar-event-dot" style={{ background: tone === 'reminder' ? 'var(--orange)' : tone === 'income' ? 'var(--green)' : 'var(--red)' }} />
                  <div className="calendar-event-main">
                    <div className="calendar-event-title">{event.description}</div>
                    <div className="calendar-event-meta">
                      {getEventLabel(event)} - dia {day} - {getEventRecurrenceText(event)}
                    </div>
                  </div>
                  <div className="calendar-event-side">
                    <div className="hide-val calendar-event-value" style={{ color: tone === 'reminder' ? 'var(--orange)' : tone === 'income' ? 'var(--green)' : 'var(--red)' }}>
                      <span>{event.value ? formatBRL(event.value) : 'Lembrete'}</span>
                    </div>
                    <div className="calendar-event-actions">
                      <a className="btn-ghost" href={calendarUrl} target="_blank" rel="noreferrer">Google Agenda</a>
                      {!event.transaction_id && !event.id.startsWith('source-') && (
                        <>
                          <button className="btn-ghost" onClick={() => openEditEvent(event)}>Editar</button>
                          <button className="btn-ghost" onClick={() => delEvent(event.id)}>Excluir</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showEventModal && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) setShowEventModal(false) }}>
          <div className="modal-box">
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '24px' }}>{editingEventId ? 'Editar evento' : `Novo evento - dia ${newDay}`}</span>
              <button className="btn-ghost" onClick={closeEventModal}>Fechar</button>
            </div>

            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className={eventKind === 'payment' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEventKind('payment')}>Pagamento</button>
                <button className={eventKind === 'receipt' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEventKind('receipt')}>Recebimento</button>
                <button className={eventKind === 'reminder_charge' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEventKind('reminder_charge')}>Lembrar de cobrar</button>
                <button className={eventKind === 'reminder_receive' ? 'btn-primary' : 'btn-ghost'} onClick={() => setEventKind('reminder_receive')}>Lembrar de receber</button>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Descricao</label>
                <input className="fi" value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Ex: cobranca cliente, aluguel, comissao..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>
                    {isReminder(eventKind) ? 'Valor estimado (opcional)' : 'Valor'}
                  </label>
                  <input
                    className="fi"
                    inputMode="decimal"
                    value={evVal}
                    onChange={e => setEvVal(sanitizeMoneyDraft(e.target.value))}
                    onBlur={() => setEvVal(current => formatMoneyInput(current))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Recorrencia</label>
                  <select className="fi" value={evRepeat} onChange={e => setEvRepeat(e.target.value as any)}>
                    <option value="once">Uma vez</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>

              {evRepeat === 'monthly' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia da recorrencia</label>
                  <input className="fi" type="number" min="1" max="31" value={evDay} onChange={e => setEvDay(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Data</label>
                  <input className="fi" type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                </div>
              )}
            </div>

            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-ghost" onClick={closeEventModal}>Cancelar</button>
              <button className="btn-primary" onClick={saveEvent} disabled={saving}>{saving ? 'Salvando...' : editingEventId ? 'Salvar alteracoes' : 'Criar evento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
