export default function DashboardLoading() {
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div className="card loading-card" style={{ minHeight: '120px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        <div className="card loading-card" style={{ minHeight: '180px' }} />
        <div className="card loading-card" style={{ minHeight: '180px' }} />
        <div className="card loading-card" style={{ minHeight: '180px' }} />
      </div>
      <div className="card loading-card" style={{ minHeight: '320px' }} />
    </div>
  )
}
