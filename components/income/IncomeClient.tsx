'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { formatBRL, formatDate, todayISO } from '@/lib/utils/format'
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyDraft } from '@/lib/utils/money'
import type { IncomeSource } from '@/lib/types'

const SOURCE_OPTIONS = [
  'Salario CLT',
  'Salario PJ',
  'Freelance',
  'Comissao',
  'Bonus',
  'Aluguel',
  'Investimento',
  'Beneficio',
  'Outros',
]

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function IncomeClient({ initialSources }: { initialSources: IncomeSource[] }) {
  const [sources, setSources] = useState(initialSources)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [val, setVal] = useState('')
  const [day, setDay] = useState('')
  const [type, setType] = useState('Salario CLT')
  const [start, setStart] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const total = sources.reduce((sum, source) => sum + source.value, 0)
  const now = new Date()
  const buildPaymentDate = (year: number, month: number, day: number) =>
    new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12)
  const nextPayment = sources.map(source => {
    let date = buildPaymentDate(now.getFullYear(), now.getMonth(), source.day)
    if (date <= now) date = buildPaymentDate(now.getFullYear(), now.getMonth() + 1, source.day)
    return { ...source, _next: date }
  }).sort((a, b) => a._next.getTime() - b._next.getTime())[0]

  async function save() {
    const value = parseMoneyInput(val)
    const paymentDay = parseInt(day)
    if (!name || !Number.isFinite(value) || value <= 0 || !paymentDay) {
      alert('Preencha todos os campos.')
      return
    }
    setSaving(true)
    try {
      const source = await apiRequest<IncomeSource>('/api/income-sources', {
        method: 'POST',
        body: JSON.stringify({ name, value, day: paymentDay, source_type: type, start_date: start }),
      })
      setSources(prev => [...prev, source])
      setShowModal(false)
      setName('')
      setVal('')
      setDay('')
      setType('Salario CLT')
      setStart(todayISO())
      toast('Fonte de renda cadastrada')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Remover esta fonte de renda?')) return
    await apiRequest<{ ok: true }>(`/api/income-sources/${id}`, { method: 'DELETE' })
    setSources(prev => prev.filter(source => source.id !== id))
    toast('Fonte removida')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="font-bebas" style={{ fontSize: '28px', letterSpacing: '2px', color: 'var(--text)' }}>Fontes de renda</h1>
          <div style={{ color: 'var(--text3)', marginTop: '4px' }}>Cadastre salarios, freelas, investimentos e outras entradas fixas.</div>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Nova fonte</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Renda mensal total</div>
          <div className="hide-val font-bebas" style={{ fontSize: '34px', color: 'var(--green)', marginBottom: '6px' }}><span>{formatBRL(total)}</span></div>
          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>{sources.length} fonte(s) cadastrada(s)</div>
        </div>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>Proximo recebimento</div>
          <div className="hide-val font-bebas" style={{ fontSize: '34px', color: 'var(--text)', marginBottom: '6px' }}><span>{nextPayment ? formatBRL(nextPayment.value) : '-'}</span></div>
          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>{nextPayment ? `${nextPayment.name} - dia ${nextPayment.day} (${nextPayment._next.toLocaleDateString('pt-BR')})` : 'Nenhuma fonte cadastrada'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sources.length === 0 ? (
          <div className="card" style={{ padding: '26px', textAlign: 'center', color: 'var(--text3)' }}>Nenhuma fonte cadastrada.</div>
        ) : sources.map(source => (
          <div key={source.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', background: 'var(--bg4)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, border: '1px solid var(--border)' }}>R$</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{source.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{source.source_type} - desde {formatDate(source.start_date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hide-val" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)' }}><span>{formatBRL(source.value)}/mes</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Recebe dia {source.day}</div>
            </div>
            <button className="btn-ghost" onClick={() => del(source.id)}>Excluir</button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '24px' }}>Fonte de renda</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Fechar</button>
            </div>

            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Nome / origem</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Empresa, cliente, corretora..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Valor mensal</label>
                  <input
                    className="fi"
                    inputMode="decimal"
                    value={val}
                    onChange={e => setVal(sanitizeMoneyDraft(e.target.value))}
                    onBlur={() => setVal(current => formatMoneyInput(current))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Dia de recebimento</label>
                  <input className="fi" type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} placeholder="Ex: 5" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Tipo da fonte</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SOURCE_OPTIONS.map(option => (
                    <button key={option} className={type === option ? 'btn-primary' : 'btn-ghost'} onClick={() => setType(option)}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Ativo desde</label>
                <input className="fi" type="date" value={start} onChange={e => setStart(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '18px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
