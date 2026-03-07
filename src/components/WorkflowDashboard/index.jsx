import React, { useEffect, useState } from 'react';

const C = {
  bg:        '#f8f9fb',
  card:      '#ffffff',
  border:    '#e4e7ec',
  text:      '#1a1d26',
  textSoft:  '#636b7f',
  textMuted: '#9ba3b5',
  primary:   '#7c5cfc',
  green:     '#10b981',
  red:       '#ef4444',
  amber:     '#f59e0b',
  orange:    '#f97316',
  blue:      '#3b82f6',
};

const STATUS_STYLES = {
  in_progress: { color: C.amber,  bg: '#fef3c7' },
  completed:   { color: C.green,  bg: '#d1fae5' },
  rejected:    { color: C.red,    bg: '#fee2e2' },
  pending:     { color: C.textMuted, bg: '#f1f5f9' },
  cancelled:   { color: '#6b7280', bg: '#f1f5f9' },
};

const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const WorkflowDashboard = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, completed: 0, rejected: 0, overdue: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await fetch('/api/workflow-instances?limit=20&sort=-createdAt&depth=1');
        if (r.ok) {
          const data = await r.json();
          const docs = data.docs || [];
          setInstances(docs);
          setStats({
            active:    docs.filter(d => d.status === 'in_progress').length,
            completed: docs.filter(d => d.status === 'completed').length,
            rejected:  docs.filter(d => d.status === 'rejected').length,
            overdue:   docs.filter(d => d.stepStatuses?.some(s => s.isOverdue)).length,
          });
        }
      } catch (err) { console.error('Dashboard fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const panelFont = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' };

  if (loading) return (
    <div style={{ ...panelFont, padding: 32, textAlign: 'center' }}>
      <div style={{
        width: 22, height: 22, border: `3px solid ${C.border}`, borderTopColor: C.primary,
        borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 10px',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: C.textMuted, fontSize: 13 }}>Loading workflows...</p>
    </div>
  );

  const statCards = [
    { label: 'Active',    value: stats.active,    color: C.amber,  bg: '#fef3c7', icon: '◑' },
    { label: 'Completed', value: stats.completed,  color: C.green,  bg: '#d1fae5', icon: '✓' },
    { label: 'Rejected',  value: stats.rejected,   color: C.red,    bg: '#fee2e2', icon: '✗' },
    { label: 'Overdue',   value: stats.overdue,    color: C.orange, bg: '#ffedd5', icon: '!' },
  ];

  return (
    <div style={{
      ...panelFont,
      padding: 24, marginBottom: 24,
      backgroundColor: C.card, borderRadius: 12,
      border: `1px solid ${C.border}`,
    }}>
      {/* Title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.primary}, #a78bfa)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, fontWeight: 700,
        }}>W</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>
            Workflow Overview
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Real-time workflow status across all collections</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            padding: '18px 16px', borderRadius: 10,
            backgroundColor: s.bg, textAlign: 'center',
            border: `1px solid ${s.color}18`,
            transition: 'transform .15s',
          }}>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity Table */}
      {instances.length > 0 ? (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.textSoft }}>
            Recent Activity
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Workflow', 'Collection', 'Status', 'Current Step', 'Date'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 12px',
                      fontSize: 11, fontWeight: 700, color: C.textMuted,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: `2px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instances.slice(0, 10).map((inst) => {
                  const wfName = typeof inst.workflow === 'object' ? inst.workflow?.name : 'Unknown';
                  const currentStep = inst.stepStatuses?.[inst.currentStepIndex];
                  const ss = STATUS_STYLES[inst.status] || STATUS_STYLES.pending;

                  return (
                    <tr key={inst.id} style={{ borderBottom: `1px solid ${C.bg}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{wfName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          backgroundColor: C.bg, fontSize: 12, fontWeight: 500,
                        }}>
                          {inst.documentCollection}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 700, color: ss.color, backgroundColor: ss.bg,
                        }}>
                          {(inst.status || '').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {currentStep?.stepName || 'N/A'}
                        {currentStep?.isOverdue && (
                          <span style={{ color: C.orange, marginLeft: 6, fontWeight: 700, fontSize: 11 }}>OVERDUE</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', color: C.textMuted }}>{fmt(inst.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: C.textMuted, fontSize: 13 }}>
          <p>No workflow instances yet. Create a workflow and trigger it on a document.</p>
        </div>
      )}
    </div>
  );
};

export default WorkflowDashboard;
