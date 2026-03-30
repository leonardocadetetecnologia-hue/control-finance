'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, MONTHS } from '@/lib/utils/format'
import { buildGCalUrl } from '@/lib/utils/gcal'
import type { CalendarEvent } from '@/lib/types'

function toast(msg: string) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = '✓ ' + msg
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200)
}

export default function CalendarClient({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear]   = useState(now.getFullYear())
  const [events, setEvents] = useState(initialEvents)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [newDay, setNewDay] = useState(1)
  const supabase = createClient()

  // Form
  const [evType, setEvType] = useState<'income'|'expense'>('expense')
  const [evDesc, setEvDesc] = useState('')
  const [evVal,  setEvVal]  = useState('')
  const [evDay,  setEvDay]  = useState('')
  const [evDate, setEvDate] = useState('')
  const [evRepeat, setEvRepeat] = useState<'once'|'monthly'|'yearly'>('once')
  const [saving, setSaving] = useState(false)

  function changeMonth(d: number) {
    let m = month + d, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const dim      = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const prevDim  = new Date(year, month, 0).getDate()

  // Build event map by day for current month
  const evMap: Record<number, CalendarEvent[]> = {}
  events.forEach(ev => {
    if (ev.date) {
      const ed = new Date(ev.date + 'T12:00')
      if (ed.getMonth() === month && ed.getFullYear() === year) {
        const d = ed.getDate()
        if (!evMap[d]) evMap[d] = []
        evMap[d].push(ev)
      }
    } else if (ev.repeat === 'monthly' || ev.repeat === 'yearly') {
      const d = Math.min(ev.day || 1, dim)
      if (!evMap[d]) evMap[d] = []
      evMap[d].push(ev)
    }
  })

  const upcomingEvs = events.filter(ev => {
    if (ev.date) { const ed = new Date(ev.date + 'T12:00'); return ed.getMonth() === month && ed.getFullYear() === year }
    return ev.repeat === 'monthly' || ev.repeat === 'yearly'
  }).sort((a, b) => {
    const da = a.date ? new Date(a.date + 'T12:00').getDate() : a.day || 1
    const db = b.date ? new Date(b.date + 'T12:00').getDate() : b.day || 1
    return da - db
  })

  function openDay(d: number) {
    setNewDay(d)
    setEvDay(String(d))
    setEvDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    setShowEventModal(true)
  }

  async function saveEvent() {
    const val = parseFloat(evVal)
    if (!evDesc || isNaN(val) || val <= 0) { alert('Preencha todos os campos.'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: any = { user_id: user!.id, description: evDesc, value: val, type: evType, repeat: evRepeat, category: 'Outros' }
      if (evRepeat === 'once') payload.date = evDate
      else payload.day = parseInt(evDay) || newDay
      const { data } = await supabase.from('events').insert(payload).select().single()
      setEvents(prev => [...prev, data])
      setShowEventModal(false)
      toast('Evento salvo')
      if (gcalConnected) {
        const url = buildGCalUrl({ title: (evType === 'income' ? '↑ Receber: ' : '↓ Pagar: ') + evDesc + ' (' + formatBRL(val) + ')', date: evDate || `${year}-${String(month+1).padStart(2,'0')}-${String(parseInt(evDay)||1).padStart(2,'0')}`, description: `Valor: ${formatBRL(val)}\nCriado pelo Finance Control.`, recurrence: evRepeat === 'monthly' ? 'MONTHLY' : undefined })
        window.open(url, '_blank')
      }
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function delEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    toast('Evento removido')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 316px', gap: '16px' }}>
      {/* Calendar */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span className="font-bebas" style={{ fontSize: '16px', letterSpacing: '2px', color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => changeMonth(-1)} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px' }}>‹</button>
            <button onClick={() => changeMonth(1)}  style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '13px' }}>›</button>
          </div>
        </div>
        {/* DOW headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, letterSpacing: '.8px', color: 'var(--text3)', padding: '8px 0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`p${i}`} className="cal-day" style={{ opacity: .22 }}><div className="day-num" style={{ color: 'var(--text3)' }}>{prevDim - firstDow + i + 1}</div></div>
          ))}
          {Array.from({ length: dim }, (_, i) => {
            const d = i + 1
            const isToday = now.getDate() === d && now.getMonth() === month && now.getFullYear() === year
            const dayEvs = evMap[d] || []
            return (
              <div key={d} className={`cal-day${isToday ? ' today' : ''}`} onClick={() => openDay(d)}>
                <div className="day-num">{d}</div>
                {dayEvs.slice(0, 3).map((ev, i) => (
                  <div key={i} className={`day-evt ${ev.type}${ev.transaction_id ? ' installment' : ''}`}>
                    {ev.type === 'income' ? '↑' : '↓'} {ev.description.slice(0, 9)}
                  </div>
                ))}
                {dayEvs.length > 3 && <div style={{ fontSize: '9px', color: 'var(--text3)' }}>+{dayEvs.length - 3}</div>}
              </div>
            )
          })}
          {Array.from({ length: (7 - ((firstDow + dim) % 7)) % 7 }, (_, i) => (
            <div key={`n${i}`} className="cal-day" style={{ opacity: .22 }}><div className="day-num" style={{ color: 'var(--text3)' }}>{i + 1}</div></div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* GCal */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Google Calendário</div>
          <button onClick={() => { if (gcalConnected) { setGcalConnected(false); toast('Google Agenda desconectado') } else if (confirm('Conectar com Google Agenda?\n\n(Em produção: OAuth 2.0 real)')) { setGcalConnected(true); toast('Google Agenda conectado') } }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg4)', border: `1px solid ${gcalConnected ? 'var(--green)' : 'var(--border)'}`, borderRadius: '9px', padding: '10px 12px', cursor: 'pointer', fontSize: '12px', color: gcalConnected ? 'var(--green)' : 'var(--text2)', width: '100%', transition: 'all .15s', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="2" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1V3M10 1V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M1 6H14" stroke="currentColor" strokeWidth="1.2"/></svg>
            {gcalConnected ? '✓ Google Agenda conectado' : 'Conectar Google Agenda'}
          </button>
          <div style={{ marginTop: '9px', fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
            {gcalConnected ? 'Clique 📅 em qualquer evento para exportar.' : 'Exporte pagamentos e recebimentos para o Google Agenda.'}
          </div>
        </div>

        {/* Events */}
        <div className="card" style={{ flex: 1 }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Eventos do Mês</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{MONTHS[month]}</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '280px', overflowY: 'auto' }}>
            {upcomingEvs.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>Nenhum evento neste mês.</div>
            ) : upcomingEvs.map(ev => {
              const d = ev.date ? new Date(ev.date + 'T12:00').getDate() : ev.day || 1
              const gcUrl = buildGCalUrl({ title: (ev.type === 'income' ? '↑ Receber: ' : '↓ Pagar: ') + ev.description + ' (' + formatBRL(ev.value) + ')', date: ev.date || `${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(d,28)).padStart(2,'0')}`, description: `Valor: ${formatBRL(ev.value)}\nCriado pelo Finance Control.` })
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '9px', background: 'var(--bg4)', border: '1px solid var(--border)' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '2px', flexShrink: 0, background: ev.transaction_id ? 'var(--purple)' : ev.type === 'income' ? 'var(--green)' : 'var(--red)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.description}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Dia {d} · {ev.repeat === 'monthly' ? 'Mensal' : ev.repeat === 'yearly' ? 'Anual' : 'Único'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <div className="hide-val" style={{ fontSize: '12px', fontWeight: 600, color: ev.type === 'income' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                      <span>{ev.type === 'income' ? '+' : '-'}{formatBRL(ev.value)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <a href={gcUrl} target="_blank" rel="noopener noreferrer" title="Google Agenda" style={{ cursor: 'pointer', fontSize: '10px', color: 'var(--cyan)', padding: '1px 5px', border: '1px solid var(--cyan)', borderRadius: '4px', opacity: .7, textDecoration: 'none' }}>📅</a>
                      {!ev.transaction_id && <button onClick={() => delEvent(ev.id)} style={{ fontSize: '10px', color: 'var(--text3)', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: '4px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>✕</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[{ c:'var(--green)', l:'Recebimento' },{ c:'var(--red)', l:'Pagamento' },{ c:'var(--purple)', l:'Parcela' }].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text2)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: x.c }} />{x.l}
            </div>
          ))}
        </div>
      </div>

      {/* Add event modal */}
      {showEventModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEventModal(false) }}>
          <div className="modal-box" style={{ width: '430px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>Novo Evento — Dia {newDay}</span>
              <button onClick={() => setShowEventModal(false)} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'var(--bg4)', padding: '3px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                {(['income','expense'] as const).map(tp => (
                  <div key={tp} onClick={() => setEvType(tp)} style={{ padding: '7px', textAlign: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: evType === tp ? (tp === 'income' ? 'rgba(0,150,74,.12)' : 'rgba(217,0,32,.1)') : 'transparent', color: evType === tp ? (tp === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--text3)' }}>
                    {tp === 'income' ? '↑ Recebimento' : '↓ Pagamento'}
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Descrição</label>
                <input className="fi" value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Ex: Aluguel, Parcela carro..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Valor (R$)</label>
                  <input className="fi" type="number" min="0" step="0.01" value={evVal} onChange={e => setEvVal(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Recorrência</label>
                  <select className="fi" value={evRepeat} onChange={e => setEvRepeat(e.target.value as any)}>
                    <option value="once">Uma vez</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>
              {evRepeat === 'once' && (
                <div style={{ marginBottom: '13px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Data</label>
                  <input className="fi" type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowEventModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEvent} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
