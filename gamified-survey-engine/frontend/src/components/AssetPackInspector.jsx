import React, { useState, useEffect } from 'react';

const CATEGORY_META = {
  characters: { label: 'Characters & Outfits', icon: '🛡️', color: '#38bdf8' },
  enemies: { label: 'Enemies & Bosses', icon: '💀', color: '#f43f5e' },
  weapons: { label: '3D Weapons & Loot', icon: '⚔️', color: '#f59e0b' },
  environment: { label: 'Modular Castle Kit', icon: '🏰', color: '#10b981' },
  animations: { label: 'Universal Anim Libraries', icon: '🎞️', color: '#a855f7' },
  effects: { label: 'BattleFX & Shaders', icon: '✨', color: '#ec4899' }
};

export default function AssetPackInspector({ backendUrl = 'http://localhost:8000' }) {
  const [registry, setRegistry] = useState(null);
  const [activeCategory, setActiveCategory] = useState('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetch(`${backendUrl}/api/custom-assets`)
      .then((r) => r.json())
      .then((data) => {
        setRegistry(data);
        if (data?.characters?.length > 0) {
          setSelectedItem(data.characters[0]);
        }
      })
      .catch((err) => console.error('Failed to load custom_asset_packs registry:', err));
  }, [backendUrl]);

  if (!registry) {
    return (
      <div style={{ padding: '32px', color: '#94a3b8', fontFamily: 'Inter, system-ui, sans-serif' }}>
        Loading <code>custom_asset_packs/asset_registry.json</code>...
      </div>
    );
  }

  const totalAssets = Object.values(registry).reduce(
    (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  const items = (registry[activeCategory] || []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.id && item.id.toLowerCase().includes(q)) ||
      (item.pack && item.pack.toLowerCase().includes(q)) ||
      (item.url && item.url.toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#07090e',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* Top Summary Header */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid #1e293b',
          background: 'linear-gradient(90deg, rgba(15,23,42,0.95), rgba(30,27,75,0.85))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: '#10b98122',
                border: '1px solid #10b981',
                color: '#34d399',
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '999px',
                letterSpacing: '0.08em'
              }}
            >
              100% EXCLUSIVE SOURCE
            </span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
              Custom Asset Pack Inspector (<code>custom_asset_packs/asset_registry.json</code>)
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Indexed via Headless Blender <code>bpy</code> — {totalAssets} verified 3D models, skeletal rigs, mocap animation libraries, and BattleFX shaders.
          </p>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter models, bones, or packs..."
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#f8fafc',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            minWidth: '240px'
          }}
        />
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px',
          borderBottom: '1px solid #1e293b',
          background: '#0b0f19',
          overflowX: 'auto'
        }}
      >
        {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
          const count = (registry[catKey] || []).length;
          const isActive = activeCategory === catKey;
          return (
            <button
              key={catKey}
              onClick={() => {
                setActiveCategory(catKey);
                if (registry[catKey]?.length > 0) {
                  setSelectedItem(registry[catKey][0]);
                }
              }}
              style={{
                background: isActive ? `${meta.color}22` : '#111827',
                border: isActive ? `1px solid ${meta.color}` : '1px solid #1e293b',
                color: isActive ? '#ffffff' : '#94a3b8',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span
                style={{
                  background: isActive ? meta.color : '#1e293b',
                  color: isActive ? '#090a0f' : '#cbd5e1',
                  padding: '1px 7px',
                  borderRadius: '99px',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Split View: Asset Grid + Deep Metadata Drawer */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Grid */}
        <div
          style={{
            flex: 1,
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px',
            alignContent: 'start'
          }}
        >
          {items.map((item, idx) => {
            const isSelected = selectedItem?.url === item.url;
            const meta = CATEGORY_META[activeCategory] || CATEGORY_META.characters;
            return (
              <div
                key={`${item.id}_${idx}`}
                onClick={() => setSelectedItem(item)}
                style={{
                  background: isSelected ? '#172554' : '#0f172a',
                  border: isSelected ? `1px solid ${meta.color}` : '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '13px', color: '#f8fafc' }}>{item.id}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#1e293b',
                      color: meta.color,
                      fontWeight: 700
                    }}
                  >
                    {item.type || (item.has_skeleton ? `${item.bones_count} Bones` : '3D GLB')}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  {item.pack || 'Custom Asset Pack'}
                </div>

                {item.dimensions && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '10px', color: '#94a3b8' }}>
                    <span style={{ background: '#090d16', padding: '2px 6px', borderRadius: '4px' }}>
                      Bounds: {item.dimensions.join('×')}m
                    </span>
                    {item.right_hand_bone && (
                      <span style={{ background: '#090d16', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>
                        Socket: {item.right_hand_bone}
                      </span>
                    )}
                    {item.animations && item.animations.length > 0 && (
                      <span style={{ background: '#090d16', padding: '2px 6px', borderRadius: '4px', color: '#a855f7' }}>
                        {item.animations.length} Clips
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Deep Inspector Panel */}
        {selectedItem && (
          <div
            style={{
              width: '390px',
              borderLeft: '1px solid #1e293b',
              background: '#0b0f19',
              padding: '20px',
              overflowY: 'auto'
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#38bdf8', fontWeight: 800 }}>
              Deep Blender BPY Inspection
            </div>
            <h3 style={{ margin: '6px 0 4px 0', fontSize: '18px', color: '#f8fafc' }}>{selectedItem.id}</h3>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>{selectedItem.pack}</div>

            <div
              style={{
                background: '#07090e',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#34d399',
                wordBreak: 'break-all',
                marginBottom: '16px'
              }}
            >
              {selectedItem.url}
            </div>

            {selectedItem.dimensions && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  3D Bounding Box & Ground Snapping
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div style={{ background: '#111827', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Dimensions (W×D×H)</div>
                    <div style={{ fontWeight: 700 }}>{selectedItem.dimensions.join('m × ')}m</div>
                  </div>
                  <div style={{ background: '#111827', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Ground Offset Y</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{selectedItem.ground_offset_y}m</div>
                  </div>
                  {selectedItem.right_hand_bone && (
                    <div style={{ background: '#111827', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#64748b', fontSize: '10px' }}>Right Hand Socket</div>
                      <div style={{ fontWeight: 700, color: '#38bdf8' }}>{selectedItem.right_hand_bone}</div>
                    </div>
                  )}
                  <div style={{ background: '#111827', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Skeleton Bones</div>
                    <div style={{ fontWeight: 700 }}>{selectedItem.bones_count || 0}</div>
                  </div>
                </div>
              </div>
            )}

            {selectedItem.animations && selectedItem.animations.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                  Animation Clips ({selectedItem.animations.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '220px', overflowY: 'auto' }}>
                  {selectedItem.animations.map((animName) => (
                    <span
                      key={animName}
                      style={{
                        fontSize: '10px',
                        background: '#1e1b4b',
                        border: '1px solid #4338ca',
                        color: '#c7d2fe',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {animName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedItem.skeleton_bones && selectedItem.skeleton_bones.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                  Skeleton Hierarchy Sample ({selectedItem.skeleton_bones.length} of {selectedItem.bones_count} bones)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {selectedItem.skeleton_bones.map((boneName) => (
                    <span
                      key={boneName}
                      style={{
                        fontSize: '10px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#94a3b8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}
                    >
                      {boneName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
