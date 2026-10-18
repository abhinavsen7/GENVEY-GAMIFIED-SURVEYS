import React from 'react';

const RARITY_TIERS = [
  { label: 'LEGENDARY RELIC', color: '#facc15', bg: 'rgba(250, 204, 21, 0.12)', border: '#eab308' },
  { label: 'EPIC ARTIFACT', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: '#a855f7' },
  { label: 'RARE ARMAMENT', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: '#0284c7' }
];

export default function LootInventoryHUD({
  isOpen,
  onClose,
  inventoryItems,
  selectedWeapon,
  onEquipWeapon,
  recentLootNotification
}) {
  return (
    <>
      {/* Floating Loot Drop Toast Notification */}
      {recentLootNotification && (
        <div
          style={{
            position: 'absolute',
            top: '68px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(20, 16, 8, 0.96), rgba(38, 28, 12, 0.96))',
            border: `1px solid ${recentLootNotification.rarityColor || '#facc15'}`,
            borderRadius: '8px',
            padding: '8px 18px',
            boxShadow: `0 0 24px ${recentLootNotification.rarityColor || '#facc15'}55`,
            zIndex: 24,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'none'
          }}
        >
          <span style={{ fontSize: '18px' }}>✨</span>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: recentLootNotification.rarityColor || '#facc15', letterSpacing: '0.08em' }}>
              {recentLootNotification.tierLabel || 'LEGENDARY RELIC FORGED & DROPPED'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fef9c3' }}>
              {recentLootNotification.name} — Press [I] to Inspect & Equip
            </div>
          </div>
        </div>
      )}

      {/* Baldur's Gate / Diablo Ornate Equipment & Survey Relic Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            background: 'rgba(9, 12, 20, 0.96)',
            backdropFilter: 'blur(14px)',
            border: '2px solid #b45309',
            borderRadius: '12px',
            padding: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.92)',
            zIndex: 35,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: '17px', color: '#fde047', letterSpacing: '0.06em' }}>
                ⚔ SURVEY RELIC VAULT & ARMAMENT INVENTORY [I]
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Click any forged 3D weapon to hot-swap the `.glb` mesh on your character's <code>handslot.r</code> bone and update combat reach & elemental trails.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕ Close Vault [I]
            </button>
          </div>

          {/* Ornate Inventory Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px',
              overflowY: 'auto',
              flex: 1,
              paddingRight: '4px'
            }}
          >
            {(inventoryItems || []).map((item, idx) => {
              const tier = RARITY_TIERS[idx % RARITY_TIERS.length];
              const isEquipped = selectedWeapon?.weapon_id === item.weapon_id;
              const spec = item.procedural_spec || {};
              const reachMeters = spec.blade_length || 1.2;
              const speedRating = spec.archetype === 'RAPIER' ? '1.45x (Fast)' : spec.archetype === 'GREATSWORD' || spec.archetype === 'WARHAMMER' ? '0.95x (Heavy Cleave)' : '1.15x (Balanced)';

              return (
                <div
                  key={item.weapon_id || idx}
                  onClick={() => onEquipWeapon(item)}
                  style={{
                    background: isEquipped
                      ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
                      : 'rgba(13, 18, 30, 0.9)',
                    border: `2px solid ${isEquipped ? '#facc15' : tier.border}`,
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isEquipped ? '0 0 20px rgba(250, 204, 21, 0.25)' : 'none',
                    transition: 'transform 0.12s ease, border-color 0.12s ease'
                  }}
                >
                  <div>
                    {/* Top Rarity & Equipped Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: tier.bg,
                          color: tier.color,
                          letterSpacing: '0.06em'
                        }}
                      >
                        {item.rarity_label || tier.label}
                      </span>
                      {isEquipped && (
                        <span style={{ fontSize: '9px', fontWeight: 'bold', background: '#065f46', color: '#a7f3d0', padding: '2px 6px', borderRadius: '4px' }}>
                          ✓ SOCKETED IN HAND
                        </span>
                      )}
                    </div>

                    {/* 3D Preview Badge & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: `radial-gradient(circle, ${item.shader_color_hex || '#f97316'}44 0%, #090d16 80%)`,
                          border: `1px solid ${item.shader_color_hex || '#f97316'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}
                      >
                        {spec.archetype === 'WARHAMMER' ? '🔨' : spec.archetype === 'SCYTHE' ? '⛏' : spec.archetype === 'RAPIER' ? '🗡' : '⚔'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: item.shader_color_hex || '#f8fafc' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {spec.archetype || 'GREATSWORD'} • {item.element_type || 'FIRE'} ELEMENT
                        </div>
                      </div>
                    </div>

                    {/* Combat Stats Table */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px',
                        background: '#070a12',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #1e293b',
                        fontSize: '10px',
                        marginBottom: '8px'
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b' }}>Base DMG:</span>{' '}
                        <strong style={{ color: '#f87171' }}>{item.base_damage || 75}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Poise Break:</span>{' '}
                        <strong style={{ color: '#fbbf24' }}>{item.poise_damage || 85}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Hitbox Reach:</span>{' '}
                        <strong style={{ color: '#38bdf8' }}>{reachMeters}m</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Swing Speed:</span>{' '}
                        <strong style={{ color: '#a7f3d0' }}>{speedRating}</strong>
                      </div>
                    </div>

                    {/* Psychometric Lore Inscription */}
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#cbd5e1',
                        fontStyle: 'italic',
                        background: 'rgba(15, 23, 42, 0.65)',
                        borderLeft: `2px solid ${item.shader_color_hex || '#38bdf8'}`,
                        padding: '5px 8px',
                        borderRadius: '0 4px 4px 0',
                        lineHeight: 1.35
                      }}
                    >
                      "{item.lore_inscription || `Forged from your psychometric response on ${item.source_question_id || 'campaign trials'} — channels ${item.element_type || 'arcane'} resonance.`}"
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquipWeapon(item);
                    }}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      padding: '6px',
                      background: isEquipped ? '#334155' : 'linear-gradient(135deg, #d97706, #b45309)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {isEquipped ? 'Currently Socketed on RightHand Bone' : '⚡ Equip 3D Mesh into RightHand Bone'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
