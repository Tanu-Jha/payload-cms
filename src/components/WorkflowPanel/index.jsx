import React, { useEffect, useState, useCallback } from 'react';

/* ─── Color tokens ────────────────────────────────────────────── */
const COLORS = {
  bg:          '#f8f9fb',
  card:        '#ffffff',
  border:      '#e4e7ec',
  borderFocus: '#7c5cfc',
  text:        '#1a1d26',
  textSoft:    '#636b7f',
  textMuted:   '#9ba3b5',
  primary:     '#7c5cfc',
  primarySoft: '#ede9fe',
  green:       '#10b981',
  greenSoft:   '#d1fae5',
  red:         '#ef4444',
  redSoft:     '#fee2e2',
  amber:       '#f59e0b',
  amberSoft:   '#fef3c7',
  orange:      '#f97316',
  orangeSoft:  '#ffedd5',
  blue:        '#3b82f6',
  blueSoft:    '#dbeafe',
  slate:       '#94a3b8',
  slateSoft:   '#f1f5f9',
};

const STATUS_CONFIG = {
  pending:     { color: COLORS.slate,  bg: COLORS.slateSoft,  icon: '○' },
  active:      { color: COLORS.blue,   bg: COLORS.blueSoft,   icon: '●' },
  in_progress: { color: COLORS.amber,  bg: COLORS.amberSoft,  icon: '◑' },
  approved:    { color: COLORS.green,  bg: COLORS.greenSoft,  icon: '✓' },
  rejected:    { color: COLORS.red,    bg: COLORS.redSoft,    icon: '✗' },
  reviewed:    { color: COLORS.primary,bg: COLORS.primarySoft, icon: '◉' },
  commented:   { color: COLORS.primary,bg: COLORS.primarySoft, icon: '◉' },
  completed:   { color: COLORS.green,  bg: COLORS.greenSoft,  icon: '✓' },
  skipped:     { color: COLORS.slate,  bg: COLORS.slateSoft,  icon: '—' },
  escalated:   { color: COLORS.orange, bg: COLORS.orangeSoft,  icon: '!' },
  cancelled:   { color: COLORS.slate,  bg: COLORS.slateSoft,  icon: '✗' },
  none:        { color: COLORS.slate,  bg: COLORS.slateSoft,  icon: '○' },
};

const LOG_ICONS = {
  workflow_started:   '▶',
  step_activated:     '→',
  approved:           '✓',
  rejected:           '✗',
  reviewed:           '◉',
  commented:          '✎',
  step_skipped:       '⏭',
  sla_escalated:      '⚠',
  workflow_completed:  '★',
  workflow_rejected:   '✗',
  workflow_cancelled:  '■',
};

/* ─── Utilities ───────────────────────────────────────────────── */

const fmt = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const label = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const sc = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

/* ─── Sub-components ──────────────────────────────────────────── */

const Badge = ({ status }) => {
  const c = sc(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.03em',
      color: c.color, backgroundColor: c.bg,
    }}>
      <span style={{ fontSize: 10 }}>{c.icon}</span>
      {label(status)}
    </span>
  );
};

const Btn = ({ children, variant, disabled, onClick, style: extraStyle }) => {
  const map = {
    approve: { bg: COLORS.green,   text: '#fff' },
    reject:  { bg: COLORS.red,     text: '#fff' },
    review:  { bg: COLORS.blue,    text: '#fff' },
    comment: { bg: COLORS.primary, text: '#fff' },
    ghost:   { bg: 'transparent',  text: COLORS.textSoft, border: COLORS.border },
  };
  const v = map[variant] || map.ghost;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 16px', borderRadius: 6, border: v.border ? `1px solid ${v.border}` : 'none',
        color: v.text, backgroundColor: v.bg, fontSize: 13, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity .15s, transform .1s',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
};

/* ─── Main Component ──────────────────────────────────────────── */

const WorkflowStatusPanel = ({ documentId, collectionSlug }) => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [comment, setComment]     = useState('');
  const [showComment, setShowComment] = useState(null);
  const [busy, setBusy]           = useState(false);
  const [logsOpen, setLogsOpen]   = useState({});

  const fetchStatus = useCallback(async () => {
    if (!documentId) { setLoading(false); return; }
    try {
      const qp = collectionSlug ? `?collection=${collectionSlug}` : '';
      const r = await fetch(`/api/workflows/status/${documentId}${qp}`);
      if (r.status === 404) { setInstances([]); setLoading(false); return; }
      if (!r.ok) throw new Error('Fetch failed');
      const d = await r.json();
      setInstances(d.data?.instances || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [documentId, collectionSlug]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleAction = async (instId, action) => {
    setBusy(true);
    try {
      const r = await fetch('/api/workflows/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: instId, action, comment: comment || undefined }),
      });
      const result = await r.json();
      if (result.success) { setComment(''); setShowComment(null); await fetchStatus(); }
      else { alert(result.message || 'Action failed'); }
    } catch (e) { alert(`Error: ${e.message}`); }
    finally { setBusy(false); }
  };

  const toggleLogs = (id) => setLogsOpen(p => ({ ...p, [id]: !p[id] }));

  /* ─── Render states ─────────────────────────────────────── */

  const panelStyle = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    color: COLORS.text,
  };

  if (loading) return (
    <div style={{ ...panelStyle, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: COLORS.textMuted, fontSize: 13 }}>Loading workflow status...</p>
    </div>
  );

  if (error) return (
    <div style={{ ...panelStyle, padding: 20 }}>
      <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: COLORS.redSoft, color: COLORS.red, fontSize: 13 }}>
        Error: {error}
      </div>
    </div>
  );

  if (!documentId || instances.length === 0) return (
    <div style={{ ...panelStyle, padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.slateSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, color: COLORS.slate }}>○</div>
      <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>No Active Workflow</p>
      <p style={{ color: COLORS.textMuted, fontSize: 13, maxWidth: 340, margin: '0 auto' }}>
        This document has no workflow instances. Workflows trigger automatically or via the API.
      </p>
    </div>
  );

  /* ─── Render instances ──────────────────────────────────── */

  return (
    <div style={panelStyle}>
      {instances.map((inst) => {
        const sc_main = sc(inst.status);
        const totalSteps = inst.steps.length;
        const doneSteps  = inst.steps.filter(s => ['approved','reviewed','commented','skipped'].includes(s.status)).length;
        const progress   = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

        return (
          <div key={inst.instanceId} style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            backgroundColor: COLORS.card,
            marginBottom: 16,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.card} 100%)`,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                  {inst.workflow?.name || 'Workflow'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.textMuted }}>
                  Started {fmt(inst.startedAt)}
                  {inst.completedAt && ` — Completed ${fmt(inst.completedAt)}`}
                </p>
              </div>
              <Badge status={inst.status} />
            </div>

            {/* Progress bar */}
            <div style={{ padding: '12px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6 }}>
                <span>Progress</span>
                <span>{doneSteps}/{totalSteps} steps  ({progress}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.slateSoft, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${progress}%`,
                  backgroundColor: inst.status === 'rejected' ? COLORS.red : inst.status === 'completed' ? COLORS.green : COLORS.primary,
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>

            {/* Steps */}
            <div style={{ padding: '16px 20px' }}>
              {inst.steps.map((step, idx) => {
                const isActive    = step.status === 'active';
                const isCompleted = ['approved', 'reviewed', 'commented'].includes(step.status);
                const isRejected  = step.status === 'rejected';
                const isSkipped   = step.status === 'skipped';
                const stepSc      = sc(step.status);

                return (
                  <div key={step.stepId || idx} style={{ position: 'relative', paddingLeft: 32, paddingBottom: idx < inst.steps.length - 1 ? 20 : 0 }}>

                    {/* Vertical connector line */}
                    {idx < inst.steps.length - 1 && (
                      <div style={{
                        position: 'absolute', left: 11, top: 24, bottom: 0, width: 2,
                        backgroundColor: isCompleted ? COLORS.green : COLORS.border,
                      }} />
                    )}

                    {/* Step dot */}
                    <div style={{
                      position: 'absolute', left: 0, top: 2,
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      backgroundColor: isActive ? COLORS.blue
                        : isCompleted ? COLORS.green
                        : isRejected ? COLORS.red
                        : isSkipped ? COLORS.slate
                        : COLORS.border,
                      boxShadow: isActive ? `0 0 0 4px ${COLORS.blueSoft}` : 'none',
                      transition: 'all .2s',
                    }}>
                      {isCompleted ? '✓' : isRejected ? '✗' : isSkipped ? '—' : idx + 1}
                    </div>

                    {/* Step content */}
                    <div style={{
                      padding: '0 0 0 8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <span style={{
                            fontWeight: 600, fontSize: 14, color: COLORS.text,
                            opacity: isSkipped ? 0.5 : 1,
                          }}>
                            {step.stepName}
                          </span>
                          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                            Assigned to <strong style={{ color: COLORS.textSoft }}>{step.assignedTo || 'N/A'}</strong>
                            {step.completedAt && <span> — {fmt(step.completedAt)}</span>}
                            {step.isOverdue && <span style={{ color: COLORS.orange, fontWeight: 700 }}> OVERDUE</span>}
                          </div>
                          {step.comment && (
                            <div style={{
                              marginTop: 6, padding: '6px 10px', borderRadius: 6,
                              backgroundColor: COLORS.bg, fontSize: 12, color: COLORS.textSoft,
                              fontStyle: 'italic', borderLeft: `3px solid ${stepSc.color}`,
                            }}>
                              {step.comment}
                            </div>
                          )}
                        </div>
                        <Badge status={step.status} />
                      </div>

                      {/* Action buttons for active step */}
                      {isActive && inst.status === 'in_progress' && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${COLORS.border}` }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn variant="approve" disabled={busy} onClick={() => handleAction(inst.instanceId, 'approved')}>
                              ✓ Approve
                            </Btn>
                            <Btn variant="reject" disabled={busy} onClick={() => handleAction(inst.instanceId, 'rejected')}>
                              ✗ Reject
                            </Btn>
                            <Btn variant="review" disabled={busy} onClick={() => handleAction(inst.instanceId, 'reviewed')}>
                              Review
                            </Btn>
                            <Btn variant="comment" onClick={() => setShowComment(showComment === inst.instanceId ? null : inst.instanceId)}>
                              ✎ Comment
                            </Btn>
                          </div>

                          {showComment === inst.instanceId && (
                            <div style={{ marginTop: 10 }}>
                              <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Write your comment..."
                                style={{
                                  width: '100%', padding: '10px 12px', borderRadius: 8,
                                  border: `1px solid ${COLORS.border}`, fontSize: 13,
                                  resize: 'vertical', minHeight: 64,
                                  outline: 'none', fontFamily: 'inherit',
                                  transition: 'border-color .15s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = COLORS.primary}
                                onBlur={(e) => e.target.style.borderColor = COLORS.border}
                              />
                              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                <Btn variant="comment" disabled={busy || !comment.trim()} onClick={() => handleAction(inst.instanceId, 'commented')}>
                                  Submit Comment
                                </Btn>
                                <Btn variant="ghost" onClick={() => { setShowComment(null); setComment(''); }}>
                                  Cancel
                                </Btn>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Audit Log Toggle */}
            {inst.logs && inst.logs.length > 0 && (
              <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <button
                  onClick={() => toggleLogs(inst.instanceId)}
                  style={{
                    width: '100%', padding: '12px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, color: COLORS.textSoft,
                  }}
                >
                  <span>Audit Trail ({inst.logs.length} entries)</span>
                  <span style={{
                    transform: logsOpen[inst.instanceId] ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform .2s', fontSize: 10,
                  }}>
                    ▼
                  </span>
                </button>

                {logsOpen[inst.instanceId] && (
                  <div style={{ padding: '0 20px 16px', maxHeight: 300, overflowY: 'auto' }}>
                    {inst.logs.map((log, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 10, padding: '8px 0',
                        borderBottom: i < inst.logs.length - 1 ? `1px solid ${COLORS.slateSoft}` : 'none',
                        fontSize: 12,
                      }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: sc(log.action).bg,
                          color: sc(log.action).color, fontSize: 11, fontWeight: 700,
                        }}>
                          {LOG_ICONS[log.action] || '•'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div>
                            <strong>{label(log.action)}</strong>
                            {log.stepName && <span style={{ color: COLORS.textMuted }}> — {log.stepName}</span>}
                          </div>
                          {log.comment && <div style={{ color: COLORS.textSoft, fontStyle: 'italic', marginTop: 2 }}>{log.comment}</div>}
                          <div style={{ color: COLORS.textMuted, marginTop: 2 }}>
                            {log.user && <span>by {log.user} </span>}
                            <span>{fmt(log.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowStatusPanel;
