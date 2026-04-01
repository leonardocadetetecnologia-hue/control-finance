'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { formatBRL } from '@/lib/utils/format'
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyDraft } from '@/lib/utils/money'
import type { Goal } from '@/lib/types'

const EMOJIS = ['🏖️', '🚗', '🏠', '📱', '✈️', '💰', '🎓', '💪', '🏋️', '🎸', '🐶', '🌍']
const COLORS = ['var(--cyan)', 'var(--purple)', 'var(--orange)', 'var(--green)', 'var(--accent)']

function toast(msg: string) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = 'OK ' + msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

export default function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [cur, setCur] = useState('')
  const [target, setTarget] = useState('')
  const [emoji, setEmoji] = useState('💰')
  const [saving, setSaving] = useState(false)

  async function save() {
    const currentValue = cur.trim() ? parseMoneyInput(cur) : 0
    const targetValue = parseMoneyInput(target)

    if (!name || !Number.isFinite(targetValue) || targetValue <= 0) {
      alert('Preencha nome e valor alvo.')
      return
    }

    if (cur.trim() && (!Number.isFinite(currentValue) || currentValue < 0)) {
      alert('Informe um valor atual no formato de reais.')
      return
    }

    setSaving(true)
    try {
      const data = await apiRequest<Goal>('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name,
          emoji,
          current_value: currentValue,
          target_value: targetValue,
        }),
      })
      setGoals(prev => [...prev, data])
      setShowModal(false)
      setName('')
      setCur('')
      setTarget('')
      setEmoji('💰')
      toast('Meta criada')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Excluir esta meta?')) return
    await apiRequest<{ ok: true }>(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(goal => goal.id !== id))
    toast('Meta removida')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h1 className="font-bebas" style={{ fontSize: '24px', letterSpacing: '2px', color: 'var(--text)' }}>Metas Financeiras</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Meta</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {goals.map((goal, index) => {
          const pct = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
          return (
            <div key={goal.id} className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }}>{goal.emoji}</span>
                <button
                  onClick={() => del(goal.id)}
                  style={{
                    width: '28px',
                    height: '28px',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  x
                </button>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>{goal.name}</div>
              <div className="hide-val" style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
                <span>{formatBRL(goal.current_value)} / {formatBRL(goal.target_value)}</span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg4)', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: COLORS[index % COLORS.length], borderRadius: '999px', transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{pct}% concluido</div>
            </div>
          )
        })}

        <div
          className="card"
          style={{
            padding: '18px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderStyle: 'dashed',
            color: 'var(--text3)',
            minHeight: '140px',
          }}
          onClick={() => setShowModal(true)}
        >
          <div style={{ fontSize: '30px', marginBottom: '8px' }}>+</div>
          <div style={{ fontSize: '13px' }}>Nova meta</div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ width: '440px' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px' }}>Nova Meta</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Fechar</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>Nome</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Reserva de emergencia..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>Valor atual (R$)</label>
                  <input
                    className="fi"
                    inputMode="decimal"
                    value={cur}
                    onChange={e => setCur(sanitizeMoneyDraft(e.target.value))}
                    onBlur={() => setCur(current => formatMoneyInput(current))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '6px' }}>Meta (R$)</label>
                  <input
                    className="fi"
                    inputMode="decimal"
                    value={target}
                    onChange={e => setTarget(sanitizeMoneyDraft(e.target.value))}
                    onBlur={() => setTarget(current => formatMoneyInput(current))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>Icone</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {EMOJIS.map(item => (
                    <span
                      key={item}
                      onClick={() => setEmoji(item)}
                      style={{
                        fontSize: '22px',
                        cursor: 'pointer',
                        padding: '5px 8px',
                        borderRadius: '10px',
                        border: `1px solid ${emoji === item ? 'var(--accent)' : 'var(--border)'}`,
                        background: emoji === item ? 'var(--bg4)' : 'transparent',
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
