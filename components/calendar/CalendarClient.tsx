'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { formatBRL, MONTHS } from '@/lib/utils/format'
import { buildGCalUrl, downloadFinanceCalendarIcs } from '@/lib/utils/gcal'
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyDraft } from '@/lib/utils/money'
import type { CalendarEvent } from '@/lib/types'

type EventKind = 'payment' | 'receipt' | 'reminder_charge' | 'reminder_receive'

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

function getEventDateForMonth(event: CalendarEvent, year: number, month: number) {
  if (event.date) return event.date
  const day = String(Math.min(event.day || 1, 28)).padStart(2, '0')
  return `${year}-${String(month + 1).padStart(2, '0')}-${day}`
}

export default function CalendarClient({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const now = new Date()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [events, setEvents] = useState(initialEvents)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [newDay, setNewDay] = useState(1)
  const [eventKind, setEventKind] = useState<EventKind>('payment')
  const [evDesc, setEvDesc] = useState('')
  const [evVal, setEvVal] = useState('')
  const [evDay, setEvDay] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evRepeat, setEvRepeat] = useState<'once' | 'monthly' | 'yearly'>('once')
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

  const dim = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const prevDim = new Date(year, month, 0).getDate()

  const evMap: Record<number, CalendarEvent[]> = {}
  events.forEach(event => {
    if (event.date) {
      const date = new Date(`${event.date}T12:00:00`)
      if (date.getMonth() === month && date.getFullYear() === year) {
        const day = date.getDate()
        if (!evMap[day]) evMap[day] = []
        evMap[day].push(event)
      }
    } else if (event.repeat === 'monthly' || event.repeat === 'yearly') {
      const day = Math.min(event.day || 1, dim)
      if (!evMap[day]) evMap[day] = []
      evMap[day].push(event)
    }
  })

  const upcomingEvents = events.filter(event => {
    if (event.date) {
      const date = new Date(`${event.date}T12:00:00`)
      return date.getMonth() === month && date.getFullYear() === year
    }
    return event.repeat === 'monthly' || event.repeat === 'yearly'
  }).sort((a, b) => {
    const dayA = a.date ? new Date(`${a.date}T12:00:00`).getDate() : a.day || 1
    const dayB = b.date ? new Date(`${b.date}T12:00:00`).getDate() : b.day || 1
    return dayA - dayB
  })

  function openDay(day: number) {
    setNewDay(day)
    setEvDay(String(day))
    setEvDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
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

      if (evRepeat === 'once') payload.date = evDate
      else payload.day = Number(evDay || newDay)

      const data = await apiRequest<CalendarEvent>('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setEvents(prev => [...prev, data])
      setShowEventModal(false)
      setEvDesc('')
      setEvVal('')
      setEventKind('payment')
      toast('Evento salvo')

      if (gcalConnected) {
        const calendarUrl = buildGCalUrl({
          title: `${getEventLabel({ ...data, category: payload.category })}: ${evDesc}`,
          date: evDate || `${year}-${String(month + 1).padStart(2, '0')}-${String(Number(evDay) || 1).padStart(2, '0')}`,
          description: value > 0 ? `Valor: ${formatBRL(value)}` : 'Lembrete criado no Finance Control',
          recurrence: evRepeat === 'monthly' ? 'MONTHLY' : undefined,
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '18px' }}>
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
            return (
              <div key={day} className={`cal-day${isToday ? ' today' : ''}`} onClick={() => openDay(day)}>
                <div className="day-num">{day}</div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Google Agenda</div>
          <button className="btn-ghost" style={{ width: '100%' }} onClick={() => setGcalConnected(prev => !prev)}>
            {gcalConnected ? 'Google Agenda conectada' : 'Conectar Google Agenda'}
          </button>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Eventos do mes</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={exportMonthToGoogleCalendar}>Google Agenda (.ics)</button>
              <button className="btn-primary" onClick={() => openDay(newDay)}>+ Evento</button>
            </div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {upcomingEvents.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '14px', textAlign: 'center', padding: '18px 0' }}>Nenhum evento neste mes.</div>
            ) : upcomingEvents.map((event) => {
              const day = event.date ? new Date(`${event.date}T12:00:00`).getDate() : event.day || 1
              const calendarUrl = buildGCalUrl({
                title: `${getEventLabel(event)}: ${event.description}`,
                date: event.date || `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`,
                description: event.value ? `Valor: ${formatBRL(event.value)}` : 'Lembrete do Finance Control',
              })

              return (
                <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'var(--bg4)', border: '1px solid var(--border)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: getEventTone(event) === 'reminder' ? 'var(--orange)' : event.type === 'income' ? 'var(--green)' : 'var(--red)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{event.description}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                      {getEventLabel(event)} - dia {day} - {event.repeat === 'monthly' ? 'Mensal' : event.repeat === 'yearly' ? 'Anual' : 'Unico'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hide-val" style={{ fontWeight: 700, color: event.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                      <span>{event.value ? formatBRL(event.value) : 'Lembrete'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <a className="btn-ghost" href={calendarUrl} target="_blank" rel="noreferrer">GC</a>
                      {!event.transaction_id && <button className="btn-ghost" onClick={() => delEvent(event.id)}>Excluir</button>}
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
              <span className="font-bebas" style={{ fontSize: '24px' }}>Novo evento - dia {newDay}</span>
              <button className="btn-ghost" onClick={() => setShowEventModal(false)}>Fechar</button>
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

              {evRepeat === 'once' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Data</label>
                  <input className="fi" type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia da recorrencia</label>
                  <input className="fi" type="number" min="1" max="31" value={evDay} onChange={e => setEvDay(e.target.value)} />
                </div>
              )}
            </div>

            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setShowEventModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEvent} disabled={saving}>{saving ? 'Salvando...' : 'Criar evento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
