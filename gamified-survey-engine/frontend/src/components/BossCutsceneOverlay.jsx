import React from 'react';

export default function BossCutsceneOverlay({
  isCutsceneActive,
  bossData,
  showBossBar,
  bossHealth,
  bossMaxHealth,
  bossPoise,
  bossMaxPoise,
  bossStaggered
}) {
  const bossName = bossData?.name || 'MALAKOR, ARBITER OF FISCAL RISK';
  const kpiSubtitle = bossData?.subtitle || `Final Evaluation: ${(bossData?.targetMetric || 'Executive Crisis Decision-Making').replace(/_/g, ' ').toUpperCase()}`;
  const hpPct = Math.max(0, Math.min(100, ((bossHealth ?? 140) / Math.max(1, bossMaxHealth || 140)) * 100));
  const poisePct = Math.max(0, Math.min(100, ((bossPoise ?? 80) / Math.max(1, bossMaxPoise || 80)) * 100));

  return (
    <>
      {/* 1. Top & Bottom Letterbox Cinema Bars (3.5s Boss Intro Cutscene) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: isCutsceneActive ? '64px' : '0px',
          background: '#000000',
          borderBottom: isCutsceneActive ? '1px solid #7f1d1d' : 'none',
          transition: 'height 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 26,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isCutsceneActive ? '64px' : '0px',
          background: '#000000',
          borderTop: isCutsceneActive ? '1px solid #7f1d1d' : 'none',
          transition: 'height 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 26,
          pointerEvents: 'none'
        }}
      />

      {/* 2. Dark Souls Gothic Serif Boss Title Banner during 3.5s Camera Swoop */}
      {isCutsceneActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '82%',
            textAlign: 'center',
            padding: '16px 28px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(15, 7, 12, 0.92) 20%, rgba(15, 7, 12, 0.92) 80%, rgba(0,0,0,0) 100%)',
            borderTop: '1px solid rgba(239, 68, 68, 0.55)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.55)',
            zIndex: 27,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '24px',
              fontWeight: 'bold',
              letterSpacing: '0.16em',
              color: '#fef2f2',
              textTransform: 'uppercase',
              textShadow: '0 0 18px rgba(239, 68, 68, 0.85)'
            }}
          >
            {bossName}
          </div>
          <div
            style={{
              width: '180px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
              margin: '6px auto'
            }}
          />
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '12px',
              letterSpacing: '0.12em',
              color: '#fca5a5',
              fontStyle: 'italic'
            }}
          >
            {kpiSubtitle}
          </div>
        </div>
      )}

      {/* 3. Wide Bottom-Screen Boss HP & Poise Gauge (Active after Cutscene or in Boss Arena) */}
      {!isCutsceneActive && showBossBar && hpPct > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '68%',
            background: 'rgba(8, 10, 18, 0.88)',
            border: '1px solid rgba(185, 28, 28, 0.65)',
            borderRadius: '8px',
            padding: '8px 16px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.85)',
            zIndex: 14,
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <span
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '13px',
                fontWeight: 'bold',
                letterSpacing: '0.09em',
                color: '#fecaca',
                textTransform: 'uppercase'
              }}
            >
              💀 {bossName}
            </span>
            <span style={{ fontSize: '10px', color: bossStaggered ? '#facc15' : '#fda4af', fontWeight: 'bold' }}>
              {bossStaggered ? '⚡ POISE SHATTERED (CRITICAL WINDOW!)' : `HP: ${Math.round(bossHealth)} / ${Math.round(bossMaxHealth || 140)}`}
            </span>
          </div>

          {/* Crimson Boss Health Bar */}
          <div style={{ height: '9px', background: '#1f1218', borderRadius: '3px', overflow: 'hidden', border: '1px solid #7f1d1d', marginBottom: '4px' }}>
            <div
              style={{
                height: '100%',
                width: `${hpPct}%`,
                background: 'linear-gradient(90deg, #991b1b, #ef4444, #f87171)',
                transition: 'width 0.18s ease-out'
              }}
            />
          </div>

          {/* Golden/Amber Boss Poise Bar */}
          <div style={{ height: '4px', background: '#0f172a', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${poisePct}%`,
                background: bossStaggered ? '#facc15' : '#f59e0b',
                transition: 'width 0.18s ease-out'
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
