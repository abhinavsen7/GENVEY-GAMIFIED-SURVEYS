import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import DungeonMinimap from './components/DungeonMinimap';
import BossCutsceneOverlay from './components/BossCutsceneOverlay';
import LootInventoryHUD from './components/LootInventoryHUD';

const GLTF_CACHE = new Map();

function loadCachedGLTF(loader, url, fallbackUrl = null) {
  if (GLTF_CACHE.has(url)) {
    return Promise.resolve(GLTF_CACHE.get(url));
  }
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        GLTF_CACHE.set(url, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.warn(`[KayKit Loader] Primary asset failed (${url}):`, err);
        if (fallbackUrl && fallbackUrl !== url) {
          if (GLTF_CACHE.has(fallbackUrl)) {
            resolve(GLTF_CACHE.get(fallbackUrl));
            return;
          }
          loader.load(
            fallbackUrl,
            (gltf2) => {
              GLTF_CACHE.set(fallbackUrl, gltf2);
              resolve(gltf2);
            },
            undefined,
            () => resolve({ scene: new THREE.Group(), animations: [] })
          );
        } else {
          resolve({ scene: new THREE.Group(), animations: [] });
        }
      }
    );
  });
}

function createTextSprite(title, subtitle = '', borderColor = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(8, 12, 22, 0.85)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 112, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 32), 256, 54);

  if (subtitle) {
    ctx.fillStyle = borderColor;
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText(subtitle.slice(0, 42), 256, 92);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function normalizeAndSnapToFloor(object3d, targetHeightM = null) {
  object3d.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3d);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  if (targetHeightM && size.y > 0.05) {
    const sFactor = targetHeightM / size.y;
    object3d.scale.multiplyScalar(sFactor);
    object3d.updateMatrixWorld(true);
  }
  const boxAfter = new THREE.Box3().setFromObject(object3d);
  if (!boxAfter.isEmpty() && Math.abs(boxAfter.min.y) < 50) {
    object3d.position.y -= boxAfter.min.y;
  }
}

function retargetAndBindClips(mixer, embeddedClips = [], externalClips = []) {
  const actions = {};
  const allClips = [...embeddedClips, ...externalClips];
  allClips.forEach((rawClip) => {
    if (!rawClip) return;
    const clip = rawClip.clone();
    clip.tracks.forEach((track) => {
      track.name = track.name.replace(/^mixamorig:/i, '').replace(/^Armature\|/i, '');
    });
    actions[clip.name] = mixer.clipAction(clip);
  });

  // Register bidirectional aliases between Quaternius UAL1/UAL2 (65-bone) and RPG (41-bone) clip names
  const aliasPairs = [
    ['Idle', 'Sword_Idle'],
    ['Idle', 'Idle_Loop'],
    ['Running_A', 'Jog_Fwd_Loop'],
    ['Running_B', 'Sprint_Loop'],
    ['Walking_A', 'Walk_Loop'],
    ['Dodge_Forward', 'Roll'],
    ['Dodge_Backward', 'Sword_Dash'],
    ['1H_Melee_Attack_Slice_Diagonal', 'Sword_Regular_A'],
    ['1H_Melee_Attack_Slice_Horizontal', 'Sword_Regular_B'],
    ['1H_Melee_Attack_Chop', 'Sword_Regular_C'],
    ['2H_Melee_Attack_Chop', 'Sword_Attack'],
    ['2H_Melee_Attack_Spin', 'Sword_Heavy_Combo'],
    ['Hit_A', 'Hit_Chest'],
    ['Death_A', 'Death01'],
    ['Block', 'Sword_Block']
  ];
  aliasPairs.forEach(([a, b]) => {
    if (actions[a] && !actions[b]) actions[b] = actions[a];
    if (actions[b] && !actions[a]) actions[a] = actions[b];
  });

  return actions;
}

function createBattleFxAuraMesh(colorHex = '#ef4444', radius = 0.85) {
  const geo = new THREE.SphereGeometry(radius, 20, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        float fresnel = pow(1.0 - abs(vNormal.z), 2.2);
        float wave = 0.5 + 0.5 * sin(vWorldPos.y * 8.0 - uTime * 5.0);
        float alpha = clamp(fresnel * (0.35 + 0.45 * wave), 0.08, 0.72);
        gl_FragColor = vec4(uColor * (1.2 + 0.5 * wave), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(geo, mat);
}

const GameCanvas3D = forwardRef(({
  gameMode,
  selectedWeapon,
  compiledGame,
  onCompileNow,
  isCompiling,
  stamina,
  setStamina,
  bossHealth,
  setBossHealth,
  bossPoise,
  setBossPoise,
  bossStaggered,
  setBossStaggered,
  sendTelemetry,
  setCombatLog,
  isAttacking,
  setIsAttacking,
  isInvincible,
  setIsInvincible,
  videoAnalysis,
  onSelectWeapon
}, ref) => {
  const mountRef = useRef(null);
  const [loadingProgress, setLoadingProgress] = useState(
    compiledGame?.rooms?.length ? 'Loading Custom Asset Packs & UAL Animations...' : null
  );
  const [isReady, setIsReady] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [nearbyNPC, setNearbyNPC] = useState(null);
  const [activeDialogueNPC, setActiveDialogueNPC] = useState(null);
  const [nearbyPuzzleRoom, setNearbyPuzzleRoom] = useState(null);
  const [playerHP, setPlayerHP] = useState(100);

  // Deep Genre Mechanics States (CRPG / Dark Souls / Ultima)
  const [apCurrent, setApCurrent] = useState(4);
  const [moveBudgetM, setMoveBudgetM] = useState(8.0);
  const [d20RollState, setD20RollState] = useState(null);
  const [estusCharges, setEstusCharges] = useState(3);
  const [lockedTargetName, setLockedTargetName] = useState(null);
  const [parryStatusBanner, setParryStatusBanner] = useState(null);
  const [covenantModalOpen, setCovenantModalOpen] = useState(false);
  const [grabbedPropName, setGrabbedPropName] = useState(null);
  const [torchesLit, setTorchesLit] = useState(true);
  const [barkToast, setBarkToast] = useState(null);
  const [playerGold, setPlayerGold] = useState(compiledGame?.starting_gold || 0);
  const [interactPrompt, setInteractPrompt] = useState(null);

  // Boss Cutscene & Boss HUD States
  const [isCutsceneActive, setIsCutsceneActive] = useState(false);
  const [activeBossData, setActiveBossData] = useState(null);
  const [showBossBar, setShowBossBar] = useState(false);
  const [bossMaxHealth, setBossMaxHealth] = useState(140);
  const [bossMaxPoise, setBossMaxPoise] = useState(80);

  // Loot Drop & Inventory Drawer States
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [recentLootNotification, setRecentLootNotification] = useState(null);

  const stateRef = useRef({
    gameMode: gameMode || 'SOULSLIKE_ACTION',
    keys: { w: false, a: false, s: false, d: false },
    playerPos: new THREE.Vector3(0, 0, -3),
    playerYaw: Math.PI,
    targetWaypoint: null,
    stamina: 100,
    playerHP: 100,
    playerGold: compiledGame?.starting_gold || 0,
    isRolling: false,
    rollTimer: 0,
    isAttacking: false,
    attackTimer: 0,
    attackType: 'LIGHT',
    parryTimer: 0,
    riposteReady: false,
    lockedEnemyId: null,
    grabbedProp: null,
    torchesLit: true,
    roomProps: [],
    hitAppliedThisSwing: false,
    hitstopTimer: 0,
    shakeIntensity: 0,
    playerMixer: null,
    playerActions: {},
    currentPlayerAnim: '',
    rightHandBone: null,
    weaponMesh: null,
    swordTipLocal: new THREE.Vector3(0, 1.2, 0),
    swordBaseLocal: new THREE.Vector3(0, 0.1, 0),
    trailPositions: [],
    trailGeometry: null,
    trailMaterial: null,
    sceneRef: null,
    loaderRef: null,
    enemies: [],
    npcs: [],
    gates: [],
    levers: [],
    chests: [],
    forges: [],
    barrels: [],
    lootDrops: [],
    wallColliders: [],
    torchLights: [],
    roomCenters: [],
    visitedRooms: new Set([0]),
    answeredQuestions: new Set(),
    activeRoomIdx: 0,
    cutsceneTimer: 0,
    cutsceneBoss: null,
    bossIntroPlayedRooms: new Set()
  });

  useEffect(() => {
    stateRef.current.gameMode = gameMode;
  }, [gameMode]);

  // Seed initial inventory from compiledGame.weapons
  useEffect(() => {
    if (compiledGame?.weapons && compiledGame.weapons.length > 0) {
      const enriched = compiledGame.weapons.map((w, idx) => ({
        ...w,
        rarity_label: idx === 0 ? 'LEGENDARY RELIC' : idx === 1 ? 'EPIC ARTIFACT' : 'RARE ARMAMENT',
        lore_inscription: w.lore_inscription || `Forged in the ${compiledGame.campaign_title || 'Obsidian Forge'} to evaluate psychometric resilience across ${compiledGame.company_name || 'campaign'} trials.`
      }));
      setInventoryItems(enriched);
    } else {
      setInventoryItems([
        {
          weapon_id: 'kaykit_ancestral_blade',
          name: 'Ancestral Vanguard Greatsword',
          element_type: 'FIRE',
          shader_color_hex: '#f97316',
          base_damage: 72,
          poise_damage: 85,
          rarity_label: 'LEGENDARY RELIC',
          lore_inscription: 'Standard-issue KayKit Paladin Greatsword imbued with ember runes.',
          procedural_spec: { archetype: 'GREATSWORD', blade_length: 1.25 }
        }
      ]);
    }
  }, [compiledGame?.build_id]);

  const playCharacterAnim = (mixerActions, currentNameRef, nextName, loopOnce = false, timeScale = 1.0) => {
    if (!mixerActions || !mixerActions[nextName]) return;
    if (currentNameRef.current === nextName && !loopOnce) return;

    const prevAction = mixerActions[currentNameRef.current];
    const nextAction = mixerActions[nextName];

    nextAction.reset();
    nextAction.timeScale = timeScale;
    if (loopOnce) {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    }
    nextAction.play();
    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, 0.15, true);
    }
    currentNameRef.current = nextName;
  };

  // Spawn 3D Physical Loot Drop (Glowing Gold Chest + Vertical Light Pillar) & Add Relic to Inventory
  const spawnLootDropAndGrantRelic = async (worldPos, sourceLabel, questionId, rarityIdx = 0) => {
    const s = stateRef.current;
    const rarityColors = ['#facc15', '#c084fc', '#38bdf8'];
    const rarityNames = ['LEGENDARY RELIC', 'EPIC ARTIFACT', 'RARE ARMAMENT'];
    const rColor = rarityColors[rarityIdx % rarityColors.length];
    const rLabel = rarityNames[rarityIdx % rarityNames.length];

    // 1. Create 3D Loot Drop in Three.js Scene
    if (s.sceneRef && s.loaderRef) {
      try {
        const chestGltf = await loadCachedGLTF(
          s.loaderRef,
          '/kaykit/dungeon/addons/kaykit_dungeon_remastered/Assets/gltf/chest_gold.glb'
        );
        const dropGroup = new THREE.Group();
        dropGroup.position.set(worldPos.x, 0, worldPos.z);

        const chestMesh = chestGltf.scene.clone();
        chestMesh.scale.set(0.85, 0.85, 0.85);
        dropGroup.add(chestMesh);

        // Vertical Light Beam Pillar
        const beamGeo = new THREE.CylinderGeometry(0.32, 0.55, 7.5, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(rColor),
          transparent: true,
          opacity: 0.36,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        beamMesh.position.set(0, 3.75, 0);
        dropGroup.add(beamMesh);

        // PointLight glow
        const dropLight = new THREE.PointLight(new THREE.Color(rColor), 3.5, 9.0);
        dropLight.position.set(0, 1.5, 0);
        dropGroup.add(dropLight);

        const badge = createTextSprite(`✨ ${rLabel}`, `${sourceLabel.slice(0, 28)}`, rColor);
        badge.position.set(0, 2.5, 0);
        dropGroup.add(badge);

        s.sceneRef.add(dropGroup);
        s.lootDrops.push({ group: dropGroup, beam: beamMesh, basePos: worldPos.clone() });
      } catch (e) {
        console.warn('Loot drop mesh warning:', e);
      }
    }

    // 2. Grant Forged Survey Relic Weapon into Inventory Drawer
    const archetypes = ['GREATSWORD', 'WARHAMMER', 'SCYTHE', 'RAPIER', 'HALBERD'];
    const elements = ['FIRE', 'NECROTIC', 'LIGHTNING', 'HOLY'];
    const chosenArch = archetypes[Math.floor(Math.random() * archetypes.length)];
    const chosenElem = elements[rarityIdx % elements.length];
    const baseWeapons = compiledGame?.weapons || [];
    const templateW = baseWeapons[rarityIdx % Math.max(1, baseWeapons.length)] || {};

    const newRelic = {
      weapon_id: `relic_${Date.now().toString().slice(-5)}`,
      name: `${sourceLabel.split(' ')[0]}'s ${chosenElem.charAt(0) + chosenElem.slice(1).toLowerCase()} ${chosenArch.charAt(0) + chosenArch.slice(1).toLowerCase()}`,
      glb_url: templateW.glb_url,
      element_type: chosenElem,
      shader_color_hex: rColor,
      base_damage: 78 + (2 - (rarityIdx % 3)) * 18,
      poise_damage: 85 + (2 - (rarityIdx % 3)) * 22,
      rarity_label: rLabel,
      source_question_id: questionId,
      lore_inscription: `Manifested from "${sourceLabel}" (${questionId || 'trial'}) — embodies decisive ${chosenElem.toLowerCase()} conviction.`,
      procedural_spec: {
        archetype: chosenArch,
        blade_length: chosenArch === 'RAPIER' ? 1.05 : chosenArch === 'GREATSWORD' ? 1.45 : 1.28
      }
    };

    setInventoryItems(prev => [newRelic, ...prev]);
    setRecentLootNotification({
      name: newRelic.name,
      tierLabel: `${rLabel} DROPPED!`,
      rarityColor: rColor
    });
    setTimeout(() => {
      setRecentLootNotification(null);
    }, 4500);
  };

  // Trigger 3.5-Second Cinematic Boss Arena Intro Cutscene
  const triggerBossCutscene = (targetBoss = null) => {
    const s = stateRef.current;
    const bossEnemy = targetBoss
      || s.enemies.find(e => e.isBoss && e.state !== 'DEAD')
      || s.enemies.find(e => e.roomIndex === s.activeRoomIdx && e.state !== 'DEAD')
      || s.enemies[0];

    if (!bossEnemy) return;

    s.cutsceneBoss = bossEnemy;
    s.cutsceneTimer = 3.5;
    setIsCutsceneActive(true);
    setShowBossBar(true);
    setBossHealth(bossEnemy.hp);
    setBossMaxHealth(bossEnemy.maxHp || 140);
    setBossPoise(bossEnemy.poise);
    setBossMaxPoise(bossEnemy.maxPoise || 80);

    const boundRoom = compiledGame?.rooms?.[bossEnemy.roomIndex] || compiledGame?.rooms?.[s.activeRoomIdx];
    const targetMetric = boundRoom?.npc?.target_metric || 'executive_crisis_decision_making';
    setActiveBossData({
      name: bossEnemy.name.toUpperCase(),
      targetMetric,
      subtitle: `Final Evaluation: ${targetMetric.replace(/_/g, ' ').toUpperCase()} (${boundRoom?.npc?.question_id || 'KPI'})`
    });

    // Play Boss Taunt / Spin Animation during cutscene
    const tauntAnim = bossEnemy.actions?.['2H_Melee_Attack_Spin']
      ? '2H_Melee_Attack_Spin'
      : bossEnemy.actions?.['Cheer']
      ? 'Cheer'
      : '1H_Melee_Attack_Slice_Diagonal';
    playCharacterAnim(
      bossEnemy.actions,
      { get current() { return bossEnemy.currentAnim; }, set current(v) { bossEnemy.currentAnim = v; } },
      tauntAnim,
      false,
      0.95
    );

    setCombatLog(prev => [`🎬 BOSS CUTSCENE: Entering Arena of ${bossEnemy.name}!`, ...prev]);
  };

  // Fast-Travel / Teleport Player to any Room clicked on DungeonMinimap
  const teleportToRoom = (roomIdx, worldX, worldZ) => {
    const s = stateRef.current;
    s.playerPos.set(worldX, 0, worldZ);
    s.targetWaypoint = null;
    s.activeRoomIdx = roomIdx;
    s.visitedRooms.add(roomIdx);
    setActiveRoomIndex(roomIdx);

    const rooms = compiledGame?.rooms || [];
    const targetRoom = rooms[roomIdx];
    setCombatLog(prev => [`⚡ FAST-TRAVEL: Warped to Room ${roomIdx + 1} (${targetRoom?.name || 'Chamber'})`, ...prev]);

    if (targetRoom?.is_boss_arena && !s.bossIntroPlayedRooms.has(roomIdx)) {
      s.bossIntroPlayedRooms.add(roomIdx);
      const bossInRoom = s.enemies.find(e => e.roomIndex === roomIdx && e.state !== 'DEAD');
      if (bossInRoom) {
        triggerBossCutscene(bossInRoom);
      }
    }
  };

  const triggerAttack = (type = 'LIGHT') => {
    const s = stateRef.current;
    if (s.cutsceneTimer > 0 || s.isAttacking || s.isRolling || s.stamina < 16) return;

    s.stamina = Math.max(0, s.stamina - (type === 'HEAVY' ? 26 : 16));
    setStamina(s.stamina);
    s.isAttacking = true;
    s.attackType = type;
    s.attackTimer = type === 'HEAVY' ? 0.78 : 0.56;
    s.hitAppliedThisSwing = false;
    setIsAttacking(true);

    const animName = type === 'HEAVY' ? '2H_Melee_Attack_Spin' : '1H_Melee_Attack_Slice_Diagonal';
    const fallbackName = s.playerActions[animName] ? animName : '1H_Melee_Attack_Chop';
    playCharacterAnim(
      s.playerActions,
      { get current() { return s.currentPlayerAnim; }, set current(v) { s.currentPlayerAnim = v; } },
      fallbackName,
      true,
      1.35
    );
  };

  const triggerDodgeRoll = () => {
    const s = stateRef.current;
    if (s.cutsceneTimer > 0 || s.isRolling || s.stamina < 20) return;

    s.stamina = Math.max(0, s.stamina - 20);
    setStamina(s.stamina);
    s.isRolling = true;
    s.rollTimer = 0.48;
    setIsInvincible(true);

    const animName = s.playerActions['Dodge_Forward'] ? 'Dodge_Forward' : 'Dodge_Backward';
    playCharacterAnim(
      s.playerActions,
      { get current() { return s.currentPlayerAnim; }, set current(v) { s.currentPlayerAnim = v; } },
      animName,
      true,
      1.4
    );
  };

  const showBark = (speaker, line) => {
    setBarkToast({ speaker, line });
    setTimeout(() => setBarkToast(null), 3200);
  };

  const triggerParry = () => {
    const s = stateRef.current;
    if (s.cutsceneTimer > 0 || s.isRolling || s.stamina < 12) return;
    s.stamina = Math.max(0, s.stamina - 12);
    setStamina(s.stamina);
    s.parryTimer = 0.24; // 240ms active parry window
    const animName = s.playerActions['Block'] ? 'Block' : 'Idle';
    playCharacterAnim(
      s.playerActions,
      { get current() { return s.currentPlayerAnim; }, set current(v) { s.currentPlayerAnim = v; } },
      animName,
      true,
      1.3
    );

    // Check if an enemy in the active room is winding up or close enough to parry
    const parriedEn = s.enemies.find(
      en => en.roomIndex === s.activeRoomIdx && en.state !== 'DEAD' && en.pos.distanceTo(s.playerPos) <= 3.6
    );
    if (parriedEn) {
      parriedEn.state = 'STAGGER';
      parriedEn.stateTimer = 2.8;
      parriedEn.poise = 0;
      s.riposteReady = true;
      s.hitstopTimer = 0.08;
      s.shakeIntensity = 0.36;
      setBossStaggered(true);
      setParryStatusBanner(`⚡ METALLIC SPARK PARRY! ${parriedEn.name} Staggered — Press [LMB] for 2.4x CRITICAL RIPOSTE!`);
      setTimeout(() => setParryStatusBanner(null), 3000);
    } else {
      setParryStatusBanner('🛡 Shield Parry Stance Active (200ms Window)');
      setTimeout(() => setParryStatusBanner(null), 1100);
    }
  };

  const triggerEstusHeal = () => {
    const s = stateRef.current;
    if (estusCharges <= 0) {
      setParryStatusBanner('🧪 Estus Flask Empty — Rest at a Covenant Shrine [F] to Replenish');
      setTimeout(() => setParryStatusBanner(null), 2200);
      return;
    }
    setEstusCharges(prev => Math.max(0, prev - 1));
    s.playerHP = Math.min(100, s.playerHP + 45);
    setPlayerHP(s.playerHP);
    setParryStatusBanner('✨ Estus Flask Consumed (+45 HP Restored)');
    setTimeout(() => setParryStatusBanner(null), 2000);
  };

  const toggleTargetLockOn = () => {
    const s = stateRef.current;
    if (s.lockedEnemyId) {
      s.lockedEnemyId = null;
      setLockedTargetName(null);
      return;
    }
    const candidate = s.enemies.find(
      en => en.roomIndex === s.activeRoomIdx && en.state !== 'DEAD' && en.pos.distanceTo(s.playerPos) < 18.0
    ) || s.enemies.find(en => en.state !== 'DEAD');
    if (candidate) {
      s.lockedEnemyId = candidate.id;
      setLockedTargetName(candidate.name);
    }
  };

  const castCrpgAbility = (ability) => {
    const s = stateRef.current;
    if (apCurrent < (ability.ap_cost || 1)) {
      setParryStatusBanner('⚠ Insufficient Action Points (AP) — Click [End Turn] to Refresh');
      setTimeout(() => setParryStatusBanner(null), 2000);
      return;
    }
    setApCurrent(prev => Math.max(0, prev - (ability.ap_cost || 1)));

    // Spawn 3D VFX Blast Sphere in Scene
    if (s.sceneRef) {
      const blastMesh = createBattleFxAuraMesh(ability.color || '#38bdf8', ability.aoe_radius_m || 2.2);
      blastMesh.position.set(s.playerPos.x, 1.0, s.playerPos.z - 1.8);
      s.sceneRef.add(blastMesh);
      setTimeout(() => {
        if (s.sceneRef) s.sceneRef.remove(blastMesh);
      }, 650);
    }

    if (ability.heal) {
      s.playerHP = Math.min(100, s.playerHP + ability.heal);
      setPlayerHP(s.playerHP);
      setParryStatusBanner(`✨ Cast ${ability.name}: Restored +${ability.heal} HP!`);
      setTimeout(() => setParryStatusBanner(null), 2000);
      return;
    }
    if (ability.move_bonus_m) {
      setMoveBudgetM(prev => prev + ability.move_bonus_m);
      setParryStatusBanner(`💨 Cast ${ability.name}: +${ability.move_bonus_m}m Tactical Movement Budget!`);
      setTimeout(() => setParryStatusBanner(null), 2000);
      return;
    }

    // Deal tactical AoE / Cleave damage to enemies in current room
    const dmg = ability.damage || 48;
    s.enemies.forEach((en) => {
      if (en.state === 'DEAD' || en.roomIndex !== s.activeRoomIdx) return;
      if (en.pos.distanceTo(s.playerPos) <= (ability.range_m || 8.0)) {
        en.hp = Math.max(0, en.hp - dmg);
        en.poise = Math.max(0, en.poise - 45);
        setShowBossBar(true);
        setBossHealth(en.hp);
        setBossMaxHealth(en.maxHp || 140);
        setBossPoise(en.poise);
        if (en.hp <= 0) {
          en.state = 'DEAD';
          unlockRoomGate(en.roomIndex, `${ability.name} Tactical Kill`);
          spawnLootDropAndGrantRelic(en.pos.clone(), en.name, en.questionId, 0);
          sendTelemetry('COMBAT_KILL', en.questionId || 'q1', en.mappedOption, 1.45);
        }
      }
    });
    triggerAttack('HEAVY');
    setParryStatusBanner(`${ability.icon || '⚔️'} Cast ${ability.name} (${dmg} Tactical AoE DMG)!`);
    setTimeout(() => setParryStatusBanner(null), 2200);
  };

  const endCrpgTurn = () => {
    setApCurrent(4);
    setMoveBudgetM(8.0);
    setParryStatusBanner('🎲 New Tactical Turn — 4 AP & 8.0m Movement Restored');
    setTimeout(() => setParryStatusBanner(null), 1800);
  };

  const rollD20AndSelectChoice = (ch, idx, npcObj) => {
    const dc = ch.dc || 12;
    const skill = ch.skill_name || 'Persuasion';
    setD20RollState({ rolling: true, value: 14, dc, skill, choiceText: ch.choice_text });
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      const randomFace = Math.floor(Math.random() * 20) + 1;
      setD20RollState({ rolling: ticks < 10, value: randomFace, dc, skill, choiceText: ch.choice_text });
      if (ticks >= 10) {
        clearInterval(interval);
        const finalRoll = Math.max(dc, Math.floor(Math.random() * 9) + 12); // Heroic bonus ensures survey progression
        setD20RollState({ rolling: false, value: finalRoll, dc, skill, choiceText: ch.choice_text, success: finalRoll >= dc });
        setTimeout(() => {
          stateRef.current.answeredQuestions.add(npcObj.question_id);
          sendTelemetry('D20_DIALOGUE', npcObj.question_id, ch.choice_text, ch.metric_delta || 1.25);
          unlockRoomGate(activeRoomIndex, `${skill} D20 Roll [${finalRoll} vs DC ${dc}]`);
          spawnLootDropAndGrantRelic(
            stateRef.current.playerPos.clone().add(new THREE.Vector3(0, 0, -1.8)),
            ch.choice_text,
            npcObj.question_id,
            idx
          );
          if (ch.grants_weapon_id && compiledGame?.weapons && onSelectWeapon) {
            const foundW = compiledGame.weapons.find(w => w.weapon_id === ch.grants_weapon_id);
            if (foundW) onSelectWeapon(foundW);
          }
          setD20RollState(null);
          setActiveDialogueNPC(null);
        }, 1050);
      }
    }, 65);
  };

  const toggleGrabProp = () => {
    const s = stateRef.current;
    if (s.grabbedProp) {
      const droppedName = s.grabbedProp.name;
      s.grabbedProp.mesh.position.set(
        s.playerPos.x + Math.sin(s.playerYaw) * 1.6,
        0,
        s.playerPos.z + Math.cos(s.playerYaw) * 1.6
      );
      s.grabbedProp = null;
      setGrabbedPropName(null);
      showBark('Guard Sentinel', `"Hey! Why are you moving that ${droppedName} around?!"`);
      return;
    }
    const candidate = s.roomProps.find(p => p.roomIndex === s.activeRoomIdx && p.mesh.position.distanceTo(s.playerPos) < 3.8);
    if (candidate) {
      s.grabbedProp = candidate;
      setGrabbedPropName(candidate.name);
      showBark('World Affordance', `Grabbed ${candidate.name} — Move with WASD & Press [G] to Place`);
    }
  };

  const toggleRoomTorches = () => {
    const s = stateRef.current;
    s.torchesLit = !s.torchesLit;
    setTorchesLit(s.torchesLit);
    s.torchLights.forEach(tl => {
      tl.light.visible = s.torchesLit;
    });
    showBark(
      'Dungeon Guard',
      s.torchesLit ? '"The torches burn bright once more."' : '"Who extinguished the wall torches?! Stay alert—stealthy shadows lurk!"'
    );
  };

  const unlockRoomGate = (roomIndex, reasonLabel) => {
    const s = stateRef.current;
    const gateObj = s.gates.find(g => g.roomIndex === roomIndex && !g.opened);
    if (gateObj) {
      gateObj.opened = true;
      if (gateObj.colliderIndex !== undefined && s.wallColliders[gateObj.colliderIndex]) {
        s.wallColliders[gateObj.colliderIndex].disabled = true;
      }
      setCombatLog(prev => [`🔓 Room ${roomIndex + 1} Gate Unlocked via ${reasonLabel}! Proceed North.`, ...prev]);
    }
  };

  const solveRoomAffordance = (affordanceType) => {
    const s = stateRef.current;
    const rooms = compiledGame?.rooms || [];
    const currentRoom = rooms[s.activeRoomIdx] || rooms[0];
    if (!currentRoom) return;

    const puz = currentRoom.immersive_sim_puzzle;
    if (!puz) return;
    const qid = currentRoom.npc?.question_id || 'q1';
    s.answeredQuestions.add(qid);

    if (affordanceType === 'BURN') {
      const opt = puz.flammable_barrel?.maps_to_option || 'Aggressive Breach';
      const barrelObj = s.barrels.find(b => b.roomIndex === s.activeRoomIdx && !b.exploded);
      if (barrelObj) {
        barrelObj.exploded = true;
        barrelObj.mesh.visible = false;
        s.enemies.forEach(en => {
          if (en.roomIndex === s.activeRoomIdx && en.state !== 'DEAD') {
            en.hp = Math.max(0, en.hp - 95);
            en.poise = 0;
            en.state = en.hp <= 0 ? 'DEAD' : 'STAGGER';
            en.stateTimer = 2.0;
          }
        });
        spawnLootDropAndGrantRelic(barrelObj.pos, opt, qid, 0);
      } else {
        spawnLootDropAndGrantRelic(s.playerPos.clone().add(new THREE.Vector3(1.5, 0, -1.5)), opt, qid, 0);
      }
      s.shakeIntensity = 0.45;
      showBark('Guard Captain', '"By the gods—the alchemical barrels are detonating!"');
      unlockRoomGate(s.activeRoomIdx, `Alchemical Barrel Ignition ("${opt}")`);
      sendTelemetry('SANDBOX_AFFORDANCE', qid, opt, 1.35);
    } else if (affordanceType === 'LOCKPICK') {
      const opt = puz.locked_gate?.maps_to_option || 'Analytical Bypass';
      showBark('Sanctum Warden', '"Did someone pick the portcullis lock?!"');
      unlockRoomGate(s.activeRoomIdx, `Stealth Lockpick ("${opt}")`);
      spawnLootDropAndGrantRelic(s.playerPos.clone().add(new THREE.Vector3(-1.5, 0, -2.0)), opt, qid, 1);
      sendTelemetry('SANDBOX_AFFORDANCE', qid, opt, 1.2);
    } else if (affordanceType === 'BRIBE') {
      const opt = puz.bribe_guard?.maps_to_option || 'Diplomatic Parley';
      s.enemies.forEach(en => {
        if (en.roomIndex === s.activeRoomIdx && en.state !== 'DEAD') {
          en.pacified = true;
          en.state = 'PATROL';
        }
      });
      showBark('Chamber Envoy', `"Our pact is sealed: ${opt}."`);
      unlockRoomGate(s.activeRoomIdx, `Diplomatic Parley ("${opt}")`);
      spawnLootDropAndGrantRelic(s.playerPos.clone().add(new THREE.Vector3(0, 0, -2.0)), opt, qid, 2);
      sendTelemetry('D20_DIALOGUE', qid, opt, 1.4);
    }
  };

  useImperativeHandle(ref, () => ({
    triggerAttack,
    triggerDodgeRoll,
    triggerParry,
    triggerEstusHeal,
    toggleTargetLockOn,
    solveRoomAffordance,
    triggerBossCutscene,
    teleportToRoom,
    toggleInventory: () => setIsInventoryOpen(prev => !prev)
  }));

  // Dynamically equip weapon GLB into KayKit handslot.r bone & update trail/reach
  useEffect(() => {
    const s = stateRef.current;
    if (!selectedWeapon) return;

    const hexColor = new THREE.Color(selectedWeapon.shader_color_hex || '#f97316');
    if (s.trailMaterial) {
      s.trailMaterial.color.copy(hexColor);
    }
    const bladeLen = selectedWeapon.procedural_spec?.blade_length || 1.25;
    s.swordTipLocal.set(0, bladeLen, 0);

    if (!selectedWeapon.glb_url || !s.rightHandBone) return;

    const loader = new GLTFLoader();
    loader.load(
      selectedWeapon.glb_url,
      (gltf) => {
        if (s.weaponMesh && s.rightHandBone) {
          s.rightHandBone.remove(s.weaponMesh);
        }
        const weaponScene = gltf.scene.clone();
        weaponScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            if (child.material) {
              child.material = child.material.clone();
              child.material.emissive = hexColor;
              child.material.emissiveIntensity = 0.4;
            }
          }
        });
        weaponScene.scale.set(0.85, 0.85, 0.85);
        weaponScene.position.set(0, 0, 0);
        weaponScene.rotation.set(Math.PI / 2, 0, 0);
        s.rightHandBone.add(weaponScene);
        s.weaponMesh = weaponScene;
      },
      undefined,
      () => {}
    );
  }, [selectedWeapon, isReady]);

  // Main Three.js Scene Construction (Rebuilt whenever compiledGame.build_id changes)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    const s = stateRef.current;
    s.enemies = [];
    s.npcs = [];
    s.gates = [];
    s.levers = [];
    s.chests = [];
    s.forges = [];
    s.barrels = [];
    s.lootDrops = [];
    s.wallColliders = [];
    s.torchLights = [];
    s.roomCenters = [];
    s.playerGold = compiledGame?.starting_gold || 0;
    setPlayerGold(s.playerGold);
    s.visitedRooms = new Set([0]);
    s.answeredQuestions = new Set();
    s.bossIntroPlayedRooms = new Set();
    s.playerPos.set(0, 0, -3.5);
    s.playerYaw = Math.PI;
    s.targetWaypoint = null;
    s.cutsceneTimer = 0;
    s.cutsceneBoss = null;

    const width = container.clientWidth || 860;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    s.sceneRef = scene;
    const firstRoomFog = compiledGame?.rooms?.[0]?.lighting?.fog_hex || '#090d16';
    scene.background = new THREE.Color(firstRoomFog);
    scene.fog = new THREE.FogExp2(firstRoomFog, 0.025);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 220);
    camera.position.set(0, 8, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.45, 0.4, 0.82);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.65);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    dirLight.position.set(14, 28, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    const d = 45;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Weapon Swing Trail Ribbon
    const maxTrailPts = 16;
    const trailPositions = new Float32Array(maxTrailPts * 2 * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(selectedWeapon?.shader_color_hex || '#f97316'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const indices = [];
    for (let i = 0; i < maxTrailPts - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = (i + 1) * 2;
      const dIdx = c + 1;
      indices.push(a, b, c, b, dIdx, c);
    }
    trailGeo.setIndex(indices);
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.frustumCulled = false;
    scene.add(trailMesh);
    s.trailGeometry = trailGeo;
    s.trailMaterial = trailMat;
    s.trailPositions = [];

    // Ground Click Ring for CRPG Navigation
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const navRing = new THREE.Mesh(ringGeo, ringMat);
    navRing.visible = false;
    scene.add(navRing);

    const loader = new GLTFLoader();
    s.loaderRef = loader;
    const playerGroup = new THREE.Group();
    playerGroup.position.copy(s.playerPos);
    scene.add(playerGroup);

    // Attach real-time survival-horror / noir flashlight SpotLight cone when flashlight_mode is active
    if (compiledGame?.custom_mechanics?.flashlight_mode) {
      const flashSpot = new THREE.SpotLight(0xfff4d6, 11.0, 24.0, Math.PI / 4.8, 0.42, 1.3);
      flashSpot.position.set(0, 1.55, 0.2);
      flashSpot.castShadow = true;
      const flashTarget = new THREE.Object3D();
      flashTarget.position.set(0, 1.1, 8.5);
      playerGroup.add(flashTarget);
      flashSpot.target = flashTarget;
      playerGroup.add(flashSpot);
    }

    const buildKayKitWorld = async () => {
      try {
        if (!compiledGame?.rooms || compiledGame.rooms.length === 0) {
          setLoadingProgress(null);
          return;
        }

        setLoadingProgress('Streaming Custom Asset Packs (ModularCastle + Fantasy Outfits + UAL1/UAL2 + BattleFX)...');
        const roomsToBuild = compiledGame.rooms;

        // Preload Quaternius Universal Animation Libraries 1 & 2 (86 mocap clips for 65-bone rigs)
        const [ual1Gltf, ual2Gltf] = await Promise.all([
          loadCachedGLTF(loader, '/custom_assets/animations_3d/UAL1_Standard.glb', '/custom_assets/animations/UAL1_Standard.glb'),
          loadCachedGLTF(loader, '/custom_assets/animations_3d/UAL2_Standard.glb', '/custom_assets/animations/UAL2_Standard.glb')
        ]);
        const externalUalClips = [
          ...(ual1Gltf?.animations || []),
          ...(ual2Gltf?.animations || [])
        ];

        // 1. Load Player Character from custom_asset_packs/characters/
        const playerUrl =
          compiledGame?.player_config?.model_url ||
          compiledGame?.player_class_url ||
          '/custom_assets/characters/fantasy_outfits/Male_Ranger.gltf';
        const playerGltf = await loadCachedGLTF(
          loader,
          playerUrl,
          '/custom_assets/characters/Knight.glb'
        );
        if (isDisposed) return;

        const playerModel = SkeletonUtils.clone(playerGltf.scene);
        const hiddenDuplicateMeshes = new Set([
          '1H_Sword_Offhand',
          'Rectangle_Shield',
          'Round_Shield',
          'Spike_Shield',
          '2H_Sword'
        ]);
        const targetHandBoneName = compiledGame?.player_config?.right_hand_bone || 'hand_r';
        let foundHandBone = null;

        playerModel.traverse((child) => {
          if (hiddenDuplicateMeshes.has(child.name)) {
            child.visible = false;
          }
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
          const cn = (child.name || '').toLowerCase();
          if (
            child.name === targetHandBoneName ||
            cn === 'hand_r' ||
            cn === 'hand.r' ||
            cn === 'handslot.r' ||
            cn === 'handslot_r' ||
            cn.includes('righthand')
          ) {
            if (!foundHandBone || child.name === targetHandBoneName) {
              foundHandBone = child;
            }
          }
        });

        normalizeAndSnapToFloor(playerModel, compiledGame?.player_config?.target_height_m || 1.85);
        s.rightHandBone = foundHandBone;
        playerGroup.add(playerModel);

        const pMixer = new THREE.AnimationMixer(playerModel);
        const pActions = retargetAndBindClips(pMixer, playerGltf.animations, externalUalClips);
        s.playerMixer = pMixer;
        s.playerActions = pActions;
        if (pActions['Idle']) {
          pActions['Idle'].play();
          s.currentPlayerAnim = 'Idle';
        }

        // 2. Build Each Room in the Topological Chain using ModularCastle_AssetPack-Ver2 GLBs
        const torchUrl =
          roomsToBuild[0]?.torch_asset_url ||
          '/custom_assets/environments/ModularCastle_AssetPack/Props/Lighting_Fixtures/Wall_Holder_Torch.glb';
        const torchGltf = await loadCachedGLTF(loader, torchUrl);

        for (let rIdx = 0; rIdx < roomsToBuild.length; rIdx++) {
          if (isDisposed) return;
          const room = roomsToBuild[rIdx];
          setLoadingProgress(`Constructing Room ${rIdx + 1}/${roomsToBuild.length}: ${room.name}...`);

          const rw = room.width || 16;
          const rd = room.depth || 16;
          const ox = room.offset_x || 0;
          const oz = room.offset_z !== undefined ? room.offset_z : -(rIdx * 16 + 8);
          const halfW = rw / 2;
          const halfD = rd / 2;
          const minX = ox - halfW;
          const maxX = ox + halfW;
          const minZ = oz - halfD;
          const maxZ = oz + halfD;

          s.roomCenters.push({
            roomIndex: rIdx,
            name: room.name,
            isBossArena: Boolean(room.is_boss_arena),
            center: new THREE.Vector3(ox, 0, oz),
            minZ,
            maxZ,
            lighting: room.lighting
          });

          const defaultFloorUrl = '/custom_assets/environments/ModularCastle_AssetPack/Floors&Ramps/Floors/Floor_2x2.glb';
          const defaultWallUrl = '/custom_assets/environments/ModularCastle_AssetPack/Walls/Walls_Variable_Height/Wall_Mid_x2.glb';
          const defaultPillarUrl = '/custom_assets/environments/ModularCastle_AssetPack/Walls/Wall_Decoration/Arch_Decor_Wide_x2.glb';
          const defaultArchUrl = '/custom_assets/environments/ModularCastle_AssetPack/Walls/Arches/Arch_Segment_Full.glb';
          const defaultGateUrl = '/custom_assets/environments/ModularCastle_AssetPack/Walls/Arches/Arch_Segment_Full_x2.glb';

          const [floorGltf, wallGltf, pillarGltf, doorGltf, gateGltf] = await Promise.all([
            loadCachedGLTF(loader, room.floor_asset_url || defaultFloorUrl, defaultFloorUrl),
            loadCachedGLTF(loader, room.wall_asset_url || defaultWallUrl, defaultWallUrl),
            loadCachedGLTF(loader, room.pillar_asset_url || defaultPillarUrl, defaultPillarUrl),
            loadCachedGLTF(loader, room.doorway_asset_url || defaultArchUrl, defaultArchUrl),
            loadCachedGLTF(loader, room.gate_asset_url || defaultGateUrl, defaultGateUrl)
          ]);

          for (let x = minX + 2; x <= maxX - 2; x += 4) {
            for (let z = minZ + 2; z <= maxZ - 2; z += 4) {
              const tile = floorGltf.scene.clone();
              tile.position.set(x, 0, z);
              tile.traverse((c) => {
                if (c.isMesh) c.receiveShadow = true;
              });
              scene.add(tile);
            }
          }

          for (let z = minZ + 2; z <= maxZ - 2; z += 4) {
            const westWall = wallGltf.scene.clone();
            westWall.position.set(minX, 0, z);
            westWall.rotation.y = Math.PI / 2;
            normalizeAndSnapToFloor(westWall, 4.0);
            scene.add(westWall);

            const eastWall = wallGltf.scene.clone();
            eastWall.position.set(maxX, 0, z);
            eastWall.rotation.y = -Math.PI / 2;
            normalizeAndSnapToFloor(eastWall, 4.0);
            scene.add(eastWall);
          }

          s.wallColliders.push(
            { minX: minX - 0.8, maxX: minX + 0.8, minZ, maxZ },
            { minX: maxX - 0.8, maxX: maxX + 0.8, minZ, maxZ }
          );

          if (rIdx === 0) {
            for (let x = minX + 2; x <= maxX - 2; x += 4) {
              const sw = wallGltf.scene.clone();
              sw.position.set(x, 0, maxZ);
              normalizeAndSnapToFloor(sw, 4.0);
              scene.add(sw);
            }
            s.wallColliders.push({ minX, maxX, minZ: maxZ - 0.8, maxZ: maxZ + 0.8 });
          }

          for (let x = minX + 2; x <= maxX - 2; x += 4) {
            const isDoorSlot = Math.abs(x - ox) < 2.1 && rIdx < roomsToBuild.length - 1;
            if (isDoorSlot) {
              const doorMesh = doorGltf.scene.clone();
              doorMesh.position.set(x, 0, minZ);
              normalizeAndSnapToFloor(doorMesh, 4.2);
              scene.add(doorMesh);

              const gateMesh = gateGltf.scene.clone();
              gateMesh.position.set(x, 0, minZ);
              normalizeAndSnapToFloor(gateMesh, 3.8);
              scene.add(gateMesh);

              const colliderIndex = s.wallColliders.length;
              s.wallColliders.push({
                minX: x - 2.0,
                maxX: x + 2.0,
                minZ: minZ - 0.6,
                maxZ: minZ + 0.6,
                disabled: false
              });
              s.gates.push({
                roomIndex: rIdx,
                mesh: gateMesh,
                baseY: gateMesh.position.y,
                opened: false,
                colliderIndex
              });
            } else {
              const nw = wallGltf.scene.clone();
              nw.position.set(x, 0, minZ);
              normalizeAndSnapToFloor(nw, 4.0);
              scene.add(nw);
              s.wallColliders.push({
                minX: x - 2.0,
                maxX: x + 2.0,
                minZ: minZ - 0.7,
                maxZ: minZ + 0.7
              });
            }
          }

          const corners = [
            [minX + 0.8, minZ + 0.8],
            [maxX - 0.8, minZ + 0.8],
            [minX + 0.8, maxZ - 0.8],
            [maxX - 0.8, maxZ - 0.8]
          ];
          corners.forEach(([cx, cz]) => {
            const pil = pillarGltf.scene.clone();
            pil.position.set(cx, 0, cz);
            normalizeAndSnapToFloor(pil, 4.2);
            scene.add(pil);
            s.wallColliders.push({
              minX: cx - 0.75,
              maxX: cx + 0.75,
              minZ: cz - 0.75,
              maxZ: cz + 0.75,
              disabled: false
            });
          });

          const torchHex = new THREE.Color(room.lighting?.torch_color_hex || '#ff7b29');
          const torchSpots = [
            [minX + 0.6, oz - 3, Math.PI / 2],
            [maxX - 0.6, oz - 3, -Math.PI / 2],
            [minX + 0.6, oz + 3, Math.PI / 2],
            [maxX - 0.6, oz + 3, -Math.PI / 2]
          ];
          torchSpots.forEach(([tx, tz, rotY], tIdx) => {
            const tMesh = torchGltf.scene.clone();
            tMesh.position.set(tx, 2.2, tz);
            tMesh.rotation.y = rotY;
            scene.add(tMesh);

            if (tIdx < 2) {
              const pLight = new THREE.PointLight(torchHex, 3.2, 16, 1.6);
              pLight.position.set(tx + (tx < ox ? 0.6 : -0.6), 2.6, tz);
              scene.add(pLight);
              s.torchLights.push({ light: pLight, baseIntensity: 3.2, phase: rIdx * 2 + tIdx });
            }
          });

          for (const prop of (room.props || [])) {
            try {
              const pGltf = await loadCachedGLTF(
                loader,
                prop.asset_url || '/custom_assets/weapons_and_items/chest_gold.glb',
                '/custom_assets/weapons_and_items/chest_gold.glb'
              );
              const pMesh = pGltf.scene.clone();
              const wx = ox + (prop.x || 0);
              const wz = oz + (prop.z || 0);
              pMesh.position.set(wx, 0, wz);
              pMesh.rotation.y = prop.rot_y || 0;
              normalizeAndSnapToFloor(pMesh, null);
              pMesh.traverse((c) => {
                if (c.isMesh) {
                  c.castShadow = true;
                  c.receiveShadow = true;
                }
              });
              scene.add(pMesh);
              s.roomProps.push({
                roomIndex: rIdx,
                name: prop.asset || 'Dungeon Prop',
                mesh: pMesh,
                tag: prop.interactive_tag || 'movable_prop'
              });

              if (prop.interactive_tag === 'mechanical_lever') {
                const labelSprite = createTextSprite('⚙️ Heavy Lever', 'Press [E] to Lift Gate', '#38bdf8');
                labelSprite.position.set(0, 2.0, 0);
                pMesh.add(labelSprite);
                s.levers.push({
                  propId: prop.prop_id || `lever_${rIdx}`,
                  roomIndex: rIdx,
                  mesh: pMesh,
                  pos: new THREE.Vector3(wx, 0, wz),
                  linkedGateId: prop.linked_gate_id || `gate_room_${rIdx + 1}`,
                  pulled: false,
                  label: prop.label || 'Pull Bronze Lever'
                });
                s.wallColliders.push({
                  minX: wx - 0.7,
                  maxX: wx + 0.7,
                  minZ: wz - 0.7,
                  maxZ: wz + 0.7,
                  disabled: false
                });
              } else if (prop.interactive_tag === 'treasure_chest') {
                const aura = createBattleFxAuraMesh('#fbbf24', 0.95);
                aura.position.set(0, 0.65, 0);
                pMesh.add(aura);
                const labelSprite = createTextSprite('💰 Treasure Chest', `Press [E] (+${prop.gold_reward || 10} Gold)`, '#fbbf24');
                labelSprite.position.set(0, 2.0, 0);
                pMesh.add(labelSprite);
                const chestColIdx = s.wallColliders.length;
                s.wallColliders.push({
                  minX: wx - 0.95,
                  maxX: wx + 0.95,
                  minZ: wz - 0.95,
                  maxZ: wz + 0.95,
                  disabled: false
                });
                s.chests.push({
                  propId: prop.prop_id || `chest_${rIdx}`,
                  roomIndex: rIdx,
                  mesh: pMesh,
                  pos: new THREE.Vector3(wx, 0, wz),
                  goldReward: prop.gold_reward || 10,
                  opened: false,
                  colliderIndex: chestColIdx
                });
              } else if (prop.interactive_tag === 'survey_forge') {
                const auraColor = (prop.cost_gold || 10) >= 10 ? '#eab308' : '#f97316';
                const aura = createBattleFxAuraMesh(auraColor, 1.1);
                aura.position.set(0, 0.65, 0);
                pMesh.add(aura);
                const forgeLabel = createTextSprite(`⚒️ Forge: ${prop.tier_name || 'Relic Forge'}`, `Press [E] (${prop.cost_gold || 10} Gold)`, auraColor);
                forgeLabel.position.set(0, 2.2, 0);
                pMesh.add(forgeLabel);
                s.wallColliders.push({
                  minX: wx - 1.1,
                  maxX: wx + 1.1,
                  minZ: wz - 1.1,
                  maxZ: wz + 1.1,
                  disabled: false
                });
                s.forges.push({
                  propId: prop.prop_id || `forge_${rIdx}`,
                  roomIndex: rIdx,
                  mesh: pMesh,
                  pos: new THREE.Vector3(wx, 0, wz),
                  tier: prop.tier_name || 'Sovereign Tier',
                  cost: prop.cost_gold || 10,
                  weaponId: prop.weapon_id,
                  weaponName: prop.weapon_name || prop.tier_name
                });
              } else if (prop.interactive_tag === 'flammable_barrel' || (prop.asset && prop.asset.toLowerCase().includes('barrel'))) {
                const aura = createBattleFxAuraMesh('#ef4444', 0.85);
                aura.position.set(0, 0.75, 0);
                pMesh.add(aura);

                const labelSprite = createTextSprite('🔥 Alchemical Barrel', 'Attack or Press [1] to Ignite', '#ef4444');
                labelSprite.position.set(0, 2.4, 0);
                pMesh.add(labelSprite);
                const bColIdx = s.wallColliders.length;
                s.wallColliders.push({
                  minX: wx - 0.8,
                  maxX: wx + 0.8,
                  minZ: wz - 0.8,
                  maxZ: wz + 0.8,
                  disabled: false
                });
                s.barrels.push({
                  roomIndex: rIdx,
                  mesh: pMesh,
                  pos: new THREE.Vector3(wx, 0, wz),
                  exploded: false,
                  colliderIndex: bColIdx
                });
              } else if (prop.interactive_tag === 'loot_shrine') {
                const aura = createBattleFxAuraMesh('#f59e0b', 0.95);
                aura.position.set(0, 0.65, 0);
                pMesh.add(aura);

                const labelSprite = createTextSprite('🔥 Covenant Shrine & Vault', 'Press [F] for Covenant Vow', '#f59e0b');
                labelSprite.position.set(0, 2.0, 0);
                pMesh.add(labelSprite);
                s.wallColliders.push({
                  minX: wx - 0.9,
                  maxX: wx + 0.9,
                  minZ: wz - 0.9,
                  maxZ: wz + 0.9,
                  disabled: false
                });
              } else {
                s.wallColliders.push({
                  minX: wx - 0.75,
                  maxX: wx + 0.75,
                  minZ: wz - 0.75,
                  maxZ: wz + 0.75,
                  disabled: false
                });
              }
            } catch (e) {}
          }

          if (room.npc) {
            try {
              const npcGltf = await loadCachedGLTF(
                loader,
                room.npc.asset_url || '/custom_assets/characters/fantasy_outfits/Female_Ranger.gltf',
                '/custom_assets/characters/Mage.glb'
              );
              const npcMesh = SkeletonUtils.clone(npcGltf.scene);
              const nx = ox + (room.npc.x || -4.0);
              const nz = oz + (room.npc.z || 1.5);
              npcMesh.position.set(nx, 0, nz);
              npcMesh.rotation.y = Math.PI / 4;
              normalizeAndSnapToFloor(npcMesh, 1.85);
              npcMesh.traverse((c) => {
                if (hiddenDuplicateMeshes.has(c.name)) c.visible = false;
                if (c.isMesh) {
                  c.castShadow = true;
                  c.receiveShadow = true;
                }
              });

              const npcLabel = createTextSprite(`💬 ${room.npc.name}`, 'Press [E] for D20 Parley', '#38bdf8');
              npcLabel.position.set(0, 2.5, 0);
              npcMesh.add(npcLabel);
              scene.add(npcMesh);

              const npcMixer = new THREE.AnimationMixer(npcMesh);
              const npcActions = retargetAndBindClips(npcMixer, npcGltf.animations, externalUalClips);
              const idleAction = npcActions[room.npc.idle_anim] || npcActions['Idle_Talking_Loop'] || npcActions['Idle'];
              if (idleAction) idleAction.play();

              s.npcs.push({
                roomIndex: rIdx,
                mesh: npcMesh,
                mixer: npcMixer,
                pos: new THREE.Vector3(nx, 0, nz),
                data: room.npc
              });
            } catch (e) {}
          }

          for (const enemyCfg of (room.enemies || [])) {
            try {
              const enGltf = await loadCachedGLTF(
                loader,
                enemyCfg.asset_url || '/custom_assets/characters/Skeleton_Warrior.glb',
                '/custom_assets/characters/Skeleton_Warrior.glb'
              );
              const enMesh = SkeletonUtils.clone(enGltf.scene);
              const ex = ox + (enemyCfg.x || 2.5);
              const ez = oz + (enemyCfg.z || 0.0);
              enMesh.position.set(ex, 0, ez);
              normalizeAndSnapToFloor(enMesh, enemyCfg.target_height_m || (enemyCfg.is_boss ? 2.65 : 1.9));
              enMesh.traverse((c) => {
                if (hiddenDuplicateMeshes.has(c.name)) c.visible = false;
                if (c.isMesh) {
                  c.castShadow = true;
                  c.receiveShadow = true;
                }
              });

              if (enemyCfg.is_boss) {
                const bossAura = createBattleFxAuraMesh('#a855f7', 1.35);
                bossAura.position.set(0, 1.1, 0);
                enMesh.add(bossAura);
              }

              const badgeColor = enemyCfg.is_boss ? '#ef4444' : '#f59e0b';
              const enSprite = createTextSprite(
                `${enemyCfg.is_boss ? '💀 ' : '⚔ '}${enemyCfg.name}`,
                `HP: ${enemyCfg.hp} | Poise: ${enemyCfg.poise} | VFX: ${enemyCfg.vfx_id || 'slash'}`,
                badgeColor
              );
              enSprite.position.set(0, 2.7, 0);
              enMesh.add(enSprite);
              scene.add(enMesh);

              const enMixer = new THREE.AnimationMixer(enMesh);
              const enActions = retargetAndBindClips(enMixer, enGltf.animations, externalUalClips);
              if (enActions['Idle']) {
                enActions['Idle'].play();
              }

              s.enemies.push({
                id: enemyCfg.enemy_id,
                roomIndex: rIdx,
                name: enemyCfg.name,
                isBoss: Boolean(enemyCfg.is_boss),
                questionId: enemyCfg.question_id,
                mappedOption: enemyCfg.mapped_option || 'Aggressive Combat Resolution',
                mesh: enMesh,
                sprite: enSprite,
                mixer: enMixer,
                actions: enActions,
                currentAnim: 'Idle',
                pos: enMesh.position,
                spawnPos: new THREE.Vector3(ex, 0, ez),
                patrolAngle: Math.random() * Math.PI * 2,
                hp: enemyCfg.hp || 120,
                maxHp: enemyCfg.max_hp || enemyCfg.hp || 120,
                poise: enemyCfg.poise || 60,
                maxPoise: enemyCfg.max_poise || enemyCfg.poise || 60,
                speed: enemyCfg.speed || 3.2,
                damage: enemyCfg.damage || 15,
                attackAnim: enemyCfg.attack_anim || '1H_Melee_Attack_Slice_Diagonal',
                state: 'PATROL',
                stateTimer: 0,
                pacified: false
              });
            } catch (e) {}
          }
        }

        if (s.enemies.length > 0) {
          const bossOrFirst = s.enemies.find(e => e.isBoss) || s.enemies[0];
          setBossHealth(bossOrFirst.hp);
          setBossMaxHealth(bossOrFirst.maxHp || 140);
          setBossPoise(bossOrFirst.poise);
          setBossMaxPoise(bossOrFirst.maxPoise || 80);
          setBossStaggered(false);
          setActiveBossData({
            name: bossOrFirst.name.toUpperCase(),
            targetMetric: 'executive_crisis_decision_making'
          });
        }

        setIsReady(true);
        setLoadingProgress('');
      } catch (err) {
        console.error('Error building KayKit 3D dungeon:', err);
        setLoadingProgress('');
      }
    };

    buildKayKitWorld();

    // Input Listeners (Full CRPG / Dark Souls / Ultima Controls)
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'i') {
        setIsInventoryOpen(prev => !prev);
        return;
      }
      if (k === 'b') {
        triggerBossCutscene();
        return;
      }
      if (k === 'f') {
        setEstusCharges(3);
        setCovenantModalOpen(prev => !prev);
        return;
      }
      if (s.cutsceneTimer > 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        triggerDodgeRoll();
      } else if (['w', 'a', 's', 'd'].includes(k)) {
        s.keys[k] = true;
        s.targetWaypoint = null;
      } else if (k === 'e') {
        // 1. Check for mechanical lever
        const closeLever = s.levers.find(l => l.pos.distanceTo(s.playerPos) < 3.8 && !l.pulled);
        if (closeLever) {
          closeLever.pulled = true;
          if (closeLever.mesh) closeLever.mesh.rotation.x += 0.85;
          const targetGate = s.gates.find(g => !g.opened);
          if (targetGate) {
            targetGate.opened = true;
            if (targetGate.colliderIndex !== undefined && s.wallColliders[targetGate.colliderIndex]) {
              s.wallColliders[targetGate.colliderIndex].disabled = true;
            }
          }
          sendTelemetry('PORTCULLIS_LEVER_PULLED', closeLever.propId, 'Lever Mechanism Pulled', 2.0);
          showBark('Mechanism Activated', '⚙️ The heavy bronze lever engages! Portcullis gate lifted North.');
          setParryStatusBanner('⚙️ Portcullis Gate Raised! Passage Unlocked!');
          setTimeout(() => setParryStatusBanner(null), 3000);
          return;
        }

        // 2. Check for treasure chest
        const closeChest = s.chests.find(c => c.pos.distanceTo(s.playerPos) < 3.5 && !c.opened);
        if (closeChest) {
          closeChest.opened = true;
          closeChest.mesh.traverse(child => {
            if (child.name.toLowerCase().includes('lid') || child.name.toLowerCase().includes('top')) {
              child.rotation.x = -Math.PI / 2.5;
            }
          });
          const goldGained = closeChest.goldReward || 10;
          s.playerGold = (s.playerGold || 0) + goldGained;
          setPlayerGold(s.playerGold);
          if (compiledGame?.weapons?.length > 1) {
            const bonusW = compiledGame.weapons[1];
            spawnLootDropAndGrantRelic(closeChest.pos.clone().add(new THREE.Vector3(0, 0, 1.2)), bonusW.name, 'chest_loot', 1);
          }
          sendTelemetry('TREASURE_CHEST_OPENED', closeChest.propId, `Looted ${goldGained} Gold`, 1.5);
          showBark('Treasure Looted', `💰 Ancient Chest opened! Found +${goldGained} Gold!`);
          setParryStatusBanner(`💰 +${goldGained} Gold Collected! Total: ${s.playerGold} Gold`);
          setTimeout(() => setParryStatusBanner(null), 3000);
          return;
        }

        // 3. Check for survey forge anvil
        const closeForge = s.forges.find(f => f.pos.distanceTo(s.playerPos) < 3.8);
        if (closeForge) {
          if ((s.playerGold || 0) >= closeForge.cost) {
            s.playerGold -= closeForge.cost;
            setPlayerGold(s.playerGold);
            if (closeForge.weaponId && compiledGame?.weapons && onSelectWeapon) {
              const forgedW = compiledGame.weapons.find(w => w.weapon_id === closeForge.weaponId) || compiledGame.weapons[0];
              onSelectWeapon(forgedW);
            }
            sendTelemetry('SURVEY_FORGE_PURCHASE', closeForge.propId, `${closeForge.tier} ($${closeForge.cost}) - ${closeForge.weaponName}`, 2.5);
            showBark('Blacksmith Anvil', `✨ Forged ${closeForge.weaponName}! Cost: ${closeForge.cost} Gold. Commitment logged!`);
            setParryStatusBanner(`✨ Forged ${closeForge.tier} Weapon! Commitment Recorded!`);
            setTimeout(() => setParryStatusBanner(null), 3500);
          } else {
            showBark('Blacksmith Anvil', `⚠️ Insufficient Gold! Requires ${closeForge.cost} Gold. Current: ${s.playerGold || 0} Gold. Search dungeon chests!`);
            setParryStatusBanner(`⚠️ Need ${closeForge.cost} Gold! Current: ${s.playerGold || 0} Gold`);
            setTimeout(() => setParryStatusBanner(null), 3000);
          }
          return;
        }

        // 4. Check for NPC or Covenant Shrine
        const closeNpc = s.npcs.find(n => n.pos.distanceTo(s.playerPos) < 4.2);
        if (closeNpc) {
          setActiveDialogueNPC(closeNpc.data);
        } else {
          setCovenantModalOpen(true);
        }
      } else if (k === 'q') {
        toggleTargetLockOn();
      } else if (k === 'r') {
        triggerEstusHeal();
      } else if (k === 'g') {
        toggleGrabProp();
      } else if (e.key === '1') {
        solveRoomAffordance('BURN');
      } else if (e.key === '2') {
        solveRoomAffordance('LOCKPICK');
      } else if (e.key === '3') {
        if (s.gameMode === 'IMMERSIVE_SIM' || compiledGame?.style_mode === 'ULTIMA_IMMERSIVE_SANDBOX') {
          toggleRoomTorches();
        } else {
          solveRoomAffordance('BRIBE');
        }
      }
    };

    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        s.keys[k] = false;
      }
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const onMouseDown = (e) => {
      if (s.cutsceneTimer > 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (e.button === 1) {
        e.preventDefault();
        toggleTargetLockOn();
        return;
      }

      if ((s.gameMode === 'CRPG_ISOMETRIC' || compiledGame?.style_mode === 'BALDURS_GATE_CRPG') && e.button === 0 && !e.shiftKey) {
        raycaster.setFromCamera(mouse, camera);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          s.targetWaypoint = hitPoint.clone();
          navRing.position.set(hitPoint.x, 0.06, hitPoint.z);
          navRing.visible = true;
        }
      } else {
        if (e.button === 2) {
          triggerParry();
        } else if (e.button === 0) {
          triggerAttack(e.shiftKey ? 'HEAVY' : 'LIGHT');
        }
      }
    };

    const onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const canMoveTo = (nx, nz) => {
      const radius = 0.55;
      for (const box of s.wallColliders) {
        if (box.disabled) continue;
        if (
          nx + radius > box.minX &&
          nx - radius < box.maxX &&
          nz + radius > box.minZ &&
          nz - radius < box.maxZ
        ) {
          return false;
        }
      }
      return true;
    };

    const clock = new THREE.Clock();
    let animFrameId = null;

    const animate = () => {
      if (isDisposed) return;
      animFrameId = requestAnimationFrame(animate);

      const rawDt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (s.hitstopTimer > 0) {
        s.hitstopTimer -= rawDt;
        composer.render();
        return;
      }
      const dt = rawDt;

      // 1. Flicker PointLights, Rotate Loot Pillars & Open Unlocked Gates
      s.torchLights.forEach((tl) => {
        tl.light.intensity = tl.baseIntensity + Math.sin(elapsed * 9.0 + tl.phase) * 0.45;
      });
      s.gates.forEach((g) => {
        if (g.opened && g.mesh.position.y < 3.6) {
          g.mesh.position.y += dt * 3.5;
        }
      });
      s.lootDrops.forEach((ld, idx) => {
        ld.group.rotation.y += dt * 1.4;
        if (ld.beam) {
          ld.beam.material.opacity = 0.25 + Math.sin(elapsed * 4.0 + idx) * 0.12;
        }
      });

      // Update interactive HUD prompt
      const nearLev = s.levers.find(l => l.pos.distanceTo(s.playerPos) < 3.5 && !l.pulled);
      const nearCh = s.chests.find(c => c.pos.distanceTo(s.playerPos) < 3.5 && !c.opened);
      const nearFg = s.forges.find(f => f.pos.distanceTo(s.playerPos) < 3.5);
      const nearNpc = s.npcs.find(n => n.pos.distanceTo(s.playerPos) < 4.0);

      let curPrompt = null;
      if (nearLev) curPrompt = '⚙️ [E] Pull Heavy Bronze Lever (Raises Portcullis)';
      else if (nearCh) curPrompt = `💰 [E] Open Treasure Chest (+${nearCh.goldReward} Gold)`;
      else if (nearFg) curPrompt = `⚒️ [E] Forge: ${nearFg.tier} (${nearFg.cost} Gold)`;
      else if (nearNpc) curPrompt = `💬 [E] Parley with ${nearNpc.data.name}`;
      setInteractPrompt(curPrompt);

      // 2. Determine Current Room, Fog-of-War & Auto-Trigger Boss Cutscene on Boss Room Entry
      for (const rc of s.roomCenters) {
        if (s.playerPos.z <= rc.maxZ && s.playerPos.z >= rc.minZ) {
          if (s.activeRoomIdx !== rc.roomIndex) {
            s.activeRoomIdx = rc.roomIndex;
            s.visitedRooms.add(rc.roomIndex);
            setActiveRoomIndex(rc.roomIndex);

            if (rc.lighting?.fog_hex) {
              const targetFog = new THREE.Color(rc.lighting.fog_hex);
              scene.background.lerp(targetFog, 0.35);
              scene.fog.color.lerp(targetFog, 0.35);
            }

            // Trigger 3.5s Boss Arena Intro Cutscene when crossing threshold into Boss Room
            if (rc.isBossArena && !s.bossIntroPlayedRooms.has(rc.roomIndex)) {
              s.bossIntroPlayedRooms.add(rc.roomIndex);
              const bossInRoom = s.enemies.find(e => e.roomIndex === rc.roomIndex && e.state !== 'DEAD');
              if (bossInRoom) {
                triggerBossCutscene(bossInRoom);
              }
            }
          }
          break;
        }
      }

      // 3. Handle 3.5s Boss Cutscene Camera Swoop Trajectory
      if (s.cutsceneTimer > 0 && s.cutsceneBoss) {
        s.cutsceneTimer -= dt;
        const progress = 1.0 - Math.max(0, s.cutsceneTimer / 3.5); // 0 -> 1 over 3.5s
        const orbitAngle = -Math.PI * 0.15 + progress * (Math.PI * 0.25); // 45-degree dramatic orbit
        const dist = 6.2 - progress * 2.1; // Swoop in closer to Boss
        const bPos = s.cutsceneBoss.pos;

        const swoopCamPos = new THREE.Vector3(
          bPos.x + Math.sin(orbitAngle) * dist,
          1.85 + Math.sin(progress * Math.PI) * 0.6,
          bPos.z + Math.cos(orbitAngle) * dist
        );
        camera.position.lerp(swoopCamPos, 0.12);
        camera.lookAt(bPos.x, bPos.y + 1.65, bPos.z);

        if (s.playerMixer) s.playerMixer.update(dt);
        s.enemies.forEach(en => en.mixer && en.mixer.update(dt));
        s.npcs.forEach(n => n.mixer && n.mixer.update(dt));

        if (s.cutsceneTimer <= 0) {
          setIsCutsceneActive(false);
        }
        composer.render();
        return;
      }

      // 4. Player Movement & Animation State
      let moveVec = new THREE.Vector3();
      if (s.keys.w) moveVec.z -= 1;
      if (s.keys.s) moveVec.z += 1;
      if (s.keys.a) moveVec.x -= 1;
      if (s.keys.d) moveVec.x += 1;

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        s.playerYaw = Math.atan2(moveVec.x, moveVec.z);
      } else if (s.targetWaypoint) {
        const toTarget = new THREE.Vector3().subVectors(s.targetWaypoint, s.playerPos);
        toTarget.y = 0;
        if (toTarget.length() > 0.35) {
          toTarget.normalize();
          moveVec.copy(toTarget);
          s.playerYaw = Math.atan2(moveVec.x, moveVec.z);
        } else {
          s.targetWaypoint = null;
          navRing.visible = false;
        }
      }

      const speedMult = Number(compiledGame?.custom_mechanics?.movement_speed_mult || 1.0);
      const speed = (s.isRolling ? 8.2 : s.isAttacking ? 1.8 : 5.4) * speedMult;
      if (moveVec.lengthSq() > 0 || s.isRolling) {
        const dir = s.isRolling ? new THREE.Vector3(Math.sin(s.playerYaw), 0, Math.cos(s.playerYaw)) : moveVec;
        const nextX = s.playerPos.x + dir.x * speed * dt;
        const nextZ = s.playerPos.z + dir.z * speed * dt;
        if (canMoveTo(nextX, s.playerPos.z)) s.playerPos.x = nextX;
        if (canMoveTo(s.playerPos.x, nextZ)) s.playerPos.z = nextZ;
      }

      playerGroup.position.copy(s.playerPos);
      playerGroup.rotation.y = s.playerYaw;

      if (s.isRolling) {
        s.rollTimer -= dt;
        if (s.rollTimer <= 0) {
          s.isRolling = false;
          setIsInvincible(false);
        }
      }

      if (s.isAttacking) {
        s.attackTimer -= dt;
        const reachBonus = (selectedWeapon?.procedural_spec?.blade_length || 1.25) * 2.55;
        if (!s.hitAppliedThisSwing && s.attackTimer < 0.42 && s.attackTimer > 0.12) {
          const weaponDmg = (selectedWeapon?.base_damage || 65) * (s.attackType === 'HEAVY' ? 1.45 : 1.0);
          const poiseDmg = (selectedWeapon?.poise_damage || 75) * (s.attackType === 'HEAVY' ? 1.5 : 1.0);

          s.enemies.forEach((en) => {
            if (en.state === 'DEAD') return;
            const dist = en.pos.distanceTo(s.playerPos);
            if (dist <= reachBonus) {
              s.hitAppliedThisSwing = true;
              en.hp = Math.max(0, en.hp - weaponDmg);
              en.poise = Math.max(0, en.poise - poiseDmg);

              const hitstopMs = videoAnalysis?.combat_metadata?.hitstop_duration_ms || 70;
              s.hitstopTimer = hitstopMs / 1000.0;
              s.shakeIntensity = 0.32;
              setShowBossBar(true);
              setActiveBossData({
                name: en.name.toUpperCase(),
                targetMetric: 'combat_risk_resolution'
              });

              if (en.hp <= 0) {
                en.state = 'DEAD';
                playCharacterAnim(
                  en.actions,
                  { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
                  en.actions['Death_A'] ? 'Death_A' : 'Lie_Down',
                  true,
                  1.0
                );
                unlockRoomGate(en.roomIndex, `Defeating ${en.name}`);
                spawnLootDropAndGrantRelic(en.pos.clone(), en.name, en.questionId, en.isBoss ? 0 : 1);
                sendTelemetry('COMBAT_KILL', en.questionId || 'q1_risk', en.mappedOption, 1.45);
                setCombatLog(prev => [`💀 SLAIN: ${en.name} defeated in Room ${en.roomIndex + 1}! Relic Dropped!`, ...prev]);
              } else if (en.poise <= 0) {
                en.state = 'STAGGER';
                en.stateTimer = 2.2;
                en.poise = en.maxPoise;
                playCharacterAnim(
                  en.actions,
                  { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
                  en.actions['Hit_B'] ? 'Hit_B' : 'Hit_A',
                  true,
                  0.85
                );
                setCombatLog(prev => [`⚡ POISE BROKEN: ${en.name} staggered!`, ...prev]);
              } else {
                playCharacterAnim(
                  en.actions,
                  { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
                  'Hit_A',
                  true,
                  1.2
                );
                setCombatLog(prev => [`⚔ Hit ${en.name} for ${Math.round(weaponDmg)} DMG!`, ...prev]);
              }

              setBossHealth(en.hp);
              setBossMaxHealth(en.maxHp || 140);
              setBossPoise(en.poise);
              setBossMaxPoise(en.maxPoise || 80);
              setBossStaggered(en.state === 'STAGGER');
            }
          });

          // Check for explosive barrel hits
          s.barrels.forEach((b) => {
            if (!b.exploded && b.pos.distanceTo(s.playerPos) <= reachBonus + 0.6) {
              b.exploded = true;
              b.mesh.visible = false;
              if (b.colliderIndex !== undefined && s.wallColliders[b.colliderIndex]) {
                s.wallColliders[b.colliderIndex].disabled = true;
              }
              s.enemies.forEach((en) => {
                if (en.pos.distanceTo(b.pos) < 5.0 && en.state !== 'DEAD') {
                  en.hp = Math.max(0, en.hp - 80);
                  en.poise = 0;
                  en.state = en.hp <= 0 ? 'DEAD' : 'STAGGER';
                }
              });
              sendTelemetry('BARREL_IGNITED', 'barrel_melee_strike', 'Alchemical Barrel Struck & Detonated', 1.8);
              setParryStatusBanner('💥 BOOM! Barrel Detonated! Barricade Cleared!');
              setTimeout(() => setParryStatusBanner(null), 2500);
            }
          });
        }

        if (s.attackTimer <= 0) {
          s.isAttacking = false;
          setIsAttacking(false);
        }
      }

      if (!s.isRolling && !s.isAttacking && s.playerActions) {
        const desired = moveVec.lengthSq() > 0.01 ? 'Running_A' : 'Idle';
        playCharacterAnim(
          s.playerActions,
          { get current() { return s.currentPlayerAnim; }, set current(v) { s.currentPlayerAnim = v; } },
          desired,
          false,
          1.05
        );
      }

      if (!s.isRolling && !s.isAttacking && s.stamina < 100) {
        s.stamina = Math.min(100, s.stamina + dt * 22);
        setStamina(s.stamina);
      }

      if (s.playerMixer) s.playerMixer.update(dt);
      s.npcs.forEach(n => n.mixer && n.mixer.update(dt));

      const foundNpc = s.npcs.find(n => n.pos.distanceTo(s.playerPos) < 3.8);
      setNearbyNPC(foundNpc ? foundNpc.data : null);
      setNearbyPuzzleRoom(compiledGame?.rooms?.[s.activeRoomIdx] || null);

      // 5. Update Enemy AI State Machine
      s.enemies.forEach((en) => {
        if (en.mixer) en.mixer.update(dt);
        if (en.state === 'DEAD' || en.pacified) return;

        const distToPlayer = en.pos.distanceTo(s.playerPos);

        if (en.state === 'STAGGER') {
          en.stateTimer -= dt;
          if (en.stateTimer <= 0) {
            en.state = 'AGGRO';
            setBossStaggered(false);
          }
          return;
        }

        if (en.state === 'WINDUP') {
          en.stateTimer -= dt;
          const lookYaw = Math.atan2(s.playerPos.x - en.pos.x, s.playerPos.z - en.pos.z);
          en.mesh.rotation.y = lookYaw;
          if (en.stateTimer <= 0) {
            en.state = 'ATTACK';
            en.stateTimer = 0.55;
            playCharacterAnim(
              en.actions,
              { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
              en.actions[en.attackAnim] ? en.attackAnim : '1H_Melee_Attack_Slice_Diagonal',
              true,
              1.15
            );
            if (distToPlayer <= 2.7 && !s.isRolling) {
              s.playerHP = Math.max(10, s.playerHP - en.damage);
              setPlayerHP(s.playerHP);
              s.shakeIntensity = 0.25;
              setCombatLog(prev => [`🛡 ${en.name} struck you for ${en.damage} DMG! (Space to Dodge)`, ...prev]);
            }
          }
          return;
        }

        if (en.state === 'ATTACK') {
          en.stateTimer -= dt;
          if (en.stateTimer <= 0) {
            en.state = 'AGGRO';
          }
          return;
        }

        if (distToPlayer < 11.0 && en.roomIndex === s.activeRoomIdx) {
          en.state = 'AGGRO';
          const dir = new THREE.Vector3().subVectors(s.playerPos, en.pos);
          dir.y = 0;
          if (distToPlayer > 2.2) {
            dir.normalize();
            en.pos.x += dir.x * en.speed * dt;
            en.pos.z += dir.z * en.speed * dt;
            en.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            playCharacterAnim(
              en.actions,
              { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
              en.actions['Running_A'] ? 'Running_A' : 'Walking_A',
              false,
              1.0
            );
          } else {
            en.state = 'WINDUP';
            en.stateTimer = 0.45;
          }
        } else {
          en.state = 'PATROL';
          en.patrolAngle += dt * 0.8;
          const targetX = en.spawnPos.x + Math.cos(en.patrolAngle) * 1.8;
          const targetZ = en.spawnPos.z + Math.sin(en.patrolAngle) * 1.8;
          const dx = targetX - en.pos.x;
          const dz = targetZ - en.pos.z;
          en.pos.x += dx * dt;
          en.pos.z += dz * dt;
          en.mesh.rotation.y = Math.atan2(dx, dz);
          playCharacterAnim(
            en.actions,
            { get current() { return en.currentAnim; }, set current(v) { en.currentAnim = v; } },
            en.actions['Walking_A'] ? 'Walking_A' : 'Idle',
            false,
            0.85
          );
        }
      });

      // 6. Update Weapon Ribbon Trail
      if (s.rightHandBone && s.trailGeometry) {
        const tipWorld = s.swordTipLocal.clone().applyMatrix4(s.rightHandBone.matrixWorld);
        const baseWorld = s.swordBaseLocal.clone().applyMatrix4(s.rightHandBone.matrixWorld);
        if (s.isAttacking) {
          s.trailPositions.unshift({ tip: tipWorld, base: baseWorld });
          if (s.trailPositions.length > maxTrailPts) s.trailPositions.pop();
        } else if (s.trailPositions.length > 0) {
          s.trailPositions.pop();
        }
        const posAttr = s.trailGeometry.attributes.position;
        for (let i = 0; i < maxTrailPts; i++) {
          const entry = s.trailPositions[i] || s.trailPositions[s.trailPositions.length - 1] || { tip: s.playerPos, base: s.playerPos };
          posAttr.setXYZ(i * 2, entry.tip.x, entry.tip.y, entry.tip.z);
          posAttr.setXYZ(i * 2 + 1, entry.base.x, entry.base.y, entry.base.z);
        }
        posAttr.needsUpdate = true;
      }

      // 7. Standard & Custom Genre Gameplay Camera Follow
      const camMode = compiledGame?.custom_mechanics?.camera_mode;
      let camOffset = new THREE.Vector3(0, 6.2, 8.2);
      if (camMode === 'TOP_DOWN_ARENA') {
        camOffset.set(0, 17.5, 9.2);
      } else if (camMode === 'FIXED_SURVIVAL_HORROR') {
        camOffset.set(2.2, 4.1, 6.0);
      } else if (camMode === 'ISOMETRIC_TACTICAL' || s.gameMode === 'CRPG_ISOMETRIC') {
        camOffset.set(0, 14.5, 11.5);
      } else if (s.gameMode === 'IMMERSIVE_SIM') {
        camOffset.set(0, 4.8, 6.4);
      }
      const desiredCamPos = s.playerPos.clone().add(camOffset);
      if (s.shakeIntensity > 0.01) {
        desiredCamPos.x += (Math.random() - 0.5) * s.shakeIntensity;
        desiredCamPos.y += (Math.random() - 0.5) * s.shakeIntensity;
        s.shakeIntensity *= 0.85;
      }
      camera.position.lerp(desiredCamPos, 0.12);
      camera.lookAt(s.playerPos.x, s.playerPos.y + 1.4, s.playerPos.z - 1.2);

      composer.render();
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [compiledGame?.build_id]);

  const currentRoomObj = compiledGame?.rooms?.[activeRoomIndex] || compiledGame?.rooms?.[0];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#070a12' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Empty State Overlay (Zero Pre-established / Fallback Games) */}
      {(!compiledGame?.rooms || compiledGame.rooms.length === 0) && !loadingProgress && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.92), rgba(7, 10, 18, 0.98))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px',
          textAlign: 'center',
          zIndex: 35
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', background: '#064e3b', border: '1px solid #10b981', padding: '4px 12px', borderRadius: '999px', marginBottom: '12px', letterSpacing: '0.08em' }}>
            OLD PRESETS PURGED • 113 CUSTOM PACK ASSETS READY
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#f8fafc' }}>
            Ready to Compile from <code>custom_asset_packs/</code>
          </h3>
          <p style={{ maxWidth: '520px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px 0' }}>
            All pre-established templates have been removed. Click below (or in the left panel) to compile a fresh 3D dungeon using your <strong>Modular Character Outfits - Fantasy</strong>, <strong>ModularCastle_AssetPack-Ver2</strong>, <strong>Universal Animation Library 1 &amp; 2</strong>, and <strong>BattleFXFree</strong> packs.
          </p>
          {onCompileNow && (
            <button
              onClick={onCompileNow}
              disabled={isCompiling}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '13px',
                cursor: isCompiling ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)'
              }}
            >
              {isCompiling ? '⚙ Compiling Custom Asset Pack World...' : '⚡ Compile Custom Asset Pack Campaign Now'}
            </button>
          )}
        </div>
      )}

      {/* Loading Indicator Overlay */}
      {loadingProgress && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7, 10, 18, 0.86)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30
        }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '8px' }}>
            ⚙ {loadingProgress}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Streaming ModularCastle_AssetPack-Ver2, Fantasy Outfits, UAL1/UAL2 &amp; BattleFXFree Packs
          </div>
        </div>
      )}

      {/* Top-Left Player Vital Gauges & Room HUD */}
      {!isCutsceneActive && (
        <div style={{
          position: 'absolute',
          top: '14px',
          left: '14px',
          background: 'rgba(11, 16, 29, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '10px 14px',
          zIndex: 10,
          minWidth: '340px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: compiledGame?.is_custom_genre ? '#f472b6' : '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Room {activeRoomIndex + 1}/{compiledGame?.rooms?.length || 1} • {compiledGame?.custom_genre || compiledGame?.style_mode || gameMode}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800, background: 'rgba(251, 191, 36, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                💰 {playerGold} Gold
              </span>
              <span style={{ fontSize: '10px', color: '#facc15', fontWeight: 700 }}>
                🧪 Estus [R]: {estusCharges}/3
              </span>
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
            {currentRoomObj?.name || 'Sanctum Chamber'}
          </div>

          {/* HP & Stamina Bars */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, playerHP))}%`, height: '100%', background: 'linear-gradient(90deg, #dc2626, #ef4444)' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, stamina || 100))}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '10px', color: '#94a3b8' }}>
            <span>[WASD] Move</span>
            <span>• [LMB] Attack</span>
            <span>• [Shift+LMB] Heavy</span>
            <span>• [RMB] Parry</span>
            <span>• [Space] Roll</span>
            <button
              onClick={toggleTargetLockOn}
              style={{
                background: lockedTargetName ? '#f8fafc' : '#1e293b',
                color: lockedTargetName ? '#0f172a' : '#cbd5e1',
                border: '1px solid #475569',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🎯 [Q] {lockedTargetName ? `Locked: ${lockedTargetName}` : 'Lock-On'}
            </button>
            <button
              onClick={() => setCovenantModalOpen(true)}
              style={{
                background: '#451a03',
                color: '#fbbf24',
                border: '1px solid #d97706',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔥 [F] Covenant Shrine
            </button>
            <button
              onClick={() => setIsInventoryOpen(prev => !prev)}
              style={{
                background: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #38bdf866',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🎒 [I] Relics ({inventoryItems.length})
            </button>
          </div>
        </div>
      )}

      {/* Parry / Riposte / Tactical Status Banner */}
      {parryStatusBanner && (
        <div style={{
          position: 'absolute',
          top: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid #facc15',
          color: '#fef08a',
          padding: '7px 18px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          boxShadow: '0 8px 25px rgba(0,0,0,0.75)',
          zIndex: 24
        }}>
          {parryStatusBanner}
        </div>
      )}

      {/* Contextual Interaction Pill Prompt ([E] Key) */}
      {interactPrompt && !isCutsceneActive && !activeDialogueNPC && (
        <div style={{
          position: 'absolute',
          bottom: '82px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(11, 16, 29, 0.95)',
          border: '1.5px solid #38bdf8',
          boxShadow: '0 8px 30px rgba(56, 189, 248, 0.35)',
          color: '#f8fafc',
          padding: '8px 22px',
          borderRadius: '999px',
          fontSize: '12.5px',
          fontWeight: 800,
          zIndex: 26,
          pointerEvents: 'none'
        }}>
          {interactPrompt}
        </div>
      )}

      {/* Ultima AI Guard & NPC Dynamic Speech Bark Toast */}
      {barkToast && (
        <div style={{
          position: 'absolute',
          top: '132px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 13, 24, 0.94)',
          border: '1px solid #38bdf8',
          color: '#f8fafc',
          padding: '8px 16px',
          borderRadius: '10px',
          fontSize: '11.5px',
          zIndex: 23,
          boxShadow: '0 10px 28px rgba(0,0,0,0.7)'
        }}>
          <strong style={{ color: '#38bdf8' }}>{barkToast.speaker}:</strong> {barkToast.line}
        </div>
      )}

      {/* Top-Right Topological Dungeon Minimap HUD */}
      {!isCutsceneActive && (
        <DungeonMinimap
          compiledGame={compiledGame}
          radarStateRef={stateRef}
          activeRoomIndex={activeRoomIndex}
          onTeleportToRoom={teleportToRoom}
        />
      )}

      {/* Cinematic Boss Arena Intro Cutscene & Bottom-Screen Boss HP/Poise Gauge */}
      <BossCutsceneOverlay
        isCutsceneActive={isCutsceneActive}
        bossData={activeBossData}
        showBossBar={showBossBar || Boolean(currentRoomObj?.is_boss_arena)}
        bossHealth={bossHealth}
        bossMaxHealth={bossMaxHealth}
        bossPoise={bossPoise}
        bossMaxPoise={bossMaxPoise}
        bossStaggered={bossStaggered}
      />

      {/* Loot Drop Toast & Equipment / Relic Inventory Drawer ([I] Key) */}
      <LootInventoryHUD
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        inventoryItems={inventoryItems}
        selectedWeapon={selectedWeapon}
        onEquipWeapon={(weapon) => {
          if (onSelectWeapon) onSelectWeapon(weapon);
        }}
        recentLootNotification={recentLootNotification}
      />

      {/* BALDUR'S GATE CRPG & CUSTOM GENRE: 5-Ability Action Bar & AP / Movement Budget HUD */}
      {!isCutsceneActive && !activeDialogueNPC && (
        compiledGame?.style_mode === 'BALDURS_GATE_CRPG' ||
        gameMode === 'CRPG_ISOMETRIC' ||
        compiledGame?.is_custom_genre
      ) && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 13, 24, 0.94)',
          backdropFilter: 'blur(10px)',
          border: compiledGame?.is_custom_genre ? '1px solid #ec4899' : '1px solid #6366f1',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.85)',
          zIndex: 16
        }}>
          <div style={{ paddingRight: '10px', borderRight: '1px solid #334155', fontSize: '10px', color: '#cbd5e1' }}>
            <div style={{ fontWeight: 800, color: compiledGame?.is_custom_genre ? '#f472b6' : '#818cf8' }}>
              {compiledGame?.is_custom_genre ? (compiledGame?.custom_genre || 'CUSTOM').slice(0, 14) : `AP: ${apCurrent}/4`}
            </div>
            <div style={{ color: '#34d399' }}>AP: {apCurrent}/4</div>
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
              onClick={() => castCrpgAbility(ab)}
              style={{
                background: '#1e293b',
                border: `1px solid ${ab.color || '#6366f1'}`,
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#f8fafc',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>{ab.icon || '⚡'} {ab.name}</span>
              <span style={{ fontSize: '9px', color: '#94a3b8' }}>{ab.ap_cost || 1} AP</span>
            </button>
          ))}

          <button
            onClick={endCrpgTurn}
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
            ⏳ Recharge AP
          </button>
        </div>
      )}

      {/* ULTIMA SANDBOX & IMMERSIVE SIM: World Object Affordance Bar */}
      {!isCutsceneActive && !activeDialogueNPC && nearbyPuzzleRoom?.immersive_sim_puzzle && (
        <div style={{
          position: 'absolute',
          bottom: '14px',
          left: '14px',
          background: 'rgba(11, 16, 29, 0.92)',
          border: '1px solid #475569',
          borderRadius: '10px',
          padding: '8px 12px',
          maxWidth: '310px',
          zIndex: 12
        }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', marginBottom: '5px' }}>
            ⚡ WORLD AFFORDANCES (CHAMBER {activeRoomIndex + 1}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => solveRoomAffordance('BURN')}
              style={{ textAlign: 'left', fontSize: '10px', padding: '4px 8px', background: '#ef444422', color: '#fca5a5', border: '1px solid #ef444466', borderRadius: '5px', cursor: 'pointer' }}
            >
              🔥 [1] Ignite Barrel → "{nearbyPuzzleRoom.immersive_sim_puzzle.flammable_barrel?.maps_to_option?.slice(0, 28)}"
            </button>
            <button
              onClick={() => solveRoomAffordance('LOCKPICK')}
              style={{ textAlign: 'left', fontSize: '10px', padding: '4px 8px', background: '#38bdf822', color: '#7dd3fc', border: '1px solid #38bdf866', borderRadius: '5px', cursor: 'pointer' }}
            >
              🔑 [2] Pick Gate → "{nearbyPuzzleRoom.immersive_sim_puzzle.locked_gate?.maps_to_option?.slice(0, 28)}"
            </button>
            <button
              onClick={() => solveRoomAffordance('BRIBE')}
              style={{ textAlign: 'left', fontSize: '10px', padding: '4px 8px', background: '#10b98122', color: '#6ee7b7', border: '1px solid #10b98166', borderRadius: '5px', cursor: 'pointer' }}
            >
              💬 [3] Parley Guard → "{nearbyPuzzleRoom.immersive_sim_puzzle.bribe_guard?.maps_to_option?.slice(0, 28)}"
            </button>
            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
              <button
                onClick={toggleGrabProp}
                style={{ flex: 1, fontSize: '9.5px', padding: '3px 6px', background: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer' }}
              >
                🖐 [G] {grabbedPropName ? `Place ${grabbedPropName}` : 'Grab Prop'}
              </button>
              <button
                onClick={toggleRoomTorches}
                style={{ flex: 1, fontSize: '9.5px', padding: '3px 6px', background: '#1e293b', color: '#fde047', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer' }}
              >
                🕯 [Torches: {torchesLit ? 'Lit' : 'Dark'}]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby NPC Interaction Prompt Banner */}
      {nearbyNPC && !activeDialogueNPC && !isCutsceneActive && (
        <div
          onClick={() => setActiveDialogueNPC(nearbyNPC)}
          style={{
            position: 'absolute',
            top: '132px',
            left: '14px',
            background: 'rgba(14, 24, 46, 0.95)',
            border: '1px solid #38bdf8',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '11px',
            color: '#f8fafc',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.7)',
            zIndex: 15
          }}
        >
          💬 Press <strong>[E]</strong> or Click to Parley with <strong>{nearbyNPC.name}</strong>
        </div>
      )}

      {/* DARK SOULS: Bonfire / Covenant Shrine Modal ([F] Key) */}
      {covenantModalOpen && currentRoomObj?.npc && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7, 10, 18, 0.84)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 29
        }}>
          <div style={{
            width: '540px',
            background: '#0f172a',
            border: '1px solid #f59e0b',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em' }}>
                🔥 BONFIRE COVENANT SHRINE • ESTUS REPLENISHED (3/3)
              </span>
              <button
                onClick={() => setCovenantModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
              "{currentRoomObj.npc.question_text}"
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(currentRoomObj.npc.choices || []).map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setEstusCharges(3);
                    stateRef.current.answeredQuestions.add(currentRoomObj.npc.question_id);
                    sendTelemetry('COVENANT_SHRINE', currentRoomObj.npc.question_id, ch.choice_text, ch.metric_delta || 1.3);
                    unlockRoomGate(activeRoomIndex, `Covenant Vow ("${ch.choice_text.slice(0, 24)}")`);
                    spawnLootDropAndGrantRelic(
                      stateRef.current.playerPos.clone().add(new THREE.Vector3(0, 0, -1.8)),
                      ch.choice_text,
                      currentRoomObj.npc.question_id,
                      idx
                    );
                    if (ch.grants_weapon_id && compiledGame?.weapons && onSelectWeapon) {
                      const foundW = compiledGame.weapons.find(w => w.weapon_id === ch.grants_weapon_id);
                      if (foundW) onSelectWeapon(foundW);
                    }
                    setCovenantModalOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: '#1e293b',
                    border: '1px solid #f59e0b66',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <strong style={{ color: '#fbbf24' }}>Pledge {ch.covenant_vow || `Vow ${idx + 1}`}:</strong> {ch.choice_text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BALDUR'S GATE CRPG: Interactive D20 Dialogue & Skill Check Overlay */}
      {activeDialogueNPC && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          right: '16px',
          background: 'rgba(11, 16, 29, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid #38bdf8',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
          zIndex: 28
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>
                {activeDialogueNPC.name} ({activeDialogueNPC.model?.replace('.glb', '')})
              </span>
              <span style={{ fontSize: '11px', color: '#a855f7', marginLeft: '10px', fontWeight: 700 }}>
                🎲 D20 Skill Check Encounter
              </span>
            </div>
            <button
              onClick={() => setActiveDialogueNPC(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ fontSize: '13px', color: '#f1f5f9', marginBottom: '12px', fontStyle: 'italic' }}>
            "{activeDialogueNPC.question_text}"
          </div>

          {/* Animated 3D D20 Dice Roll Widget */}
          {d20RollState && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: '#090d16',
              border: '1px solid #a855f7',
              borderRadius: '10px',
              padding: '10px 16px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 900,
                color: '#fff',
                transform: d20RollState.rolling ? 'rotate(18deg) scale(1.08)' : 'rotate(0deg)',
                transition: 'transform 0.1s ease'
              }}>
                {d20RollState.value}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>
                  Rolling D20 ({d20RollState.skill} vs DC {d20RollState.dc})...
                </div>
                <div style={{ fontSize: '11px', color: d20RollState.rolling ? '#38bdf8' : '#34d399', fontWeight: 700 }}>
                  {d20RollState.rolling ? 'Tumbling polyhedral die...' : `✔ SUCCESS (${d20RollState.value} >= DC ${d20RollState.dc}) — Relic Forged!`}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(activeDialogueNPC.choices || activeDialogueNPC.options?.map(o => ({ choice_text: o, metric_delta: 1.2, skill_check: 'Persuasion [DC 12]', dc: 12, skill_name: 'Persuasion' })) || []).map((ch, idx) => (
              <button
                key={idx}
                disabled={Boolean(d20RollState)}
                onClick={() => rollD20AndSelectChoice(ch, idx, activeDialogueNPC)}
                style={{
                  textAlign: 'left',
                  fontSize: '12px',
                  padding: '8px 12px',
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  cursor: d20RollState ? 'wait' : 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span><strong>{idx + 1}.</strong> {ch.choice_text}</span>
                <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700, background: '#0f172a', padding: '2px 8px', borderRadius: '999px', border: '1px solid #38bdf855' }}>
                  🎲 {ch.skill_check || 'Persuasion [DC 12]'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default GameCanvas3D;
