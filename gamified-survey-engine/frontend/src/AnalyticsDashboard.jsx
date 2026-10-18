import React, { useState, useEffect } from 'react';

export default function AnalyticsDashboard({ config }) {
  const [telemetryEvents, setTelemetryEvents] = useState([]);
  const [metrics, setMetrics] = useState({
    risk_tolerance: 65,
    collaborative_empathy: 50,
    price_sensitivity: 40,
    tactical_aggression: 55,
  });
  const [activeTab, setActiveTab] = useState('overview');

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/analytics');
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          setTelemetryEvents(data.events);
          calculateMetrics(data.events);
        }
      }
    } catch (e) {
      console.warn("Analytics fetch error:", e);
    }
  };

  const calculateMetrics = (events) => {
    let burnCount = 0;
    let lockpickCount = 0;
    let combatCount = 0;
    let dialogueCount = 0;

    events.forEach(ev => {
      if (ev.interaction_type === 'CHEMISTRY_BURN') burnCount++;
      if (ev.interaction_type === 'STEALTH_LOCKPICK') lockpickCount++;
      if (ev.interaction_type === 'COMBAT_KILL') combatCount++;
      if (ev.interaction_type === 'DIALOGUE_CHOICE') dialogueCount++;
    });

    const total = events.length || 1;
    setMetrics({
      risk_tolerance: Math.min(100, Math.round(50 + (combatCount + burnCount) * 12 - lockpickCount * 5)),
      collaborative_empathy: Math.min(100, Math.round(45 + dialogueCount * 15)),
      price_sensitivity: Math.min(100, Math.round(40 + lockpickCount * 10)),
      tactical_aggression: Math.min(100, Math.round(((combatCount + burnCount) / total) * 100)),
    });
  };

  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ padding: '16px', background: '#0e1422', borderRadius: '12px', border: '1px solid #1f293d' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#e2e8f0', fontFamily: 'Cinzel, serif' }}>
            Gemma 4 Psychometric Telemetry
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Real-time implicit & explicit decision decoding
          </p>
        </div>
        <button
          onClick={fetchTelemetry}
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            background: '#1e293b',
            color: '#38bdf8',
            border: '1px solid #334155',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Psychometric KPI Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#131b2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
            <span style={{ color: '#cbd5e1' }}>Risk Tolerance</span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{metrics.risk_tolerance}%</span>
          </div>
          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${metrics.risk_tolerance}%`, background: 'linear-gradient(90deg, #f59e0b, #ef4444)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ background: '#131b2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
            <span style={{ color: '#cbd5e1' }}>Collaborative Empathy</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{metrics.collaborative_empathy}%</span>
          </div>
          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${metrics.collaborative_empathy}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ background: '#131b2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
            <span style={{ color: '#cbd5e1' }}>Tactical Aggression</span>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{metrics.tactical_aggression}%</span>
          </div>
          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${metrics.tactical_aggression}%`, background: 'linear-gradient(90deg, #ef4444, #ec4899)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ background: '#131b2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
            <span style={{ color: '#cbd5e1' }}>Price Sensitivity</span>
            <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>{metrics.price_sensitivity}%</span>
          </div>
          <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${metrics.price_sensitivity}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* Live Event Stream Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>Live Telemetry Stream ({telemetryEvents.length} events)</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Listening on :8000/api/telemetry</span>
        </div>
        <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px' }}>
          {telemetryEvents.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No player events recorded yet. Trigger actions in-game or interact with props!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#111827', color: '#94a3b8', borderBottom: '1px solid #1f2937' }}>
                  <th style={{ padding: '8px' }}>Interaction</th>
                  <th style={{ padding: '8px' }}>Question ID</th>
                  <th style={{ padding: '8px' }}>Option Selected</th>
                  <th style={{ padding: '8px' }}>Weapon</th>
                </tr>
              </thead>
              <tbody>
                {telemetryEvents.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #172033', color: '#e2e8f0' }}>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        background: ev.interaction_type.includes('BURN') ? '#ef444433' :
                                    ev.interaction_type.includes('STEALTH') ? '#38bdf833' :
                                    ev.interaction_type.includes('DIALOGUE') ? '#10b98133' : '#8b5cf633',
                        color: ev.interaction_type.includes('BURN') ? '#f87171' :
                               ev.interaction_type.includes('STEALTH') ? '#38bdf8' :
                               ev.interaction_type.includes('DIALOGUE') ? '#34d399' : '#a78bfa',
                      }}>
                        {ev.interaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '8px', color: '#94a3b8' }}>{ev.question_id}</td>
                    <td style={{ padding: '8px', color: '#cbd5e1' }}>{ev.selected_option}</td>
                    <td style={{ padding: '8px', color: '#f59e0b' }}>{ev.weapon_equipped || 'Blade'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
