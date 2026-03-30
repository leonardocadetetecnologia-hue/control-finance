'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import type { Category } from '@/lib/types'

const PALETTE = ['#00e676','#00e5ff','#e8ff00','#b388ff','#ff9100','#ff3d57','#f06292','#4db6ac','#64b5f6','#ffd54f','#a5d6a7','#ef9a9a','#80cbc4','#ce93d8','#ffcc02','#90caf9']

function toast(msg: string) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'âœ“ ' + msg
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200)
}

export default function CategoriesClient({ initialCategories, transactions }: {
  initialCategories: Category[]
  transactions: { id: string; category: string }[]
}) {
  const [cats, setCats] = useState(initialCategories)
  const [tab, setTab] = useState<'all'|'expense'|'income'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('ðŸ“¦')
  const [color, setColor] = useState('#00e5ff')
  const [type, setType] = useState<'income'|'expense'|'both'>('expense')
  const [saving, setSaving] = useState(false)

  const filtered = tab === 'all' ? cats : cats.filter(c => c.type === tab || c.type === 'both')

  function openNew() { setEditId(null); setName(''); setEmoji('ðŸ“¦'); setColor('#00e5ff'); setType('expense'); setShowModal(true) }
  function openEdit(c: Category) { setEditId(c.id); setName(c.name); setEmoji(c.emoji); setColor(c.color); setType(c.type); setShowModal(true) }

  async function save() {
    if (!name.trim()) { alert('Informe o nome.'); return }
    setSaving(true)
    try {
      if (editId) {
        const data = await apiRequest<Category>(`/api/categories/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, emoji, color, type }),
        })
        setCats(prev => prev.map(c => c.id === editId ? data : c))
        toast('Categoria atualizada')
      } else {
        const data = await apiRequest<Category>('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ name, emoji, color, type }),
        })
        setCats(prev => [...prev, data])
        toast('Categoria criada')
      }
      setShowModal(false)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function del(id: string, catName: string) {
    const count = transactions.filter(t => t.category === catName).length
    if (!confirm(`Excluir "${catName}"?${count > 0 ? `\n${count} transaÃ§Ã£o(Ãµes) usam esta categoria.` : ''}`)) return
    await apiRequest<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' })
    setCats(prev => prev.filter(c => c.id !== id))
    toast('Categoria removida')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Categorias</h1>
        <button className="btn-primary" onClick={openNew}>+ Nova Categoria</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '18px', background: 'var(--bg4)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['all','expense','income'] as const).map(t => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: tab === t ? 'var(--text)' : 'var(--text3)', background: tab === t ? 'var(--bg2)' : 'transparent', boxShadow: tab === t ? '0 1px 3px var(--shadow)' : 'none', transition: 'all .12s' }}>
            {t === 'all' ? 'Todas' : t === 'expense' ? 'Despesas' : 'Receitas'}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {filtered.map(c => {
          const count = transactions.filter(t => t.category === c.name).length
          const typeLbl = c.type === 'income' ? 'Receita' : c.type === 'expense' ? 'Despesa' : 'Receita & Despesa'
          return (
            <div key={c.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0, background: c.color + '22', border: `1px solid ${c.color}44` }}>{c.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text3)', marginTop: '2px' }}>{typeLbl}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{count} transaÃ§Ã£o(Ãµes)</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => openEdit(c)} style={{ width: '26px', height: '26px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text3)', fontSize: '11px', display:'flex',alignItems:'center',justifyContent:'center' }} onMouseEnter={e=>(e.currentTarget.style.color='var(--cyan)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>âœŽ</button>
                <button onClick={() => del(c.id, c.name)} style={{ width: '26px', height: '26px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text3)', fontSize: '11px', display:'flex',alignItems:'center',justifyContent:'center' }} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>âœ•</button>
              </div>
            </div>
          )
        })}
        <div className="card" style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', color: 'var(--text3)', minHeight: '90px' }} onClick={openNew}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>+</div>
          <div style={{ fontSize: '11px' }}>Nova categoria</div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box" style={{ width: '420px' }}>
            <div style={{ padding: '17px 22px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-bebas" style={{ fontSize: '19px', letterSpacing: '2px' }}>{editId ? 'Editar Categoria' : 'Nova Categoria'}</span>
              <button onClick={() => setShowModal(false)} style={{ width: '26px', height: '26px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px' }}>âœ•</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: '13px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Nome</label>
                <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Academia, Pet, Streaming..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Emoji</label>
                  <input className="fi" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} placeholder="ðŸ“¦" style={{ fontSize: '20px', textAlign: 'center' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '5px' }}>Tipo</label>
                  <select className="fi" value={type} onChange={e => setType(e.target.value as any)}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                    <option value="both">Ambos</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '8px' }}>Cor</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '6px' }}>
                  {PALETTE.map(c => (
                    <div key={c} onClick={() => setColor(c)} style={{ width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer', background: c, border: `2px solid ${color === c ? 'var(--text)' : 'transparent'}`, transform: color === c ? 'scale(1.08)' : 'scale(1)', transition: 'all .12s' }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
