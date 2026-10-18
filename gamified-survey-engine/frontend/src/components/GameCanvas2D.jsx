import React, { useEffect, useRef, useState } from 'react';

export default function GameCanvas2D({
  compiledGame,
  selectedWeapon,
  onSelectWeapon,
  sendTelemetry
}) {
  const canvasRef = useRef(null);
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const [playerHP, setPlayerHP] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [estusCharges, setEstusCharges] = useState(3);
  const [apCurrent, setApCurrent] = useState(4);
  const [moveBudgetM, setMoveBudgetM] = useState(8.0);
  const [activeDialogueNPC, setActiveDialogueNPC] = useState(null);
  const [d20RollState, setD20RollState] = useState(null);
  const [covenantModalOpen, setCovenantModalOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [barkToast, setBarkToast] = useState(null);
  const [torchesLit, setTorchesLit] = useState(true);
  const [grabbedPropName, setGrabbedPropName] = useState(null);

  const rooms = compiledGame?.rooms || [];
  const currentRoom = rooms[activeRoomIdx] || rooms[0] || {};
  const styleMode = compiledGame?.style_mode || 'BALDURS_GATE_CRPG';

  const runtimeRef = useRef({
    px: 540,
    py: 460,
    targetX: null,
    targetY: null,
    keys: { w: false, a: false, s: false, d: false },
    facing: 1,
    animState: 'idle',
    attackTimer: 0,
    parryTimer: 0,
    dodgeTimer: 0,
    riposteReady: false,
    lockedEnemyIdx: null,
    torchesLit: true,
    grabbedPropIdx: null,
    vfxBlasts: [],
    enemies: [],
    props: [],
    npc: { x: 260, y: 260, name: 'Chamber Envoy' }
  });

  const showBanner = (msg, ms = 2200) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), ms);
  };

  const showBark = (speaker, line) => {
    setBarkToast({ speaker, line });
    setTimeout(() => setBarkToast(null), 3200);
  };

  // Initialize room entities whenever activeRoomIdx or build_id changes
  useEffect(() => {
    const rt = runtimeRef.current;
    rt.px = 540;
    rt.py = 480;
    rt.targetX = null;
    rt.targetY = null;
    const roomObj = (compiledGame?.rooms || [])[activeRoomIdx] || {};

    rt.enemies = (roomObj.enemies || []).map((en, idx) => ({
      id: en.enemy_id || `en_${idx}`,
      name: en.name || 'Skeleton Sentinel',
      isBoss: Boolean(en.is_boss),
      hp: en.hp || 140,
      maxHp: en.max_hp || en.hp || 140,
      poise: en.poise || 80,
      maxPoise: en.max_poise || 80,
      x: 540 + (idx - 0.5) * 180,
      y: 230 + (idx % 2) * 50,
      spawnX: 540 + (idx - 0.5) * 180,
      spawnY: 230 + (idx % 2) * 50,
      angle: idx * 1.7,
      state: 'PATROL',
      staggerTimer: 0,
      windupTimer: 0,
      questionId: en.question_id || 'q1',
      mappedOption: en.mapped_option || 'Tactical Victory'
    }));

    rt.props = [
      { id: 'barrel_1', name: 'Alchemical Barrel', tag: 'flammable_barrel', x: 760, y: 310, exploded: false, color: '#ef4444' },
      { id: 'shrine_1', name: 'Covenant Relic Shrine', tag: 'loot_shrine', x: 310, y: 340, exploded: false, color: '#f59e0b' },
      { id: 'crate_1', name: 'Ironbound Supply Crate', tag: 'movable_prop', x: 690, y: 420, exploded: false, color: '#38bdf8' }
    ];

    rt.npc = {
      x: 320,
      y: 220,
      data: roomObj.npc || {
        name: 'Envoy of the Guild',
        question_id: 'q1',
        question_text: 'How do you lead your party through an uncharted crisis?',
        choices: [
          { choice_text: 'Decisive Tactical Assault', skill_check: 'Intimidation [DC 15]', dc: 15, skill_name: 'Intimidation', metric_delta: 1.4 },
          { choice_text: 'Calculated Arcane Analysis', skill_check: 'Arcana [DC 14]', dc: 14, skill_name: 'Arcana', metric_delta: 1.2 },
          { choice_text: 'Diplomatic Coalition Accord', skill_check: 'Persuasion [DC 12]', dc: 12, skill_name: 'Persuasion', metric_delta: 1.1 }
        ]
      }
    };
  }, [compiledGame?.build_id, activeRoomIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const spritesCfg = compiledGame?.sprites_2d_config || {};

    const imgFloor = new Image();
    imgFloor.src = spritesCfg.tileset_ground_url || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/floor_1.png';

    const imgWall = new Image();
    imgWall.src = spritesCfg.tileset_wall_url || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wall_mid.png';

    const imgChest = new Image();
    imgChest.src = spritesCfg.chest_url || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/chest_full_open_anim_f0.png';

    const imgPotion = new Image();
    imgPotion.src = spritesCfg.potion_url || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/flask_big_red.png';

    const imgSword = new Image();
    imgSword.src = spritesCfg.weapons_2d?.sword || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_knight_sword.png';

    // 4-frame Animated Sprite arrays from 0x72_DungeonTileset_II
    const knightIdleUrls = spritesCfg.hero_knight?.idle || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_idle_anim_f${i}.png`);
    const knightRunUrls = spritesCfg.hero_knight?.run || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_run_anim_f${i}.png`);
    const knightIdleImgs = knightIdleUrls.map(url => { const img = new Image(); img.src = url; return img; });
    const knightRunImgs = knightRunUrls.map(url => { const img = new Image(); img.src = url; return img; });
    const knightHitImg = new Image();
    knightHitImg.src = spritesCfg.hero_knight?.hit || '/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_hit_anim_f0.png';

    const skelIdleUrls = spritesCfg.enemy_skeleton?.idle || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/skelet_idle_anim_f${i}.png`);
    const skelIdleImgs = skelIdleUrls.map(url => { const img = new Image(); img.src = url; return img; });

    const demonBossUrls = spritesCfg.enemy_boss_demon?.idle || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/big_demon_idle_anim_f${i}.png`);
    const demonBossImgs = demonBossUrls.map(url => { const img = new Image(); img.src = url; return img; });

    const npcUrls = spritesCfg.npc_envoy?.idle || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_f_idle_anim_f${i}.png`);
    const npcImgs = npcUrls.map(url => { const img = new Image(); img.src = url; return img; });

    const coinUrls = spritesCfg.coin_frames || [0, 1, 2, 3].map(i => `/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/coin_anim_f${i}.png`);
    const coinImgs = coinUrls.map(url => { const img = new Image(); img.src = url; return img; });

    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const rt = runtimeRef.current;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        rt.keys[k] = true;
        rt.targetX = null;
        rt.targetY = null;
      } else if (e.code === 'Space') {
        e.preventDefault();
        rt.dodgeTimer = 0.38;
        setStamina(prev => Math.max(0, prev - 18));
      } else if (k === 'e') {
        const distNpc = Math.hypot(rt.px - rt.npc.x, rt.py - rt.npc.y);
        if (distNpc < 140) {
          setActiveDialogueNPC(rt.npc.data);
        } else {
          setCovenantModalOpen(true);
        }
      } else if (k === 'f') {
        setEstusCharges(3);
        setCovenantModalOpen(prev => !prev);
      } else if (k === 'r') {
        setEstusCharges(prev => {
          if (prev <= 0) {
            showBanner('🧪 Estus Empty — Rest at Covenant Shrine [F]');
            return 0;
          }
          setPlayerHP(hp => Math.min(100, hp + 45));
          showBanner('✨ Estus Flask Consumed (+45 HP)');
          return prev - 1;
        });
      } else if (k === 'q') {
        rt.lockedEnemyIdx = rt.lockedEnemyIdx === 0 ? null : 0;
        showBanner(rt.lockedEnemyIdx !== null ? '🎯 Target Lock-On Engaged' : '🎯 Target Lock-On Released', 1400);
      } else if (k === 'g') {
        if (rt.grabbedPropIdx !== null) {
          const pr = rt.props[rt.grabbedPropIdx];
          rt.grabbedPropIdx = null;
          setGrabbedPropName(null);
          showBark('Dungeon Guard', `"Stop rearranging that ${pr?.name || 'prop'}!"`);
        } else {
          const idx = rt.props.findIndex(p => !p.exploded && Math.hypot(p.x - rt.px, p.y - rt.py) < 110);
          if (idx !== -1) {
            rt.grabbedPropIdx = idx;
            setGrabbedPropName(rt.props[idx].name);
            showBark('World Affordance', `Grabbed ${rt.props[idx].name} — Move with WASD & Press [G] to Drop`);
          }
        }
      } else if (e.key === '1') {
        triggerSandboxAffordance('BURN');
      } else if (e.key === '2') {
        triggerSandboxAffordance('LOCKPICK');
      } else if (e.key === '3') {
        rt.torchesLit = !rt.torchesLit;
        setTorchesLit(rt.torchesLit);
        showBark('Watchman', rt.torchesLit ? '"Torches relit!"' : '"Who doused the chamber torches?!"');
      }
    };

    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        runtimeRef.current.keys[k] = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animId = null;
    let lastTime = performance.now();

    const loop = (now) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      const rt = runtimeRef.current;
      const w = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const h = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      // Update Timers
      if (rt.attackTimer > 0) rt.attackTimer -= dt;
      if (rt.parryTimer > 0) rt.parryTimer -= dt;
      if (rt.dodgeTimer > 0) rt.dodgeTimer -= dt;
      setStamina(prev => Math.min(100, prev + dt * 16));

      // Movement
      let vx = 0;
      let vy = 0;
      if (rt.keys.w) vy -= 1;
      if (rt.keys.s) vy += 1;
      if (rt.keys.a) { vx -= 1; rt.facing = -1; }
      if (rt.keys.d) { vx += 1; rt.facing = 1; }

      if (vx === 0 && vy === 0 && rt.targetX !== null && rt.targetY !== null) {
        const dx = rt.targetX - rt.px;
        const dy = rt.targetY - rt.py;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          vx = dx / dist;
          vy = dy / dist;
          rt.facing = vx >= 0 ? 1 : -1;
        } else {
          rt.targetX = null;
          rt.targetY = null;
        }
      }

      const spd = rt.dodgeTimer > 0 ? 390 : 220;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy) || 1;
        rt.px = Math.max(120, Math.min(w - 120, rt.px + (vx / len) * spd * dt));
        rt.py = Math.max(110, Math.min(h - 110, rt.py + (vy / len) * spd * dt));
      }

      if (rt.grabbedPropIdx !== null && rt.props[rt.grabbedPropIdx]) {
        rt.props[rt.grabbedPropIdx].x = rt.px + rt.facing * 42;
        rt.props[rt.grabbedPropIdx].y = rt.py + 12;
      }

      // Draw 2D Retro Dungeon Floor Arena (0x72 DungeonTileset II)
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = rt.torchesLit ? '#090d16' : '#04060b';
      ctx.fillRect(0, 0, w, h);

      const arenaLeft = 90;
      const arenaTop = 80;
      const arenaW = w - 180;
      const arenaH = h - 160;
      const frame = Math.floor((now / 150) % 4);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(arenaLeft, arenaTop, arenaW, arenaH, 12);
      ctx.clip();

      if (imgFloor.complete && imgFloor.naturalWidth > 0) {
        for (let tx = arenaLeft; tx < arenaLeft + arenaW; tx += 48) {
          for (let ty = arenaTop; ty < arenaTop + arenaH; ty += 48) {
            ctx.globalAlpha = rt.torchesLit ? 0.72 : 0.32;
            ctx.drawImage(imgFloor, tx, ty, 48, 48);
          }
        }
      }
      ctx.globalAlpha = 1.0;

      // Subtle dungeon tactical grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = arenaLeft; gx < arenaLeft + arenaW; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, arenaTop);
        ctx.lineTo(gx, arenaTop + arenaH);
        ctx.stroke();
      }
      for (let gy = arenaTop; gy < arenaTop + arenaH; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(arenaLeft, gy);
        ctx.lineTo(arenaLeft + arenaW, gy);
        ctx.stroke();
      }
      ctx.restore();

      // Top Wall Trim from 0x72
      if (imgWall.complete && imgWall.naturalWidth > 0) {
        for (let wx = arenaLeft; wx < arenaLeft + arenaW; wx += 48) {
          ctx.drawImage(imgWall, wx, arenaTop - 28, 48, 48);
        }
      }

      // Arena Border & North Gate Portal
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(arenaLeft, arenaTop, arenaW, arenaH);

      // North Gate Transition Portal
      const gateX = w / 2;
      const gateY = arenaTop + 14;
      ctx.fillStyle = '#38bdf833';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gateX - 70, gateY - 8, 140, 26, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        activeRoomIdx < rooms.length - 1 ? `▲ NORTH PORTAL (Room ${activeRoomIdx + 2})` : '👑 BOSS SANCTUM ALTAR',
        gateX,
        gateY + 9
      );

      if (rt.py < arenaTop + 42 && Math.abs(rt.px - gateX) < 75 && activeRoomIdx < rooms.length - 1) {
        setActiveRoomIdx(prev => Math.min(rooms.length - 1, prev + 1));
      }

      // Draw Interactive 2D Props (Chests, Coins, Potions)
      rt.props.forEach((p) => {
        if (p.exploded) return;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = `${p.color}33`;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (p.tag === 'loot_shrine') {
          if (imgChest.complete && imgChest.naturalWidth > 0) {
            ctx.drawImage(imgChest, -24, -24, 48, 48);
          }
        } else if (p.tag === 'flammable_barrel') {
          if (imgPotion.complete && imgPotion.naturalWidth > 0) {
            ctx.drawImage(imgPotion, -20, -24, 40, 48);
          }
        } else {
          const coinImg = coinImgs[frame];
          if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
            ctx.drawImage(coinImg, -20, -20, 40, 40);
          }
        }

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, 0, -30);
        ctx.restore();
      });

      // Draw Survey NPC with 0x72 Wizard Sprite
      ctx.save();
      ctx.translate(rt.npc.x, rt.npc.y);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      const activeNpc = npcImgs[frame];
      if (activeNpc && activeNpc.complete && activeNpc.naturalWidth > 0) {
        ctx.drawImage(activeNpc, -32, -48, 64, 64);
      }
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`💬 ${rt.npc.data.name} [Press E]`, 0, -48);
      ctx.restore();

      // Update & Draw 2D Enemies (0x72 Skeletons & Boss Demon)
      rt.enemies.forEach((en, idx) => {
        if (en.hp <= 0) return;

        const dist = Math.hypot(rt.px - en.x, rt.py - en.y);
        if (en.staggerTimer > 0) {
          en.staggerTimer -= dt;
        } else if (dist < 260 && dist > 56) {
          const dx = (rt.px - en.x) / dist;
          const dy = (rt.py - en.y) / dist;
          en.x += dx * 85 * dt;
          en.y += dy * 85 * dt;
        } else if (dist <= 56) {
          en.windupTimer += dt;
          if (en.windupTimer >= 1.15) {
            en.windupTimer = 0;
            if (rt.parryTimer > 0) {
              en.staggerTimer = 2.6;
              rt.riposteReady = true;
              showBanner(`⚡ PARRIED ${en.name}! Click LMB for 2.4x CRITICAL RIPOSTE!`);
            } else if (rt.dodgeTimer <= 0) {
              setPlayerHP(hp => Math.max(10, hp - 12));
            }
          }
        } else {
          en.angle += dt * 1.1;
          en.x = en.spawnX + Math.cos(en.angle) * 35;
          en.y = en.spawnY + Math.sin(en.angle) * 22;
        }

        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.fillStyle = en.isBoss ? 'rgba(168, 85, 247, 0.32)' : 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 20, en.isBoss ? 32 : 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        const activeEnImg = en.isBoss ? demonBossImgs[frame] : skelIdleImgs[frame];
        const scale = en.isBoss ? 104 : 64;
        if (activeEnImg && activeEnImg.complete && activeEnImg.naturalWidth > 0) {
          ctx.drawImage(activeEnImg, -scale / 2, -scale / 2 - 10, scale, scale);
        }

        // Lock-On Reticle
        if (rt.lockedEnemyIdx === idx) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Enemy HP Bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-36, -50, 72, 7);
        ctx.fillStyle = en.staggerTimer > 0 ? '#facc15' : '#ef4444';
        ctx.fillRect(-36, -50, 72 * Math.max(0, en.hp / en.maxHp), 7);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${en.isBoss ? '💀 ' : ''}${en.name}`, 0, -56);
        ctx.restore();
      });

      // Draw Player 2D Hero Sprite (0x72 Animated Knight + Weapon Aura)
      ctx.save();
      ctx.translate(rt.px, rt.py);
      const auraColor = selectedWeapon?.shader_color_hex || '#f97316';
      ctx.fillStyle = `${auraColor}44`;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 20, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (rt.parryTimer > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        ctx.stroke();
      }

      const isMoving = (rt.keys.w || rt.keys.a || rt.keys.s || rt.keys.d || rt.targetX !== null);
      let activeHeroImg = knightIdleImgs[frame];
      if (rt.attackTimer > 0 && knightHitImg.complete) {
        activeHeroImg = knightHitImg;
      } else if (isMoving) {
        activeHeroImg = knightRunImgs[frame];
      }

      if (activeHeroImg && activeHeroImg.complete && activeHeroImg.naturalWidth > 0) {
        ctx.save();
        ctx.scale(rt.facing, 1);
        ctx.drawImage(activeHeroImg, -36, -50, 72, 72);
        if (imgSword.complete && imgSword.naturalWidth > 0) {
          ctx.drawImage(imgSword, 6, -26, 32, 32);
        }
        ctx.restore();
      }

      // Weapon Slash Arc on Attack
      if (rt.attackTimer > 0) {
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 52, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`YOU (${selectedWeapon?.name?.slice(0, 18) || 'Hero'})`, 0, -56);
      ctx.restore();

      // Draw Active 2D Spell / Explosion VFX Blasts
      rt.vfxBlasts = rt.vfxBlasts.filter(b => b.life > 0);
      rt.vfxBlasts.forEach((b) => {
        b.life -= dt;
        b.radius += dt * 160;
        ctx.save();
        ctx.strokeStyle = b.color;
        ctx.fillStyle = `${b.color}33`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [compiledGame?.build_id, activeRoomIdx, selectedWeapon]);

  const perform2DAttack = (heavy = false) => {
    const rt = runtimeRef.current;
    rt.attackTimer = heavy ? 0.42 : 0.25;
    setStamina(prev => Math.max(0, prev - (heavy ? 24 : 14)));
    const baseDmg = (selectedWeapon?.base_damage || 68) * (heavy ? 1.45 : 1.0) * (rt.riposteReady ? 2.4 : 1.0);
    rt.riposteReady = false;

    rt.enemies.forEach((en) => {
      if (en.hp <= 0) return;
      if (Math.hypot(en.x - rt.px, en.y - rt.py) <= 105) {
        en.hp = Math.max(0, en.hp - baseDmg);
        if (en.hp <= 0) {
          showBanner(`💀 SLAIN: ${en.name} Defeated!`);
          sendTelemetry('COMBAT_KILL', en.questionId, en.mappedOption, 1.4);
        }
      }
    });
  };

  const triggerSandboxAffordance = (type) => {
    const rt = runtimeRef.current;
    const puz = currentRoom.immersive_sim_puzzle || {};
    const qid = currentRoom.npc?.question_id || 'q1';
    if (type === 'BURN') {
      const barrel = rt.props.find(p => p.tag === 'flammable_barrel' && !p.exploded);
      if (barrel) {
        barrel.exploded = true;
        rt.vfxBlasts.push({ x: barrel.x, y: barrel.y, radius: 18, life: 0.55, color: '#ef4444' });
        rt.enemies.forEach(en => { en.hp = Math.max(0, en.hp - 95); });
      }
      const opt = puz.flammable_barrel?.maps_to_option || 'Alchemical Ignition';
      showBark('Guard Captain', '"The oil barrel just exploded! Sound the alarm!"');
      sendTelemetry('SANDBOX_AFFORDANCE', qid, opt, 1.35);
    } else if (type === 'LOCKPICK') {
      const opt = puz.locked_gate?.maps_to_option || 'Stealth Lockpick';
      showBark('Sanctum Warden', '"The north gate lock has been picked!"');
      sendTelemetry('SANDBOX_AFFORDANCE', qid, opt, 1.25);
      if (activeRoomIdx < rooms.length - 1) setActiveRoomIdx(prev => prev + 1);
    }
  };

  const cast2DAbility = (ab) => {
    const rt = runtimeRef.current;
    if (apCurrent < (ab.ap_cost || 1)) {
      showBanner('⚠ Insufficient AP — Click [End Turn] to Restore 4 AP');
      return;
    }
    setApCurrent(prev => Math.max(0, prev - (ab.ap_cost || 1)));
    rt.vfxBlasts.push({ x: rt.px, y: rt.py - 30, radius: 16, life: 0.5, color: ab.color || '#38bdf8' });
    if (ab.heal) {
      setPlayerHP(hp => Math.min(100, hp + ab.heal));
      showBanner(`✨ ${ab.name}: +${ab.heal} HP!`);
      return;
    }
    if (ab.move_bonus_m) {
      setMoveBudgetM(m => m + ab.move_bonus_m);
      showBanner(`💨 ${ab.name}: +${ab.move_bonus_m}m Movement!`);
      return;
    }
    const dmg = ab.damage || 52;
    rt.enemies.forEach(en => {
      if (en.hp > 0) {
        en.hp = Math.max(0, en.hp - dmg);
        if (en.hp <= 0) sendTelemetry('COMBAT_KILL', en.questionId, en.mappedOption, 1.45);
      }
    });
    showBanner(`${ab.icon || '⚔️'} Cast ${ab.name} (${dmg} DMG)!`);
  };

  const roll2DD20Choice = (ch, idx, npcObj) => {
    const dc = ch.dc || 12;
    const skill = ch.skill_name || 'Persuasion';
    setD20RollState({ rolling: true, value: 15, dc, skill });
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      setD20RollState({ rolling: ticks < 9, value: Math.floor(Math.random() * 20) + 1, dc, skill });
      if (ticks >= 9) {
        clearInterval(timer);
        const finalRoll = Math.max(dc, Math.floor(Math.random() * 8) + 13);
        setD20RollState({ rolling: false, value: finalRoll, dc, skill });
        setTimeout(() => {
          sendTelemetry('D20_DIALOGUE', npcObj.question_id || 'q1', ch.choice_text, ch.metric_delta || 1.3);
          if (ch.grants_weapon_id && compiledGame?.weapons && onSelectWeapon) {
            const w = compiledGame.weapons.find(x => x.weapon_id === ch.grants_weapon_id);
            if (w) onSelectWeapon(w);
          }
          setD20RollState(null);
          setActiveDialogueNPC(null);
          showBanner(`🎲 D20 ${skill} [${finalRoll} vs DC ${dc}] Success — Survey Recorded!`);
        }, 950);
      }
    }, 65);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#070a12' }}>
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          if (styleMode === 'BALDURS_GATE_CRPG' && !e.shiftKey) {
            runtimeRef.current.targetX = cx;
            runtimeRef.current.targetY = cy;
          } else {
            perform2DAttack(e.shiftKey);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          runtimeRef.current.parryTimer = 0.26;
          showBanner('🛡 Shield Parry Active (200ms Window)', 1100);
        }}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      />

      {/* Top-Left 2D Player HUD */}
      <div style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        background: 'rgba(11, 16, 29, 0.90)',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '10px 14px',
        minWidth: '340px',
        zIndex: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: compiledGame?.is_custom_genre ? '#f472b6' : '#34d399', marginBottom: '4px' }}>
          <span>2D ENGINE ({compiledGame?.custom_genre || compiledGame?.style_mode || 'ISOMETRIC'}) • CHAMBER {activeRoomIdx + 1}/{rooms.length || 1}</span>
          <span style={{ color: '#facc15' }}>🧪 Estus [R]: {estusCharges}/3</span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
          {currentRoom.name || compiledGame?.campaign_title || '2D Sanctum'}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
          <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${playerHP}%`, height: '100%', background: '#ef4444' }} />
          </div>
          <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${stamina}%`, height: '100%', background: '#22c55e' }} />
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span>[WASD/Click] Move</span>
          <span>• [LMB] Attack</span>
          <span>• [RMB] Parry</span>
          <span>• [E] Parley</span>
          <span>• [G] {grabbedPropName ? `Drop ${grabbedPropName}` : 'Grab Prop'}</span>
          <span>• [F] Shrine</span>
        </div>
      </div>

      {statusBanner && (
        <div style={{
          position: 'absolute',
          top: '86px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #facc15',
          color: '#fef08a',
          padding: '7px 18px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          zIndex: 22
        }}>
          {statusBanner}
        </div>
      )}

      {barkToast && (
        <div style={{
          position: 'absolute',
          top: '130px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 13, 24, 0.95)',
          border: '1px solid #38bdf8',
          color: '#f8fafc',
          padding: '8px 16px',
          borderRadius: '10px',
          fontSize: '11.5px',
          zIndex: 22
        }}>
          <strong style={{ color: '#38bdf8' }}>{barkToast.speaker}:</strong> {barkToast.line}
        </div>
      )}

      {/* Bottom-Center 5-Ability Action Bar */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(9, 13, 24, 0.94)',
        border: compiledGame?.is_custom_genre ? '1px solid #ec4899' : '1px solid #6366f1',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 16
      }}>
        <div style={{ paddingRight: '10px', borderRight: '1px solid #334155', fontSize: '10px', color: '#cbd5e1' }}>
          <div style={{ fontWeight: 800, color: compiledGame?.is_custom_genre ? '#f472b6' : '#818cf8' }}>AP: {apCurrent}/4</div>
          <div style={{ color: '#34d399' }}>Move: {moveBudgetM.toFixed(1)}m</div>
        </div>
        {(compiledGame?.custom_mechanics?.custom_hotbar || compiledGame?.mechanics_spec?.crpg_abilities || [
          { id: 'cleave', name: 'Main Hand Cleave', ap_cost: 1, damage: 38, color: '#f97316', icon: '⚔️' },
          { id: 'fireball', name: 'Fireball AoE', ap_cost: 2, damage: 64, color: '#ef4444', icon: '🔥' },
          { id: 'frost_nova', name: 'Frost Nova', ap_cost: 2, damage: 48, color: '#38bdf8', icon: '❄️' },
          { id: 'healing_word', name: 'Healing Word', ap_cost: 1, heal: 45, color: '#22c55e', icon: '✨' },
          { id: 'tactical_dash', name: 'Tactical Dash', ap_cost: 1, move_bonus_m: 6.0, color: '#a855f7', icon: '💨' }
        ]).map((ab) => (
          <button
            key={ab.id}
            onClick={() => cast2DAbility(ab)}
            style={{
              background: '#1e293b',
              border: `1px solid ${ab.color || '#6366f1'}`,
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#f8fafc',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {ab.icon || '⚡'} {ab.name} ({ab.ap_cost || 1} AP)
          </button>
        ))}
        <button
          onClick={() => { setApCurrent(4); setMoveBudgetM(8.0); showBanner('🎲 Turn Reset: 4 AP Restored'); }}
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          ⏳ End Turn
        </button>
      </div>

      {/* 2D D20 Dialogue Modal */}
      {activeDialogueNPC && (
        <div style={{
          position: 'absolute',
          bottom: '84px',
          left: '24px',
          right: '24px',
          background: 'rgba(11, 16, 29, 0.96)',
          border: '1px solid #38bdf8',
          borderRadius: '12px',
          padding: '16px',
          zIndex: 28
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
              {activeDialogueNPC.name} • 🎲 D20 Skill Check
            </span>
            <button onClick={() => setActiveDialogueNPC(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ fontSize: '13px', color: '#f8fafc', marginBottom: '12px', fontStyle: 'italic' }}>
            "{activeDialogueNPC.question_text}"
          </div>
          {d20RollState && (
            <div style={{ padding: '8px 12px', background: '#090d16', border: '1px solid #a855f7', borderRadius: '8px', marginBottom: '10px', color: '#e9d5ff', fontWeight: 800 }}>
              🎲 D20 ({d20RollState.skill} vs DC {d20RollState.dc}): {d20RollState.value} {d20RollState.rolling ? '...' : '✔ SUCCESS!'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(activeDialogueNPC.choices || []).map((ch, idx) => (
              <button
                key={idx}
                onClick={() => roll2DD20Choice(ch, idx, activeDialogueNPC)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>{idx + 1}. {ch.choice_text}</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>🎲 {ch.skill_check || 'Persuasion [DC 12]'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Covenant Shrine Modal */}
      {covenantModalOpen && currentRoom.npc && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7, 10, 18, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 29
        }}>
          <div style={{ width: '500px', background: '#0f172a', border: '1px solid #f59e0b', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>🔥 BONFIRE COVENANT SHRINE</span>
              <button onClick={() => setCovenantModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '14px', color: '#f8fafc', marginBottom: '12px' }}>"{currentRoom.npc.question_text}"</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(currentRoom.npc.choices || []).map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setEstusCharges(3);
                    sendTelemetry('COVENANT_SHRINE', currentRoom.npc.question_id || 'q1', ch.choice_text, ch.metric_delta || 1.3);
                    setCovenantModalOpen(false);
                    showBanner(`🔥 Covenant Pledged: ${ch.choice_text}`);
                  }}
                  style={{ textAlign: 'left', padding: '10px 12px', background: '#1e293b', border: '1px solid #f59e0b66', borderRadius: '8px', color: '#f8fafc', cursor: 'pointer' }}
                >
                  <strong style={{ color: '#fbbf24' }}>Vow {idx + 1}:</strong> {ch.choice_text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
