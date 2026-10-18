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
  const [playerGold, setPlayerGold] = useState(compiledGame?.starting_gold || 0);

  // Turn-based combat states
  const [turnPhase, setTurnPhase] = useState('PLAYER_TURN'); // 'PLAYER_TURN' | 'ENEMY_TURN'
  const [apCurrent, setApCurrent] = useState(4);
  const [moveBudgetM, setMoveBudgetM] = useState(8.0);

  // Modals & Interactivity
  const [activeDialogueNPC, setActiveDialogueNPC] = useState(null);
  const [d20RollState, setD20RollState] = useState(null);
  const [activeForgeProp, setActiveForgeProp] = useState(null);
  const [covenantModalOpen, setCovenantModalOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [barkToast, setBarkToast] = useState(null);
  const [torchesLit, setTorchesLit] = useState(true);
  const [grabbedPropName, setGrabbedPropName] = useState(null);

  // Objective Tracking
  const [completedObjectives, setCompletedObjectives] = useState(new Set());
  const [slainCount, setSlainCount] = useState(0);

  const rooms = compiledGame?.rooms || [];
  const currentRoom = rooms[activeRoomIdx] || rooms[0] || {};
  const styleMode = compiledGame?.style_mode || 'BALDURS_GATE_CRPG';
  const customGenre = compiledGame?.custom_genre || '';

  // Distinguish genuine turn-based combat vs real-time action
  const isTurnBased = Boolean(
    styleMode === 'BALDURS_GATE_CRPG' ||
    /turn|tactical|tactics|crpg|strategy/i.test(customGenre) ||
    /turn|tactical|tactics|crpg|strategy/i.test(styleMode)
  );

  const runtimeRef = useRef({
    px: 540,
    py: 480,
    targetX: null,
    targetY: null,
    keys: { w: false, a: false, s: false, d: false },
    facing: 1,
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
    npc: { x: 320, y: 240, name: 'Chamber Envoy', data: {} }
  });

  const showBanner = (msg, ms = 2400) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), ms);
  };

  const showBark = (speaker, line) => {
    setBarkToast({ speaker, line });
    setTimeout(() => setBarkToast(null), 3400);
  };

  // Initialize room entities whenever activeRoomIdx or build_id changes
  useEffect(() => {
    const rt = runtimeRef.current;
    rt.px = 540;
    rt.py = 480;
    rt.targetX = null;
    rt.targetY = null;
    setSlainCount(0);
    setTurnPhase('PLAYER_TURN');
    setApCurrent(4);
    setMoveBudgetM(8.0);

    const roomObj = (compiledGame?.rooms || [])[activeRoomIdx] || {};

    // 1. Initialize Enemies
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

    // 2. Initialize Props dynamically from roomObj.props
    const rawProps = roomObj.props || [];
    if (rawProps.length > 0) {
      rt.props = rawProps.map((p, pIdx) => {
        const tag = p.interactive_tag || 'movable_prop';
        const cost = p.cost_gold || (p.prop_id?.includes('10') ? 10 : (p.prop_id?.includes('2') ? 2 : 0));
        const px = 540 + (p.x !== undefined ? p.x * 46 : (pIdx - 1) * 160);
        const py = 360 + (p.z !== undefined ? p.z * 38 : (pIdx % 2) * 60);

        let color = '#38bdf8';
        if (tag === 'survey_forge') color = cost === 10 ? '#f59e0b' : '#38bdf8';
        else if (tag === 'treasure_chest') color = '#eab308';
        else if (tag === 'mechanical_lever') color = '#a855f7';
        else if (tag === 'flammable_barrel') color = '#ef4444';
        else if (tag === 'loot_shrine') color = '#f59e0b';

        return {
          id: p.prop_id || `prop_${pIdx}`,
          name: p.tier_name || p.label || p.asset || 'Dungeon Prop',
          tag,
          x: Math.max(140, Math.min(940, px)),
          y: Math.max(160, Math.min(520, py)),
          exploded: false,
          opened: false,
          pulled: false,
          cost_gold: cost,
          tier_name: p.tier_name,
          gold_reward: p.gold_reward || 10,
          color
        };
      });
    } else {
      // Fallback zone-themed props
      if (activeRoomIdx === 0) {
        rt.props = [
          { id: 'forge_sovereign_10', name: 'Sovereign Forge ($10)', tag: 'survey_forge', cost_gold: 10, tier_name: 'Sovereign Tier ($10)', x: 300, y: 380, exploded: false, color: '#f59e0b' },
          { id: 'forge_starter_2', name: 'Starter Forge ($2)', tag: 'survey_forge', cost_gold: 2, tier_name: 'Adventurer Tier ($2)', x: 780, y: 380, exploded: false, color: '#38bdf8' },
          { id: 'barrel_r1', name: 'Alchemical Barrel', tag: 'flammable_barrel', x: 720, y: 260, exploded: false, color: '#ef4444' }
        ];
      } else if (activeRoomIdx === 1) {
        rt.props = [
          { id: 'lever_zone2', name: 'Mechanical Bronze Lever', tag: 'mechanical_lever', x: 780, y: 280, pulled: false, color: '#a855f7' },
          { id: 'chest_catacombs', name: 'Treasure Chest (+10 Gold)', tag: 'treasure_chest', gold_reward: 10, opened: false, x: 300, y: 380, color: '#eab308' },
          { id: 'barrel_r2', name: 'Alchemical Barrel', tag: 'flammable_barrel', x: 540, y: 300, exploded: false, color: '#ef4444' }
        ];
      } else if (activeRoomIdx === 2) {
        rt.props = [
          { id: 'chest_sanctum', name: 'Treasure Chest (+10 Gold)', tag: 'treasure_chest', gold_reward: 10, opened: false, x: 780, y: 380, color: '#eab308' },
          { id: 'shrine_sanctum', name: 'Covenant Relic Shrine', tag: 'loot_shrine', x: 300, y: 380, exploded: false, color: '#f59e0b' }
        ];
      } else {
        rt.props = [
          { id: 'boss_altar', name: 'Boss Crystal Shrine', tag: 'loot_shrine', x: 540, y: 240, exploded: false, color: '#a855f7' }
        ];
      }
    }

    // 3. Initialize NPC strictly bound to company's survey intent (NO "uncharted crisis" filler)
    const companyName = compiledGame?.company_name || 'The Studio';
    const surveyIntent = compiledGame?.survey_intent || '';
    const surveyQuestions = compiledGame?.survey_questions || [];
    const roomSurveyQ = surveyQuestions[activeRoomIdx] || surveyQuestions[0];

    let npcName = roomObj.npc?.name || `Envoy of ${companyName}`;
    let npcQuestionText = roomObj.npc?.question_text;
    let npcChoices = roomObj.npc?.choices;

    if (!npcQuestionText || npcQuestionText.includes('uncharted crisis')) {
      if (roomSurveyQ?.question_text && !roomSurveyQ.question_text.includes('uncharted crisis')) {
        npcQuestionText = roomSurveyQ.question_text;
        npcChoices = (roomSurveyQ.options || []).map((opt, i) => ({
          choice_text: opt,
          skill_check: ['Persuasion [DC 12]', 'Arcana [DC 14]', 'Intimidation [DC 15]', 'Insight [DC 11]'][i % 4],
          dc: [12, 14, 15, 11][i % 4],
          skill_name: ['Persuasion', 'Arcana', 'Intimidation', 'Insight'][i % 4],
          metric_delta: 1.3
        }));
      } else if (surveyIntent) {
        npcQuestionText = `Regarding ${companyName}'s strategic survey: "${surveyIntent}" — Which tier or feature best reflects your preference?`;
        npcChoices = [
          { choice_text: 'Sovereign Tier ($10/mo - Full Access, Priority & Status)', skill_check: 'Persuasion [DC 12]', dc: 12, skill_name: 'Persuasion', metric_delta: 1.5 },
          { choice_text: 'Adventurer Tier ($2/mo - Core Functional Utility)', skill_check: 'Arcana [DC 14]', dc: 14, skill_name: 'Arcana', metric_delta: 1.2 },
          { choice_text: 'Community Tier ($0 - Free Baseline Experience)', skill_check: 'Insight [DC 11]', dc: 11, skill_name: 'Insight', metric_delta: 1.0 }
        ];
      } else {
        npcQuestionText = `What strategic product capability should ${companyName} prioritize for your cohort?`;
        npcChoices = [
          { choice_text: 'High-performance automated AI intelligence', skill_check: 'Arcana [DC 14]', dc: 14, skill_name: 'Arcana', metric_delta: 1.3 },
          { choice_text: 'Modular customizable workflow integration', skill_check: 'Persuasion [DC 12]', dc: 12, skill_name: 'Persuasion', metric_delta: 1.2 },
          { choice_text: 'Zero-latency streamlined user experience', skill_check: 'Intimidation [DC 15]', dc: 15, skill_name: 'Intimidation', metric_delta: 1.1 }
        ];
      }
    }

    rt.npc = {
      x: 320,
      y: 230,
      data: {
        npc_id: roomObj.npc?.npc_id || `npc_r${activeRoomIdx + 1}`,
        name: npcName,
        question_id: roomObj.npc?.question_id || roomSurveyQ?.id || `q_r${activeRoomIdx + 1}`,
        question_text: npcQuestionText,
        choices: npcChoices
      }
    };
  }, [compiledGame?.build_id, activeRoomIdx]);

  // Main Canvas Render & Physics Loop
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
        if (isTurnBased) {
          // In turn-based mode, space casts cleave or passes
          perform2DAttack(false);
        } else {
          // In real-time mode, space performs real-time melee strike
          perform2DAttack(false);
        }
      } else if (k === 'e') {
        // [E] Physical Interaction check (NPC, Forge Anvil, Chest, Lever, Barrel)
        const distNpc = Math.hypot(rt.px - rt.npc.x, rt.py - rt.npc.y);
        if (distNpc < 130) {
          setActiveDialogueNPC(rt.npc.data);
          return;
        }

        // Find closest prop within interaction radius
        let closestProp = null;
        let minDist = 110;
        rt.props.forEach((p) => {
          if (p.exploded) return;
          const d = Math.hypot(p.x - rt.px, p.y - rt.py);
          if (d < minDist) {
            minDist = d;
            closestProp = p;
          }
        });

        if (closestProp) {
          handlePropInteract(closestProp);
        } else {
          showBanner('No interactive object nearby (walk closer to NPC, Chest, Forge, or Lever)');
        }
      } else if (k === 'r') {
        // Heal Flask
        setEstusCharges(prev => {
          if (prev <= 0) {
            showBanner('🧪 Healing Flasks Empty — Rest at Shrine or Advance [F]');
            return 0;
          }
          setPlayerHP(hp => Math.min(100, hp + 45));
          showBanner('✨ Estus Consumed (+45 HP)');
          return prev - 1;
        });
      } else if (k === '1') {
        // [1] Fireball Spell / Barrel Ignition
        triggerFireballOrIgnite();
      } else if (k === 'f') {
        setCovenantModalOpen(prev => !prev);
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
            showBark('Affordance', `Grabbed ${rt.props[idx].name} — Move with WASD & Press [G] to Drop`);
          }
        }
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

      // Player Movement Logic
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

      // In turn-based mode, check movement budget during PLAYER_TURN
      const isMoving = (vx !== 0 || vy !== 0);
      if (isMoving) {
        if (isTurnBased) {
          if (turnPhase !== 'PLAYER_TURN') {
            // Cannot move during enemy turn
            vx = 0;
            vy = 0;
          } else if (moveBudgetM <= 0.05) {
            vx = 0;
            vy = 0;
            showBanner('⚠ Movement budget depleted (0.0m)! Cast Dash (+6m) or Click [End Turn]', 900);
          } else {
            const spd = 220;
            const len = Math.hypot(vx, vy) || 1;
            const distPx = spd * dt;
            const distM = distPx / 35;
            setMoveBudgetM(prev => Math.max(0, prev - distM));
            rt.px = Math.max(120, Math.min(w - 120, rt.px + (vx / len) * distPx));
            rt.py = Math.max(110, Math.min(h - 110, rt.py + (vy / len) * distPx));
          }
        } else {
          // Real-time movement
          const spd = rt.dodgeTimer > 0 ? 380 : 220;
          const len = Math.hypot(vx, vy) || 1;
          rt.px = Math.max(120, Math.min(w - 120, rt.px + (vx / len) * spd * dt));
          rt.py = Math.max(110, Math.min(h - 110, rt.py + (vy / len) * spd * dt));
        }
      }

      if (rt.grabbedPropIdx !== null && rt.props[rt.grabbedPropIdx]) {
        rt.props[rt.grabbedPropIdx].x = rt.px + rt.facing * 42;
        rt.props[rt.grabbedPropIdx].y = rt.py + 12;
      }

      // Background & Arena Grid
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

      // Dungeon grid lines
      ctx.strokeStyle = isTurnBased ? 'rgba(99, 102, 241, 0.14)' : 'rgba(56, 189, 248, 0.08)';
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

      // Top Wall Trim
      if (imgWall.complete && imgWall.naturalWidth > 0) {
        for (let wx = arenaLeft; wx < arenaLeft + arenaW; wx += 48) {
          ctx.drawImage(imgWall, wx, arenaTop - 28, 48, 48);
        }
      }

      // Arena Outer Border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(arenaLeft, arenaTop, arenaW, arenaH);

      // North Gate Transition Portal
      const gateX = w / 2;
      const gateY = arenaTop + 14;
      const isBossRoom = activeRoomIdx >= rooms.length - 1;

      // Check if gate is locked by an unpulled lever
      const hasUnpulledLever = rt.props.some(p => p.tag === 'mechanical_lever' && !p.pulled);
      const gateLocked = hasUnpulledLever && !completedObjectives.has(`lever_r${activeRoomIdx}`);

      ctx.fillStyle = gateLocked ? 'rgba(239, 68, 68, 0.22)' : 'rgba(56, 189, 248, 0.22)';
      ctx.strokeStyle = gateLocked ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gateX - 90, gateY - 8, 180, 26, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = gateLocked ? '#fca5a5' : '#e0f2fe';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        gateLocked
          ? '🔒 PORTCULLIS LOCKED (Pull Lever [E])'
          : (!isBossRoom ? `▲ NORTH PORTAL (Zone ${activeRoomIdx + 2})` : '👑 BOSS SANCTUM ALTAR'),
        gateX,
        gateY + 9
      );

      // North Portal Step-through
      if (rt.py < arenaTop + 42 && Math.abs(rt.px - gateX) < 85) {
        if (gateLocked) {
          showBanner('🔒 The Portcullis is locked! Pull the Bronze Lever [E] first.', 1200);
          rt.py = arenaTop + 55;
        } else if (!isBossRoom) {
          setActiveRoomIdx(prev => prev + 1);
          showBanner(`🚪 Entering Zone ${activeRoomIdx + 2}...`);
        }
      }

      // Render Interactive Props (Forge Anvils, Chests, Levers, Barrels)
      rt.props.forEach((p) => {
        if (p.exploded) return;
        ctx.save();
        ctx.translate(p.x, p.y);

        const distToPlayer = Math.hypot(p.x - rt.px, p.y - rt.py);
        const isNear = distToPlayer < 95;

        // Interactive Highlight Aura
        ctx.fillStyle = isNear ? `${p.color}55` : `${p.color}22`;
        ctx.strokeStyle = isNear ? '#ffffff' : p.color;
        ctx.lineWidth = isNear ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (p.tag === 'treasure_chest' || p.tag === 'loot_shrine') {
          if (imgChest.complete && imgChest.naturalWidth > 0) {
            ctx.globalAlpha = p.opened ? 0.45 : 1.0;
            ctx.drawImage(imgChest, -24, -24, 48, 48);
            ctx.globalAlpha = 1.0;
          }
        } else if (p.tag === 'flammable_barrel') {
          if (imgPotion.complete && imgPotion.naturalWidth > 0) {
            ctx.drawImage(imgPotion, -20, -24, 40, 48);
          }
        } else if (p.tag === 'survey_forge') {
          // Draw Anvil / Gold Emblem
          const coinImg = coinImgs[frame];
          if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
            ctx.drawImage(coinImg, -20, -20, 40, 40);
          }
        } else {
          // Lever or generic prop
          ctx.fillStyle = p.pulled ? '#22c55e' : p.color;
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.tag === 'mechanical_lever' ? '⚙️' : '📦', 0, 8);
        }

        // Prop Label
        ctx.fillStyle = isNear ? '#fef08a' : '#f8fafc';
        ctx.font = isNear ? 'bold 12px Inter, sans-serif' : 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${p.name} ${isNear ? '[Press E]' : ''}`,
          0,
          -34
        );
        ctx.restore();
      });

      // Render Survey NPC (Wizard Sprite)
      ctx.save();
      ctx.translate(rt.npc.x, rt.npc.y);
      const distNpc = Math.hypot(rt.px - rt.npc.x, rt.py - rt.npc.y);
      const isNearNpc = distNpc < 130;

      ctx.fillStyle = isNearNpc ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      const activeNpc = npcImgs[frame];
      if (activeNpc && activeNpc.complete && activeNpc.naturalWidth > 0) {
        ctx.drawImage(activeNpc, -32, -48, 64, 64);
      }
      ctx.fillStyle = isNearNpc ? '#fef08a' : '#38bdf8';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`💬 ${rt.npc.data.name} ${isNearNpc ? '[Press E]' : ''}`, 0, -48);
      ctx.restore();

      // Enemy AI & Rendering
      let livingCount = 0;
      rt.enemies.forEach((en, idx) => {
        if (en.hp <= 0) return;
        livingCount += 1;

        const dist = Math.hypot(rt.px - en.x, rt.py - en.y);

        // Turn-Based Mode vs Real-Time Mode AI
        if (isTurnBased) {
          // IN TURN-BASED MODE: Enemies are FROZEN while PLAYER_TURN is active!
          // Only idle in place, no chasing or attacking until ENEMY_TURN
          if (turnPhase === 'PLAYER_TURN') {
            // Frozen in place
          } else if (turnPhase === 'ENEMY_TURN') {
            // Enemy takes turn action: advance towards player
            if (dist > 65) {
              const dx = (rt.px - en.x) / dist;
              const dy = (rt.py - en.y) / dist;
              en.x += dx * 65 * dt;
              en.y += dy * 65 * dt;
            }
          }
        } else {
          // REAL-TIME MODE AI: Continuous Chase & Strike
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
                showBanner(`💥 ${en.name} struck you for 12 DMG!`);
              }
            }
          } else {
            en.angle += dt * 1.1;
            en.x = en.spawnX + Math.cos(en.angle) * 35;
            en.y = en.spawnY + Math.sin(en.angle) * 22;
          }
        }

        // Render Enemy
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

        // Enemy Target Reticle
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

      // Update slain count
      const totalEnemies = rt.enemies.length;
      setSlainCount(totalEnemies - livingCount);

      // Render Player Hero (Knight + Weapon Aura)
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

      // Render Active VFX Blasts (Fireballs, Explosions, Level Clears)
      rt.vfxBlasts = rt.vfxBlasts.filter(b => b.life > 0);
      rt.vfxBlasts.forEach((b) => {
        b.life -= dt;
        b.radius += dt * 170;
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
  }, [compiledGame?.build_id, activeRoomIdx, selectedWeapon, isTurnBased, turnPhase, moveBudgetM]);

  // Handle Prop Interactivity on [E]
  const handlePropInteract = (prop) => {
    const rt = runtimeRef.current;
    if (prop.tag === 'treasure_chest') {
      if (prop.opened) {
        showBark('Chest', '"This chest has already been looted."');
        return;
      }
      prop.opened = true;
      const reward = prop.gold_reward || 10;
      setPlayerGold(prev => prev + reward);
      setCompletedObjectives(prev => new Set(prev).add(`chest_r${activeRoomIdx}`));
      rt.vfxBlasts.push({ x: prop.x, y: prop.y, radius: 15, life: 0.6, color: '#eab308' });
      showBanner(`💰 Plundered Chest: +${reward} Gold! (Total: ${playerGold + reward} Gold)`);
      sendTelemetry('LOOT_CHEST', prop.id, `Looted ${reward} Gold`, 1.2);
    } else if (prop.tag === 'survey_forge') {
      setActiveForgeProp(prop);
    } else if (prop.tag === 'mechanical_lever') {
      if (prop.pulled) {
        showBark('Lever', '"The bronze mechanism is already locked open."');
        return;
      }
      prop.pulled = true;
      setCompletedObjectives(prev => new Set(prev).add(`lever_r${activeRoomIdx}`));
      showBanner('⚙️ Bronze Lever Engaged: North Portcullis Raised!');
      sendTelemetry('LEVER_PULLED', prop.id, 'Raised Portcullis', 1.1);
    } else if (prop.tag === 'flammable_barrel') {
      triggerFireballOrIgnite();
    } else if (prop.tag === 'loot_shrine') {
      setCovenantModalOpen(true);
    }
  };

  // Physical Attack Handler
  const perform2DAttack = (heavy = false) => {
    const rt = runtimeRef.current;

    if (isTurnBased && turnPhase !== 'PLAYER_TURN') {
      showBanner('⚠ It is not your turn! Wait for enemy phase to complete.');
      return;
    }

    if (isTurnBased) {
      if (apCurrent < 1) {
        showBanner('⚠ Insufficient Action Points (0 AP left) — Click [End Turn] to recharge!');
        return;
      }
      setApCurrent(prev => prev - 1);
    }

    rt.attackTimer = heavy ? 0.42 : 0.25;
    setStamina(prev => Math.max(0, prev - (heavy ? 24 : 14)));
    const baseDmg = (selectedWeapon?.base_damage || 68) * (heavy ? 1.45 : 1.0) * (rt.riposteReady ? 2.4 : 1.0);
    rt.riposteReady = false;

    // Hit Enemies
    rt.enemies.forEach((en) => {
      if (en.hp <= 0) return;
      if (Math.hypot(en.x - rt.px, en.y - rt.py) <= 105) {
        en.hp = Math.max(0, en.hp - baseDmg);
        rt.vfxBlasts.push({ x: en.x, y: en.y, radius: 10, life: 0.35, color: '#f97316' });
        if (en.hp <= 0) {
          showBanner(`💀 SLAIN: ${en.name} Defeated!`);
          sendTelemetry('COMBAT_KILL', en.questionId, en.mappedOption, 1.4);
        }
      }
    });

    // Check hit barrels
    rt.props.forEach((p) => {
      if (p.tag === 'flammable_barrel' && !p.exploded && Math.hypot(p.x - rt.px, p.y - rt.py) <= 105) {
        p.exploded = true;
        rt.vfxBlasts.push({ x: p.x, y: p.y, radius: 24, life: 0.65, color: '#ef4444' });
        rt.enemies.forEach(en => { en.hp = Math.max(0, en.hp - 95); });
        showBanner('💥 Alchemical Barrel Detonated by Weapon Strike!');
      }
    });
  };

  // Fireball / Barrel Blast Handler
  const triggerFireballOrIgnite = () => {
    const rt = runtimeRef.current;
    if (isTurnBased) {
      if (apCurrent < 2) {
        showBanner('⚠ Fireball requires 2 AP — Click [End Turn] to restore AP!');
        return;
      }
      setApCurrent(prev => prev - 2);
    } else {
      if (stamina < 20) {
        showBanner('⚠ Low Stamina for Fireball!');
        return;
      }
      setStamina(prev => prev - 20);
    }

    const blastX = rt.px + rt.facing * 90;
    const blastY = rt.py;
    rt.vfxBlasts.push({ x: blastX, y: blastY, radius: 28, life: 0.7, color: '#ef4444' });

    // Damage enemies in blast radius
    rt.enemies.forEach((en) => {
      if (en.hp > 0 && Math.hypot(en.x - blastX, en.y - blastY) <= 130) {
        en.hp = Math.max(0, en.hp - 72);
        if (en.hp <= 0) sendTelemetry('COMBAT_KILL', en.questionId, en.mappedOption, 1.4);
      }
    });

    // Detonate nearby barrels
    rt.props.forEach((p) => {
      if (p.tag === 'flammable_barrel' && !p.exploded && Math.hypot(p.x - blastX, p.y - blastY) <= 140) {
        p.exploded = true;
        rt.vfxBlasts.push({ x: p.x, y: p.y, radius: 32, life: 0.75, color: '#f97316' });
        rt.enemies.forEach(en => { en.hp = Math.max(0, en.hp - 95); });
      }
    });

    showBanner('🔥 Fireball AoE Detonated!');
  };

  // Genuine Turn-Based: Cast Ability
  const cast2DAbility = (ab) => {
    const rt = runtimeRef.current;
    if (turnPhase !== 'PLAYER_TURN') {
      showBanner('⚠ Wait for your turn! Enemy phase is running.');
      return;
    }
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
      showBanner(`💨 ${ab.name}: +${ab.move_bonus_m}m Movement Restored!`);
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

  // Genuine Turn-Based: Execute Enemy Turn
  const endPlayerTurn = () => {
    if (turnPhase === 'ENEMY_TURN') return;
    setTurnPhase('ENEMY_TURN');
    showBanner('⏳ ENEMY PHASE: Sentinels are executing turns...');

    setTimeout(() => {
      const rt = runtimeRef.current;
      let totalDamageTaken = 0;

      rt.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const dist = Math.hypot(rt.px - en.x, rt.py - en.y);
        if (dist <= 75) {
          totalDamageTaken += 12;
          rt.vfxBlasts.push({ x: rt.px, y: rt.py, radius: 14, life: 0.4, color: '#ef4444' });
        } else {
          // Advance 60px towards player
          const dx = (rt.px - en.x) / dist;
          const dy = (rt.py - en.y) / dist;
          en.x += dx * 60;
          en.y += dy * 60;
        }
      });

      if (totalDamageTaken > 0) {
        setPlayerHP(hp => Math.max(10, hp - totalDamageTaken));
        showBark('Sentinel', `"You cannot withstand the legion!"`);
      }

      // Restore player turn
      setApCurrent(4);
      setMoveBudgetM(8.0);
      setTurnPhase('PLAYER_TURN');
      showBanner('🎲 PLAYER TURN: 4 AP & 8.0m Movement Restored!');
    }, 1200);
  };

  // D20 Dialogue Choice Roll
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
          sendTelemetry('D20_DIALOGUE', npcObj.question_id || `q_r${activeRoomIdx + 1}`, ch.choice_text, ch.metric_delta || 1.3);
          setCompletedObjectives(prev => new Set(prev).add(npcObj.question_id || `npc_r${activeRoomIdx + 1}`));
          if (ch.grants_weapon_id && compiledGame?.weapons && onSelectWeapon) {
            const w = compiledGame.weapons.find(x => x.weapon_id === ch.grants_weapon_id);
            if (w) onSelectWeapon(w);
          }
          setD20RollState(null);
          setActiveDialogueNPC(null);
          showBanner(`🎲 D20 ${skill} [${finalRoll} vs DC ${dc}] Success — Survey Response Recorded!`);
        }, 950);
      }
    }, 65);
  };

  // Survey Forge Selection
  const selectForgeTier = (tierName, costGold, weaponIndex = 0) => {
    if (playerGold < costGold) {
      showBanner(`⚠ Insufficient Gold for ${tierName} (${costGold} Gold required — Loot chests first!)`);
    } else {
      setPlayerGold(prev => prev - costGold);
    }
    setCompletedObjectives(prev => new Set(prev).add(`forge_r${activeRoomIdx}`));
    if (compiledGame?.weapons?.[weaponIndex] && onSelectWeapon) {
      onSelectWeapon(compiledGame.weapons[weaponIndex]);
    }
    sendTelemetry('SURVEY_FORGE_TIER', activeForgeProp?.id || 'forge_anvil', tierName, costGold === 10 ? 1.5 : 1.2);
    showBanner(`⚒️ Upgraded to ${tierName}! Weapon equipped.`);
    setActiveForgeProp(null);
  };

  // Determine Objective Statuses
  const totalRoomEnemies = (compiledGame?.rooms?.[activeRoomIdx]?.enemies || []).length;
  const isCombatCleared = totalRoomEnemies > 0 && slainCount >= totalRoomEnemies;
  const isNpcSurveyDone = completedObjectives.has(runtimeRef.current.npc.data?.question_id || `npc_r${activeRoomIdx + 1}`);
  const hasChestInRoom = runtimeRef.current.props.some(p => p.tag === 'treasure_chest');
  const isChestDone = completedObjectives.has(`chest_r${activeRoomIdx}`);
  const hasForgeInRoom = runtimeRef.current.props.some(p => p.tag === 'survey_forge');
  const isForgeDone = completedObjectives.has(`forge_r${activeRoomIdx}`);
  const hasLeverInRoom = runtimeRef.current.props.some(p => p.tag === 'mechanical_lever');
  const isLeverDone = completedObjectives.has(`lever_r${activeRoomIdx}`);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#070a12' }}>
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          if (isTurnBased && !e.shiftKey) {
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

      {/* Top-Left Player Status HUD */}
      <div style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        background: 'rgba(11, 16, 29, 0.94)',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '10px 14px',
        minWidth: '320px',
        zIndex: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
          <span>{isTurnBased ? '🎲 TURN-BASED CRPG' : '⚔️ REAL-TIME ACTION'} • ZONE {activeRoomIdx + 1}/{rooms.length || 1}</span>
          <span style={{ color: '#fbbf24', fontWeight: 900 }}>💰 {playerGold} GOLD</span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
          {currentRoom.name || compiledGame?.campaign_title || 'Dungeon Chamber'}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
          <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }} title="Health">
            <div style={{ width: `${playerHP}%`, height: '100%', background: '#ef4444' }} />
          </div>
          <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }} title="Stamina">
            <div style={{ width: `${stamina}%`, height: '100%', background: '#22c55e' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8' }}>
          <span>HP: {playerHP}/100</span>
          <span>🧪 Flasks: {estusCharges}/3 [R]</span>
          <span>Weapon: <strong style={{ color: '#f8fafc' }}>{selectedWeapon?.name?.slice(0, 14) || 'Sword'}</strong></span>
        </div>
      </div>

      {/* Top-Right Mission Objectives HUD */}
      <div style={{
        position: 'absolute',
        top: '14px',
        right: '14px',
        background: 'rgba(11, 16, 29, 0.94)',
        border: '1px solid #6366f1',
        borderRadius: '10px',
        padding: '10px 14px',
        width: '310px',
        zIndex: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8', letterSpacing: '0.04em' }}>
            🎯 MISSION OBJECTIVES (ZONE {activeRoomIdx + 1})
          </span>
          <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
            {activeRoomIdx + 1} of {rooms.length || 1}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
          {/* Objective 1: NPC Dialogue */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: isNpcSurveyDone ? '#94a3b8' : '#f8fafc', textDecoration: isNpcSurveyDone ? 'line-through' : 'none' }}>
              💬 Speak with {runtimeRef.current.npc.data?.name?.slice(0, 18) || 'Envoy'}
            </span>
            <span style={{ fontWeight: 800, color: isNpcSurveyDone ? '#34d399' : '#f59e0b' }}>
              {isNpcSurveyDone ? '[✓] Done' : '[E] Talk'}
            </span>
          </div>

          {/* Objective 2: Chest */}
          {hasChestInRoom && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: isChestDone ? '#94a3b8' : '#f8fafc', textDecoration: isChestDone ? 'line-through' : 'none' }}>
                📦 Plunder Gold Chest (+10 Gold)
              </span>
              <span style={{ fontWeight: 800, color: isChestDone ? '#34d399' : '#eab308' }}>
                {isChestDone ? '[✓] Looted' : '[E] Open'}
              </span>
            </div>
          )}

          {/* Objective 3: Forge Anvil */}
          {hasForgeInRoom && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: isForgeDone ? '#94a3b8' : '#f8fafc', textDecoration: isForgeDone ? 'line-through' : 'none' }}>
                ⚒️ Evaluate Forge Tier ($10 vs $2)
              </span>
              <span style={{ fontWeight: 800, color: isForgeDone ? '#34d399' : '#38bdf8' }}>
                {isForgeDone ? '[✓] Chosen' : '[E] Forge'}
              </span>
            </div>
          )}

          {/* Objective 4: Lever */}
          {hasLeverInRoom && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: isLeverDone ? '#94a3b8' : '#f8fafc', textDecoration: isLeverDone ? 'line-through' : 'none' }}>
                ⚙️ Pull Bronze Lever (Raise Gate)
              </span>
              <span style={{ fontWeight: 800, color: isLeverDone ? '#34d399' : '#a855f7' }}>
                {isLeverDone ? '[✓] Raised' : '[E] Pull'}
              </span>
            </div>
          )}

          {/* Objective 5: Combat */}
          {totalRoomEnemies > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: isCombatCleared ? '#94a3b8' : '#f8fafc', textDecoration: isCombatCleared ? 'line-through' : 'none' }}>
                💀 Defeat Sentinels ({slainCount}/{totalRoomEnemies})
              </span>
              <span style={{ fontWeight: 800, color: isCombatCleared ? '#34d399' : '#ef4444' }}>
                {isCombatCleared ? '[✓] Cleared' : 'Active'}
              </span>
            </div>
          )}

          {/* Objective 6: North Portal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>
            <span style={{ color: '#cbd5e1' }}>
              🚪 North Portal to Zone {activeRoomIdx + 2}
            </span>
            <span style={{ fontWeight: 800, color: '#38bdf8' }}>
              Walk North ▲
            </span>
          </div>
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
          zIndex: 22,
          boxShadow: '0 4px 20px rgba(250, 204, 21, 0.25)'
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

      {/* Bottom Controls: GENUINE TURN-BASED vs REAL-TIME ACTION */}
      {isTurnBased ? (
        /* Genuine Turn-Based Combat Bar */
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 13, 24, 0.94)',
          border: turnPhase === 'PLAYER_TURN' ? '1px solid #6366f1' : '1px solid #ef4444',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 16
        }}>
          <div style={{ paddingRight: '10px', borderRight: '1px solid #334155', fontSize: '10px', color: '#cbd5e1' }}>
            <div style={{
              fontWeight: 900,
              color: turnPhase === 'PLAYER_TURN' ? '#34d399' : '#f87171',
              padding: '2px 6px',
              borderRadius: '4px',
              background: turnPhase === 'PLAYER_TURN' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              marginBottom: '3px'
            }}>
              {turnPhase === 'PLAYER_TURN' ? 'PLAYER PHASE' : 'ENEMY PHASE'}
            </div>
            <div style={{ fontWeight: 800, color: '#818cf8' }}>AP: {apCurrent}/4</div>
            <div style={{ color: '#38bdf8' }}>Move: {moveBudgetM.toFixed(1)}m</div>
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
              disabled={turnPhase !== 'PLAYER_TURN'}
              style={{
                background: '#1e293b',
                border: `1px solid ${ab.color || '#6366f1'}`,
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#f8fafc',
                cursor: turnPhase === 'PLAYER_TURN' ? 'pointer' : 'not-allowed',
                opacity: turnPhase === 'PLAYER_TURN' ? 1 : 0.45,
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {ab.icon || '⚡'} {ab.name} ({ab.ap_cost || 1} AP)
            </button>
          ))}

          <button
            onClick={endPlayerTurn}
            disabled={turnPhase !== 'PLAYER_TURN'}
            style={{
              background: turnPhase === 'PLAYER_TURN'
                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                : '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: turnPhase === 'PLAYER_TURN' ? 'pointer' : 'not-allowed'
            }}
          >
            ⏳ End Turn
          </button>
        </div>
      ) : (
        /* Real-Time Action Controls Hotbar (NO Turn-Based AP Buttons!) */
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 13, 24, 0.94)',
          border: '1px solid #38bdf8',
          borderRadius: '12px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 16
        }}>
          <button
            onClick={() => perform2DAttack(false)}
            style={{
              background: '#1e293b',
              border: '1px solid #f97316',
              borderRadius: '8px',
              padding: '7px 12px',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            ⚔️ Strike [LMB / Space]
          </button>
          <button
            onClick={triggerFireballOrIgnite}
            style={{
              background: '#1e293b',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '7px 12px',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🔥 Fireball AoE [1]
          </button>
          <button
            onClick={() => {
              setEstusCharges(prev => {
                if (prev <= 0) { showBanner('🧪 Flask Empty!'); return 0; }
                setPlayerHP(hp => Math.min(100, hp + 45));
                showBanner('✨ Estus Flask Consumed (+45 HP)');
                return prev - 1;
              });
            }}
            style={{
              background: '#1e293b',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '7px 12px',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🧪 Heal Flask [R] ({estusCharges})
          </button>
          <button
            onClick={() => {
              const rt = runtimeRef.current;
              const distNpc = Math.hypot(rt.px - rt.npc.x, rt.py - rt.npc.y);
              if (distNpc < 140) setActiveDialogueNPC(rt.npc.data);
              else showBanner('Walk close to NPC or Props to Interact [E]');
            }}
            style={{
              background: '#1e293b',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              padding: '7px 12px',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            💬 Interact [E]
          </button>
          <button
            onClick={() => {
              const rt = runtimeRef.current;
              rt.lockedEnemyIdx = rt.lockedEnemyIdx === 0 ? null : 0;
              showBanner(rt.lockedEnemyIdx !== null ? '🎯 Target Lock-On Engaged' : '🎯 Target Lock-On Released', 1400);
            }}
            style={{
              background: '#1e293b',
              border: '1px solid #94a3b8',
              borderRadius: '8px',
              padding: '7px 10px',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🎯 Lock [Q]
          </button>
        </div>
      )}

      {/* Survey Forge Tier Modal ($10 vs $2 Decomposed Pricing Intent) */}
      {activeForgeProp && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7, 10, 18, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30
        }}>
          <div style={{
            width: '520px',
            background: '#0f172a',
            border: '1px solid #f59e0b',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: '0 20px 50px rgba(245, 158, 11, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#f59e0b' }}>
                ⚒️ {compiledGame?.company_name || 'STUDIO'} SURVEY FORGE ANVIL
              </div>
              <button
                onClick={() => setActiveForgeProp(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#f8fafc', marginBottom: '14px', lineHeight: 1.5 }}>
              The Forge Master tests your valuation of <strong>{compiledGame?.company_name || 'our service'}</strong>:
              <br />
              <span style={{ color: '#38bdf8', fontStyle: 'italic' }}>
                "{compiledGame?.survey_intent || 'Evaluate willingness to upgrade to premium tier'}"
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => selectForgeTier('Sovereign Tier ($10/mo - Premium Weapon & Exclusive Aura)', 10, 0)}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid #f59e0b',
                  borderRadius: '10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '13px' }}>
                    👑 Sovereign Tier ($10 / mo)
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
                    Full Unrestricted Access • Golden Aura VFX • +90 Poise Damage
                  </div>
                </div>
                <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '12px' }}>
                  Cost: 10 Gold
                </div>
              </button>

              <button
                onClick={() => selectForgeTier('Adventurer Tier ($2/mo - Core Utility Weapon)', 2, 1)}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid #38bdf8',
                  borderRadius: '10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '13px' }}>
                    ⚡ Adventurer Tier ($2 / mo)
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
                    Standard Utility • Lightning Arc VFX • Balanced Agility
                  </div>
                </div>
                <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '12px' }}>
                  Cost: 2 Gold
                </div>
              </button>

              <button
                onClick={() => selectForgeTier('Community Free Tier ($0 - Baseline Weapon)', 0, 2)}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(71, 85, 105, 0.15)',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '12px' }}>
                    🛡 Community Baseline ($0)
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10.5px' }}>
                    Standard Base Features • No Cost
                  </div>
                </div>
                <div style={{ color: '#94a3b8', fontWeight: 800, fontSize: '11px' }}>
                  Free
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2D D20 Dialogue Modal strictly bound to Company's Intent */}
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
      {covenantModalOpen && (
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
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>🔥 COVENANT RELIC SHRINE</span>
              <button onClick={() => setCovenantModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '14px', color: '#f8fafc', marginBottom: '12px' }}>
              "{runtimeRef.current.npc.data?.question_text || 'Pledge your covenant to replenish healing flasks and record your allegiance.'}"
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(runtimeRef.current.npc.data?.choices || []).map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setEstusCharges(3);
                    sendTelemetry('COVENANT_SHRINE', runtimeRef.current.npc.data?.question_id || 'q1', ch.choice_text, ch.metric_delta || 1.3);
                    setCompletedObjectives(prev => new Set(prev).add(`shrine_r${activeRoomIdx}`));
                    setCovenantModalOpen(false);
                    showBanner(`🔥 Covenant Pledged: ${ch.choice_text} (Flasks Refilled!)`);
                  }}
                  style={{ textAlign: 'left', padding: '10px 12px', background: '#1e293b', border: '1px solid #f59e0b66', borderRadius: '8px', color: '#f8fafc', cursor: 'pointer' }}
                >
                  <strong style={{ color: '#fbbf24' }}>Pledge {idx + 1}:</strong> {ch.choice_text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
