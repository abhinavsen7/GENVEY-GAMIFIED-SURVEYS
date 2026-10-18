import React, { useEffect, useRef, useState } from 'react';

export default function DungeonMinimap({
  compiledGame,
  radarStateRef,
  activeRoomIndex,
  onTeleportToRoom
}) {
  const canvasRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const rooms = compiledGame?.rooms && compiledGame.rooms.length > 0
    ? compiledGame.rooms
    : [
        {
          room_id: 'room_1',
          room_index: 0,
          name: 'Sanctum Antechamber',
          width: 16,
          depth: 16,
          offset_x: 0,
          offset_z: -8,
          is_boss_arena: true
        }
      ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const renderRadar = () => {
      animId = requestAnimationFrame(renderRadar);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background panel
      ctx.fillStyle = 'rgba(7, 10, 18, 0.92)';
      ctx.fillRect(0, 0, w, h);

      // Subtle radar grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.32)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gz = 0; gz < h; gz += 20) {
        ctx.beginPath();
        ctx.moveTo(0, gz);
        ctx.lineTo(w, gz);
        ctx.stroke();
      }

      const rState = radarStateRef?.current || {};
      const playerPos = rState.playerPos || { x: 0, z: -3.5 };
      const playerYaw = rState.playerYaw || Math.PI;
      const visitedRooms = rState.visitedRooms || new Set([0]);
      const answeredQuestions = rState.answeredQuestions || new Set();
      const enemies = rState.enemies || [];
      const barrels = rState.barrels || [];
      const gates = rState.gates || [];

      // Compute world Z bounds across all rooms so the entire topological chain fits in the minimap
      const totalDepth = rooms.reduce((acc, r) => acc + (r.depth || 16), 0);
      const padY = 22;
      const usableH = h - padY * 2;
      const scale = Math.min((w - 40) / 24, usableH / Math.max(20, totalDepth));

      // World (x, z) -> Canvas (cx, cy)
      // Note: room_1 starts at z = 0..-16 (bottom of minimap), room_N is at z = -totalDepth (top of minimap)
      const worldToMap = (wx, wz) => {
        const cx = w / 2 + wx * scale;
        const cy = h - padY + wz * scale;
        return [cx, cy];
      };

      // Draw each room in topological order
      rooms.forEach((rm, idx) => {
        const rw = rm.width || 16;
        const rd = rm.depth || 16;
        const ox = rm.offset_x || 0;
        const oz = rm.offset_z !== undefined ? rm.offset_z : -(idx * 16 + 8);

        const [cx, cy] = worldToMap(ox, oz);
        const pw = rw * scale;
        const ph = rd * scale;
        const rx = cx - pw / 2;
        const ry = cy - ph / 2;

        const isCurrent = idx === activeRoomIndex;
        const isVisited = isCurrent || visitedRooms.has(idx);

        // Connecting corridor arch to next room
        if (idx < rooms.length - 1) {
          ctx.fillStyle = isVisited ? 'rgba(71, 85, 105, 0.7)' : 'rgba(30, 41, 59, 0.35)';
          ctx.fillRect(cx - 4, ry - 5, 8, 6);
        }

        // Room Floor Fill (Fog of War for unvisited)
        if (isCurrent) {
          ctx.fillStyle = rm.is_boss_arena ? 'rgba(127, 29, 29, 0.42)' : 'rgba(30, 58, 138, 0.38)';
        } else if (isVisited) {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        }
        ctx.fillRect(rx, ry, pw, ph);

        // Room Border
        if (isCurrent) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.2;
        } else if (isVisited) {
          ctx.strokeStyle = rm.is_boss_arena ? '#a855f7' : '#64748b';
          ctx.lineWidth = 1.3;
        } else {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
          ctx.lineWidth = 1;
        }
        ctx.strokeRect(rx, ry, pw, ph);

        // Room Index Badge
        ctx.fillStyle = isCurrent ? '#fde047' : isVisited ? '#cbd5e1' : '#475569';
        ctx.font = 'bold 9px Inter, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`R${idx + 1}`, rx + 3, ry + 10);

        // Boss Arena Purple Skull Icon
        if (rm.is_boss_arena) {
          ctx.fillStyle = '#c084fc';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('💀', rx + pw - 3, ry + 11);
        }

        // Gold Question Mark (?) for Survey NPC Shrine if not yet answered
        if (rm.npc && !answeredQuestions.has(rm.npc.question_id)) {
          const [nx, ny] = worldToMap(ox + (rm.npc.x || -4.0), oz + (rm.npc.z || 1.5));
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('?', nx, ny + 4);
        }
      });

      // Draw Immersive Sim Chemistry Obstacles (Flammable Barrels & Locked Gates)
      barrels.forEach((b) => {
        if (b.exploded) return;
        const [bx, by] = worldToMap(b.pos.x, b.pos.z);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(bx, by, 3.0, 0, Math.PI * 2);
        ctx.fill();
      });

      gates.forEach((g) => {
        if (g.opened) return;
        const rm = rooms[g.roomIndex];
        if (!rm) return;
        const oz = rm.offset_z !== undefined ? rm.offset_z : -(g.roomIndex * 16 + 8);
        const minZ = oz - (rm.depth || 16) / 2;
        const [gx, gy] = worldToMap(rm.offset_x || 0, minZ);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx - 5, gy);
        ctx.lineTo(gx + 5, gy);
        ctx.stroke();
      });

      // Draw Live Skeleton Enemies (Red Pulsing Dots, disappearing when killed)
      const pulse = 2.6 + Math.sin(performance.now() * 0.008) * 0.9;
      enemies.forEach((en) => {
        if (en.state === 'DEAD') return;
        const [ex, ey] = worldToMap(en.pos.x, en.pos.z);
        ctx.fillStyle = en.isBoss ? '#a855f7' : '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ey, en.isBoss ? pulse + 1.5 : pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Player Cyan Directional Arrow
      const [px, py] = worldToMap(playerPos.x, playerPos.z);
      ctx.save();
      ctx.translate(px, py);
      // Convert 3D yaw into 2D canvas rotation
      ctx.rotate(Math.PI - playerYaw);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.8, 5.2);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.8, 5.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    renderRadar();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [compiledGame, activeRoomIndex, isExpanded]);

  // Click-to-Teleport Handler
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onTeleportToRoom) return;
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const h = canvas.height;
    const padY = 22;

    const totalDepth = rooms.reduce((acc, r) => acc + (r.depth || 16), 0);
    const usableH = h - padY * 2;
    const scale = Math.min((canvas.width - 40) / 24, usableH / Math.max(20, totalDepth));

    // Convert clickY back to world Z
    const clickedWorldZ = (clickY - (h - padY)) / scale;

    for (let idx = 0; idx < rooms.length; idx++) {
      const rm = rooms[idx];
      const rd = rm.depth || 16;
      const oz = rm.offset_z !== undefined ? rm.offset_z : -(idx * 16 + 8);
      if (clickedWorldZ <= oz + rd / 2 && clickedWorldZ >= oz - rd / 2) {
        onTeleportToRoom(idx, rm.offset_x || 0, oz + 2.5);
        return;
      }
    }
  };

  const mapWidth = isExpanded ? 230 : 175;
  const mapHeight = isExpanded ? 310 : 225;

  return (
    <div style={{
      position: 'absolute',
      top: '58px',
      right: '14px',
      background: 'rgba(9, 13, 22, 0.92)',
      border: '1px solid #38bdf866',
      borderRadius: '10px',
      padding: '8px',
      boxShadow: '0 10px 28px rgba(0,0,0,0.75)',
      zIndex: 18,
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.04em' }}>
          🗺 TOPOLOGICAL RADAR
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '4px',
            fontSize: '9px',
            padding: '1px 5px',
            cursor: 'pointer'
          }}
        >
          {isExpanded ? 'Compact' : 'Expand'}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={mapWidth}
        height={mapHeight}
        onClick={handleCanvasClick}
        title="Click any room on the radar to Fast-Travel / Teleport directly to that chamber"
        style={{
          display: 'block',
          borderRadius: '6px',
          border: '1px solid #1e293b',
          cursor: 'pointer'
        }}
      />

      {/* Legend & Fast-Travel Hint */}
      <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '9px', color: '#94a3b8' }}>
        <span><strong style={{ color: '#38bdf8' }}>▲</strong> You</span>
        <span><strong style={{ color: '#facc15' }}>?</strong> Survey NPC</span>
        <span><strong style={{ color: '#f97316' }}>●</strong> Hazard</span>
        <span><strong style={{ color: '#ef4444' }}>●</strong> Enemy</span>
        <span><strong style={{ color: '#c084fc' }}>💀</strong> Boss</span>
      </div>
      <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px', textAlign: 'center' }}>
        Click any room box to Fast-Travel
      </div>
    </div>
  );
}
