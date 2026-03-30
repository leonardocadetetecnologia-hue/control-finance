export default function CardsPage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 className="font-bebas" style={{ fontSize: '22px', letterSpacing: '2px', color: 'var(--text)' }}>Meus Cartões</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {/* Nubank */}
        <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)', border: '1px solid #2a2a5a', borderRadius: '14px', padding: '22px', minHeight: '148px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-14px', top: '-14px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)' }} />
          <div className="font-bebas" style={{ fontSize: '12px', letterSpacing: '2px', color: '#6366f1', marginBottom: '18px' }}>NUBANK</div>
          <div style={{ fontSize: '12px', color: '#888', letterSpacing: '3px', marginBottom: '12px' }}>•••• •••• •••• 4521</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div><div style={{ fontSize: '9px', color: '#555' }}>LIMITE</div><div style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0' }}>R$ 5.000</div></div>
            <div className="font-bebas" style={{ fontSize: '18px', color: '#6366f1' }}>VISA</div>
          </div>
        </div>
        {/* Inter */}
        <div style={{ background: 'linear-gradient(135deg,#1a2e1a,#162116)', border: '1px solid #2a5a2a', borderRadius: '14px', padding: '22px', minHeight: '148px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-14px', top: '-14px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,150,74,0.12)' }} />
          <div className="font-bebas" style={{ fontSize: '12px', letterSpacing: '2px', color: '#00e676', marginBottom: '18px' }}>INTER</div>
          <div style={{ fontSize: '12px', color: '#888', letterSpacing: '3px', marginBottom: '12px' }}>•••• •••• •••• 7893</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div><div style={{ fontSize: '9px', color: '#555' }}>LIMITE</div><div style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f0' }}>R$ 3.200</div></div>
            <div className="font-bebas" style={{ fontSize: '18px', color: '#00e676' }}>MC</div>
          </div>
        </div>
        {/* Add */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)', minHeight: '148px', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>+</div>
          <div style={{ fontSize: '12px' }}>Adicionar cartão</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>Em breve</div>
        </div>
      </div>
    </div>
  )
}
