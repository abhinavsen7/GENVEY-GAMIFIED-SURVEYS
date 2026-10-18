/**
 * GENVEY UNIFIED 3D ACTION GAME ENGINES (Three.js WebGL)
 * ------------------------------------------------------
 * Supports 5 DISTINCT 3D GAMEPLAY WORLDS:
 *  1. `reone_kotor`     -> Star Wars: Knights of the Old Republic Style (reone Odyssey Engine)
 *                          Over-the-shoulder 3rd person, Glowing Plasma Lightsaber, Force Push (Q),
 *                          Force Lightning (E), Star Map & Force Alignment Consoles.
 *  2. `freeablo_diablo` -> Diablo 1 & 2 Dark Gothic ARPG (Freeablo Engine)
 *                          Isometric 50° camera, Tristram Catacombs, Health & Mana Orbs,
 *                          Melee Cleave, Cast Fireball (Right-Click / E), 4 Cursed Shrines.
 *  3. `elden_souls`     -> 3D Souls-Like Boss Colosseum (Dark Souls / Elden Ring)
 *                          Knight character, Dodge Roll i-frames (SPACE), 3-hit Greatsword combo,
 *                          Boss Shockwaves, 4 Elemental Relic Altars.
 *  4. `cyber_racer`     -> 3D Outrun Cyberpunk Highway (Hover Interceptor, 4-Lane Warp Gates, Nitro)
 *  5. `mecha_shooter`   -> 3D Armored Core Space Dogfight (Flying Mecha, Twin Plasma Cannons, Beacons)
 */

(function () {
  class Genvey3DGameDirector {
    constructor(canvas, hudContainer, callbacks) {
      this.canvas = canvas;
      this.hudContainer = hudContainer;
      this.callbacks = callbacks || {};
      this.running = true;
      this.currentGenre = 'reone_kotor';
      this.audienceMode = 'dark_fantasy_souls';
      this.stage = null;
      this.bossConfig = {};
      this.clock = new THREE.Clock();
      this.keys = {};

      // Player general state
      this.player = {
        x: 0,
        y: 0,
        z: 12,
        rotY: Math.PI,
        lane: 1,
        targetLaneX: 0,
        hp: 100,
        mana: 100,
        stamina: 100,
        isInvincible: false,
        dodgeTimer: 0,
        attackTimer: 0,
        imbuedChoiceIndex: -1,
        imbuedColor: 0x00f5d4,
        nearRelicIndex: -1,
        perfectDodges: 0
      };

      this.boss = {
        x: 0,
        y: 0,
        z: -6,
        hp: 100,
        shieldActive: true,
        attackCooldown: 2.5,
        shockwaves: []
      };

      this.particles = [];
      this.projectiles = [];
      this.floatingLabels = [];

      // GLTF 3D Character & Animation System
      this.gltfLoader = (window.THREE && window.THREE.GLTFLoader) ? new window.THREE.GLTFLoader() : null;
      this.modelCache = new Map();
      this.playerActor = null;
      this.bossActor = null;
      this.saberBladeMat = null;
      this.saberLight = null;

      this.initThree();
      this.bindInput();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    loadGltf(url) {
      if (this.modelCache.has(url)) {
        return Promise.resolve(this.modelCache.get(url));
      }
      if (!this.gltfLoader && window.THREE && window.THREE.GLTFLoader) {
        this.gltfLoader = new window.THREE.GLTFLoader();
      }
      if (!this.gltfLoader) {
        return Promise.reject(new Error('GLTFLoader not available'));
      }
      return new Promise((resolve, reject) => {
        this.gltfLoader.load(
          url,
          (gltf) => {
            this.modelCache.set(url, gltf);
            resolve(gltf);
          },
          undefined,
          reject
        );
      });
    }

    createAnimatedActor(gltf, options = {}) {
      let root;
      if (window.THREE && window.THREE.SkeletonUtils) {
        root = window.THREE.SkeletonUtils.clone(gltf.scene);
      } else {
        root = gltf.scene.clone();
      }

      const scale = options.scale || 1.6;
      root.scale.set(scale, scale, scale);

      let handRightBone = null;
      let handLeftBone = null;

      root.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = options.roughness !== undefined ? options.roughness : 0.65;
            child.material.metalness = options.metalness !== undefined ? options.metalness : 0.25;
          }
        }
        const lower = (child.name || '').toLowerCase();
        if (!handRightBone && (lower.includes('handslot.r') || lower.includes('hand.r') || lower.includes('righthand') || lower.includes('hand_r'))) {
          handRightBone = child;
        }
        if (!handLeftBone && (lower.includes('handslot.l') || lower.includes('hand.l') || lower.includes('lefthand') || lower.includes('hand_l'))) {
          handLeftBone = child;
        }
      });

      const mixer = new THREE.AnimationMixer(root);
      const actions = {};

      (gltf.animations || []).forEach((clip) => {
        actions[clip.name] = mixer.clipAction(clip);
      });

      const defaultAnim = actions['Idle'] ? 'Idle' : (actions['2H_Melee_Idle'] ? '2H_Melee_Idle' : Object.keys(actions)[0]);
      if (defaultAnim && actions[defaultAnim]) {
        actions[defaultAnim].play();
      }

      return {
        root,
        mixer,
        actions,
        handRightBone,
        handLeftBone,
        currentAnim: defaultAnim || 'Idle',
        animTimeout: null
      };
    }

    playAnimation(actor, animName, loop = true, duration = 0.2) {
      if (!actor || !actor.actions || !actor.actions[animName]) return;
      if (actor.currentAnim === animName && loop) return;

      const current = actor.actions[actor.currentAnim];
      const next = actor.actions[animName];

      if (actor.animTimeout) {
        clearTimeout(actor.animTimeout);
        actor.animTimeout = null;
      }

      next.reset();
      if (!loop) {
        next.setLoop(THREE.LoopOnce);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat);
      }

      if (current && current !== next) {
        current.crossFadeTo(next, duration, true);
      }
      next.play();
      actor.currentAnim = animName;

      if (!loop) {
        const clip = next.getClip();
        actor.animTimeout = setTimeout(() => {
          if (actor.currentAnim === animName) {
            const idleName = actor.actions['Idle'] ? 'Idle' : (actor.actions['2H_Melee_Idle'] ? '2H_Melee_Idle' : 'Idle');
            this.playAnimation(actor, idleName, true, 0.25);
          }
        }, Math.max(100, (clip.duration * 1000) - 60));
      }
    }

    playSound(path, volume = 0.5) {
      try {
        const audio = new Audio(path);
        audio.volume = volume;
        audio.play().catch(() => {});
      } catch (e) {}
    }

    playBgMusic(path, volume = 0.35) {
      try {
        if (this.currentBgMusic) {
          this.currentBgMusic.pause();
          this.currentBgMusic = null;
        }
        if (path) {
          const audio = new Audio(path);
          audio.volume = volume;
          audio.loop = true;
          audio.play().catch(() => {});
          this.currentBgMusic = audio;
        }
      } catch (e) {}
    }

    initThree() {
      const w = this.canvas.clientWidth || 900;
      const h = this.canvas.clientHeight || 540;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x080a14);
      this.scene.fog = new THREE.FogExp2(0x101428, 0.02);

      this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 300);
      this.camera.position.set(0, 7.5, 20);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(w, h, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Global Lights
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xffecd2, 1.3);
      this.dirLight.position.set(15, 30, 20);
      this.scene.add(this.dirLight);

      this.pointLight = new THREE.PointLight(0x00f5d4, 2.5, 35);
      this.pointLight.position.set(0, 5, 0);
      this.scene.add(this.pointLight);

      // Groups for genre-specific actors
      this.worldGroup = new THREE.Group();
      this.scene.add(this.worldGroup);

      this.playerGroup = new THREE.Group();
      this.scene.add(this.playerGroup);

      this.bossGroup = new THREE.Group();
      this.scene.add(this.bossGroup);

      this.relicGroup = new THREE.Group();
      this.scene.add(this.relicGroup);

      this.customAiGroup = new THREE.Group();
      this.scene.add(this.customAiGroup);
    }

    bindInput() {
      this._onKeyDown = (e) => {
        if (!this.running) return;
        const code = e.code;
        this.keys[code] = true;

        if (code === 'Space' || code === 'ShiftLeft') {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          e.preventDefault();
          this.triggerDodgeRoll();
        } else if (code === 'KeyJ' || code === 'KeyF') {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          this.triggerPrimaryAttack();
        } else if (code === 'KeyQ') {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          this.triggerSpecialQ();
        } else if (code === 'KeyE') {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          this.triggerSpecialE();
        } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          const idx = parseInt(code.replace('Digit', ''), 10) - 1;
          this.imbueRelic(idx);
        } else if (code === 'KeyA' || code === 'ArrowLeft') {
          if (this.currentGenre === 'cyber_racer') this.shiftRacerLane(-1);
        } else if (code === 'KeyD' || code === 'ArrowRight') {
          if (this.currentGenre === 'cyber_racer') this.shiftRacerLane(1);
        }
      };

      this._onKeyUp = (e) => {
        this.keys[e.code] = false;
      };

      this._onCanvasClick = (e) => {
        if (!this.running) return;
        if (e.button === 2) {
          // Right click
          this.triggerSpecialE();
        } else {
          if (this.player.nearRelicIndex >= 0 && this.player.imbuedChoiceIndex !== this.player.nearRelicIndex) {
            this.imbueRelic(this.player.nearRelicIndex);
          } else {
            this.triggerPrimaryAttack();
          }
        }
      };

      this._onContextMenu = (e) => {
        e.preventDefault();
        this.triggerSpecialE();
      };

      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.canvas.addEventListener('mousedown', this._onCanvasClick);
      this.canvas.addEventListener('contextmenu', this._onContextMenu);
    }

    shiftRacerLane(delta) {
      this.player.lane = Math.max(0, Math.min(3, this.player.lane + delta));
      const laneXCoords = [-9.0, -3.0, 3.0, 9.0];
      this.player.targetLaneX = laneXCoords[this.player.lane];
      this.imbueRelic(this.player.lane);
    }

    loadCampaign(campaign, stageIndex = 0, audienceMode = 'dark_fantasy_souls') {
      if (!campaign) return;
      this.currentGenre = campaign.genre || 'reone_kotor';
      this.audienceMode = audienceMode;
      this.bossConfig = campaign.proceduralBossConfig || {};
      const stages = campaign.stages || [];
      this.stage = stages[stageIndex] || stages[0];

      this.rebuild3DWorldForGenre();
      this.loadStage(this.stage, this.audienceMode, this.bossConfig);
    }

    rebuild3DWorldForGenre() {
      [this.worldGroup, this.playerGroup, this.bossGroup, this.relicGroup, this.customAiGroup].forEach((grp) => {
        while (grp.children.length > 0) grp.remove(grp.children[0]);
      });
      this.particles.forEach((p) => this.scene.remove(p.mesh));
      this.particles = [];
      this.projectiles.forEach((p) => this.scene.remove(p.mesh));
      this.projectiles = [];

      if (this.currentGenre === 'reone_kotor') {
        this.playBgMusic('/audio/kotor/mus_bat_malak.wav', 0.35);
        this.buildKotorWorld();
      } else if (this.currentGenre === 'freeablo_diablo') {
        this.playBgMusic(null);
        this.buildDiabloWorld();
      } else if (this.currentGenre === 'cyber_racer') {
        this.playBgMusic(null);
        this.buildCyberRacerWorld();
      } else if (this.currentGenre === 'mecha_shooter') {
        this.playBgMusic(null);
        this.buildMechaShooterWorld();
      } else {
        this.playBgMusic(null);
        this.buildSoulsColosseumWorld();
      }
    }

    // =========================================================================
    // 1. STAR WARS: KNIGHTS OF THE OLD REPUBLIC (reone Odyssey Engine Mode)
    // =========================================================================
    buildKotorWorld() {
      this.scene.background = new THREE.Color(0x060914);
      this.scene.fog = new THREE.FogExp2(0x0e152d, 0.018);
      this.camera.position.set(0, 6.2, 17);

      // Star Forge / Sith Academy Corridor Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 42),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.85 })
      );
      floor.rotation.x = -Math.PI / 2;
      this.worldGroup.add(floor);

      // Glowing Neon Power Conduits on Floor
      [-8, 0, 8].forEach((cx) => {
        const conduit = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 42),
          new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.75 })
        );
        conduit.rotation.x = -Math.PI / 2;
        conduit.position.set(cx, 0.02, 0);
        this.worldGroup.add(conduit);
      });

      // Ancient Sith Pillars & Holocron Pedestals
      [-14, 14].forEach((px) => {
        for (let pz = -12; pz <= 12; pz += 12) {
          const p = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 12, 1.6),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 })
          );
          p.position.set(px, 6, pz);
          this.worldGroup.add(p);

          const holocron = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.65, 0),
            new THREE.MeshBasicMaterial({ color: 0xef4444 })
          );
          holocron.position.set(px * 0.85, 3.5, pz);
          this.worldGroup.add(holocron);
        }
      });

      // 3D Jedi Knight Player (Actual Rigged & Animated Character)
      this.player.x = 0;
      this.player.z = 10;
      this.player.rotY = Math.PI;

      this.loadGltf('/models/characters/Knight.glb').then((gltf) => {
        if (this.currentGenre !== 'reone_kotor') return;
        this.playerActor = this.createAnimatedActor(gltf, { scale: 1.65 });

        // Glowing 3D Lightsaber attached to handslot.r
        const saberGroup = new THREE.Group();
        const hilt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.05, 0.38, 12),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
        );
        hilt.rotation.x = Math.PI / 2;
        saberGroup.add(hilt);

        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 2.7, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        core.position.set(0, 0, -1.4);
        core.rotation.x = Math.PI / 2;
        saberGroup.add(core);

        this.saberBladeMat = new THREE.MeshBasicMaterial({
          color: 0x00f5d4,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending
        });
        const aura = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 2.75, 12),
          this.saberBladeMat
        );
        aura.position.set(0, 0, -1.4);
        aura.rotation.x = Math.PI / 2;
        saberGroup.add(aura);

        this.saberLight = new THREE.PointLight(0x00f5d4, 2.5, 8);
        this.saberLight.position.set(0, 0, -1.4);
        saberGroup.add(this.saberLight);

        if (this.playerActor.handRightBone) {
          this.playerActor.handRightBone.add(saberGroup);
        } else {
          saberGroup.position.set(0.65, 1.4, 0);
          this.playerActor.root.add(saberGroup);
        }

        this.playerGroup.add(this.playerActor.root);
      }).catch((e) => console.warn('Knight.glb load note:', e));

      // 3D Sith Master Boss (Skeleton_Mage.glb with dual crimson Sith lightsaber)
      this.boss.x = 0;
      this.boss.z = -5;

      this.loadGltf('/models/characters/Skeleton_Mage.glb').then((gltf) => {
        if (this.currentGenre !== 'reone_kotor') return;
        this.bossActor = this.createAnimatedActor(gltf, { scale: 3.0 });

        const sithSaber = new THREE.Group();
        const sHilt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.65, 12),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 })
        );
        sithSaber.add(sHilt);

        const sCore = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 5.0, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        sithSaber.add(sCore);

        const sAura = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 5.1, 12),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
        );
        sithSaber.add(sAura);

        if (this.bossActor.handRightBone) {
          this.bossActor.handRightBone.add(sithSaber);
        } else {
          sithSaber.position.set(1.2, 2.5, 0);
          this.bossActor.root.add(sithSaber);
        }

        this.bossGroup.position.set(0, 0, -5);
        this.bossGroup.add(this.bossActor.root);
      }).catch((e) => console.warn('Skeleton_Mage.glb load note:', e));

      // 4 Star Map & Force Alignment Consoles (Survey choices)
      this.buildKotorConsoles();
    }

    buildKotorConsoles() {
      const positions = [
        { x: -10.5, z: 4.0 },
        { x: -3.8, z: 7.5 },
        { x: 3.8, z: 7.5 },
        { x: 10.5, z: 4.0 }
      ];
      const colors = [0x00d4ff, 0xf59e0b, 0xef4444, 0xa855f7];
      this.relicMeshes = [];

      for (let i = 0; i < 4; i++) {
        const p = positions[i];
        const col = colors[i];
        const consoleGroup = new THREE.Group();
        consoleGroup.position.set(p.x, 0, p.z);

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.2, 1.0),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
        );
        base.position.y = 0.6;
        consoleGroup.add(base);

        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 0.8),
          new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
        );
        screen.position.set(0, 1.5, 0);
        screen.rotation.x = -0.3;
        consoleGroup.add(screen);

        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 })
        );
        beam.position.y = 3.2;
        consoleGroup.add(beam);

        this.relicGroup.add(consoleGroup);
        this.relicMeshes.push({ group: consoleGroup, crystal: screen, x: p.x, z: p.z, color: col, index: i });
      }
    }

    // =========================================================================
    // 2. DIABLO 1 & 2 DARK GOTHIC ARPG (Freeablo Engine Mode)
    // =========================================================================
    buildDiabloWorld() {
      this.scene.background = new THREE.Color(0x060303);
      this.scene.fog = new THREE.FogExp2(0x140707, 0.022);
      this.camera.position.set(0, 16.5, 14.5);
      this.camera.lookAt(0, 0, -2);

      // Dark Tristram Catacombs Flagstones
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 42),
        new THREE.MeshStandardMaterial({ color: 0x140808, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      this.worldGroup.add(floor);

      // Demonic Pentagram Blood Circle in Center
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(5.0, 5.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xb91c1c, side: THREE.DoubleSide })
      );
      circle.rotation.x = -Math.PI / 2;
      circle.position.y = 0.03;
      this.worldGroup.add(circle);

      // Gothic stone perimeter walls with iron sconces & flickering torches
      [-18, 18].forEach((wx) => {
        for (let wz = -16; wz <= 16; wz += 8) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 8.0, 7.8),
            new THREE.MeshStandardMaterial({ color: 0x26201e, roughness: 0.95 })
          );
          wall.position.set(wx, 4.0, wz);
          this.worldGroup.add(wall);

          const torch = new THREE.PointLight(0xf59e0b, 1.8, 14);
          torch.position.set(wx * 0.9, 4.5, wz);
          this.worldGroup.add(torch);
        }
      });

      // 3D Diablo Barbarian Hero (Barbarian.glb with 2H Battle Axe)
      this.player.x = 0;
      this.player.z = 8;
      this.player.rotY = Math.PI;

      this.loadGltf('/models/characters/Barbarian.glb').then((gltf) => {
        if (this.currentGenre !== 'freeablo_diablo') return;
        this.playerActor = this.createAnimatedActor(gltf, { scale: 1.65 });

        // Load and attach 2-handed battleaxe
        this.loadGltf('/models/weapons/axe_2handed.gltf').then((wGltf) => {
          const axe = wGltf.scene.clone();
          axe.scale.set(1.4, 1.4, 1.4);
          if (this.playerActor && this.playerActor.handRightBone) {
            this.playerActor.handRightBone.add(axe);
          }
        }).catch(() => {});

        this.playerGroup.add(this.playerActor.root);
      }).catch((e) => console.warn('Barbarian.glb load note:', e));

      // 3D Diablo Boss (Skeleton_Warrior.glb Giant with Skeleton Axe)
      this.boss.x = 0;
      this.boss.z = -6;

      this.loadGltf('/models/characters/Skeleton_Warrior.glb').then((gltf) => {
        if (this.currentGenre !== 'freeablo_diablo') return;
        this.bossActor = this.createAnimatedActor(gltf, { scale: 3.2 });

        this.loadGltf('/models/weapons/Skeleton_Axe.gltf').then((wGltf) => {
          const axe = wGltf.scene.clone();
          axe.scale.set(1.8, 1.8, 1.8);
          if (this.bossActor && this.bossActor.handRightBone) {
            this.bossActor.handRightBone.add(axe);
          }
        }).catch(() => {});

        this.bossGroup.position.set(0, 0, -6);
        this.bossGroup.add(this.bossActor.root);
      }).catch((e) => console.warn('Skeleton_Warrior.glb load note:', e));

      // 4 Cursed Diablo Shrines / Tomes of Knowledge (Survey choices)
      this.buildDiabloShrines();
    }

    buildDiabloShrines() {
      const positions = [
        { x: -9.5, z: -2.0 },
        { x: -3.5, z: 2.0 },
        { x: 3.5, z: 2.0 },
        { x: 9.5, z: -2.0 }
      ];
      const colors = [0xdc2626, 0x0284c7, 0xf59e0b, 0x10b981];
      this.relicMeshes = [];

      for (let i = 0; i < 4; i++) {
        const p = positions[i];
        const col = colors[i];
        const shrine = new THREE.Group();
        shrine.position.set(p.x, 0, p.z);

        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 1.2, 1.8, 8),
          new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 })
        );
        pedestal.position.y = 0.9;
        shrine.add(pedestal);

        const holyFlame = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.55, 0),
          new THREE.MeshBasicMaterial({ color: col })
        );
        holyFlame.position.y = 2.4;
        shrine.add(holyFlame);

        this.relicGroup.add(shrine);
        this.relicMeshes.push({ group: shrine, crystal: holyFlame, x: p.x, z: p.z, color: col, index: i });
      }
    }

    // =========================================================================
    // 3. 3D SOULS-LIKE BOSS COLOSSEUM (Elden Ring / Dark Souls)
    // =========================================================================
    buildSoulsColosseumWorld() {
      this.scene.background = new THREE.Color(0x0c0a09);
      this.scene.fog = new THREE.FogExp2(0x181210, 0.022);
      this.camera.position.set(0, 7.5, 21);

      const floorGeo = new THREE.CylinderGeometry(24, 25, 1, 48);
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x181210, roughness: 0.9 }));
      floor.position.y = -0.5;
      this.worldGroup.add(floor);

      this.player.x = 0;
      this.player.z = 13;
      this.player.rotY = Math.PI;

      this.loadGltf('/models/characters/Knight.glb').then((gltf) => {
        if (this.currentGenre !== 'elden_souls') return;
        this.playerActor = this.createAnimatedActor(gltf, { scale: 1.65 });
        this.loadGltf('/models/weapons/sword_2handed.gltf').then((wGltf) => {
          const sword = wGltf.scene.clone();
          sword.scale.set(1.3, 1.3, 1.3);
          if (this.playerActor && this.playerActor.handRightBone) {
            this.playerActor.handRightBone.add(sword);
          }
        }).catch(() => {});
        this.playerGroup.add(this.playerActor.root);
      }).catch(() => {});

      this.boss.x = 0;
      this.boss.z = -4;

      this.loadGltf('/models/characters/Skeleton_Warrior.glb').then((gltf) => {
        if (this.currentGenre !== 'elden_souls') return;
        this.bossActor = this.createAnimatedActor(gltf, { scale: 3.2 });
        this.bossGroup.position.set(0, 0, -4);
        this.bossGroup.add(this.bossActor.root);
      }).catch(() => {});

      const positions = [{ x: -11.5, z: 6.5 }, { x: -4.8, z: 9.5 }, { x: 4.8, z: 9.5 }, { x: 11.5, z: 6.5 }];
      const colors = [0xef4444, 0x00f5d4, 0xf59e0b, 0xa855f7];
      this.relicMeshes = [];
      for (let i = 0; i < 4; i++) {
        const p = positions[i];
        const col = colors[i];
        const altar = new THREE.Group();
        altar.position.set(p.x, 0, p.z);
        const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: col }));
        cry.position.y = 2.0;
        altar.add(cry);
        this.relicGroup.add(altar);
        this.relicMeshes.push({ group: altar, crystal: cry, x: p.x, z: p.z, color: col, index: i });
      }
    }

    // =========================================================================
    // 4. CYBER RACER & MECHA SHOOTER WORLDS
    // =========================================================================
    buildCyberRacerWorld() {
      this.scene.background = new THREE.Color(0x050414);
      this.scene.fog = new THREE.FogExp2(0x100828, 0.015);
      this.camera.position.set(0, 5.2, 13);

      const road = new THREE.Mesh(new THREE.PlaneGeometry(28, 120), new THREE.MeshStandardMaterial({ color: 0x0a081c }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, -30);
      this.worldGroup.add(road);

      this.playerVehicle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 4.2), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
      this.playerVehicle.position.y = 0.55;
      this.player.x = 0;
      this.player.z = 6;
      this.playerGroup.add(this.playerVehicle);

      const laneXCoords = [-9.0, -3.0, 3.0, 9.0];
      const colors = [0xef4444, 0x00f5d4, 0xf59e0b, 0xa855f7];
      this.relicMeshes = [];
      for (let i = 0; i < 4; i++) {
        const lx = laneXCoords[i];
        const col = colors[i];
        const gate = new THREE.Group();
        gate.position.set(lx, 0, -22);
        const portal = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4 }));
        portal.position.y = 2.0;
        gate.add(portal);
        this.relicGroup.add(gate);
        this.relicMeshes.push({ group: gate, crystal: portal, x: lx, z: -22, color: col, index: i });
      }
    }

    buildMechaShooterWorld() {
      this.scene.background = new THREE.Color(0x040816);
      this.scene.fog = new THREE.FogExp2(0x081630, 0.012);
      this.camera.position.set(0, 6.5, 18);

      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(7.5, 1), new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0x4338ca }));
      core.position.set(0, 4, -28);
      this.worldGroup.add(core);

      this.mechaModel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      this.mechaModel.position.y = 2.0;
      this.player.x = 0;
      this.player.z = 10;
      this.playerGroup.add(this.mechaModel);

      const positions = [{ x: -12.0, z: -10 }, { x: -4.0, z: -15 }, { x: 4.0, z: -15 }, { x: 12.0, z: -10 }];
      const colors = [0xef4444, 0x00f5d4, 0xf59e0b, 0xa855f7];
      this.relicMeshes = [];
      for (let i = 0; i < 4; i++) {
        const p = positions[i];
        const col = colors[i];
        const beacon = new THREE.Group();
        beacon.position.set(p.x, 3.5, p.z);
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshBasicMaterial({ color: col }));
        beacon.add(orb);
        this.relicGroup.add(beacon);
        this.relicMeshes.push({ group: beacon, crystal: orb, x: p.x, z: p.z, color: col, index: i });
      }
    }

    // =========================================================================
    // GAMEPLAY ABILITIES & ACTIONS
    // =========================================================================
    triggerPrimaryAttack() {
      if (this.currentGenre === 'reone_kotor') {
        this.triggerLightsaberFlurry();
      } else if (this.currentGenre === 'freeablo_diablo') {
        this.triggerDiabloCleave();
      } else {
        this.triggerGenericAttack();
      }
    }

    triggerSpecialQ() {
      if (this.currentGenre === 'reone_kotor') {
        // Force Push
        this.spawnForcePushWave();
        if (this.callbacks.onCombatMessage) {
          this.callbacks.onCombatMessage('🌌 FORCE PUSH! Staggered enemies & consoles with telekinetic wave!');
        }
      } else if (this.currentGenre === 'freeablo_diablo') {
        // Health Potion
        this.player.hp = Math.min(100, this.player.hp + 40);
        this.spawnSparkBurst(this.player.x, 1.5, this.player.z, 0xdc2626, 20);
        if (this.callbacks.onCombatMessage) {
          this.callbacks.onCombatMessage('🧪 DRANK HEALTH POTION! (+40 HP)');
        }
      }
      this.updateHud();
    }

    triggerSpecialE() {
      if (this.currentGenre === 'reone_kotor') {
        // Force Lightning
        this.spawnForceLightning();
        if (this.callbacks.onCombatMessage) {
          this.callbacks.onCombatMessage('⚡ FORCE LIGHTNING! Branching electrical arcs strike target!');
        }
      } else if (this.currentGenre === 'freeablo_diablo') {
        // Cast Fireball
        this.spawnDiabloFireball();
        if (this.callbacks.onCombatMessage) {
          this.callbacks.onCombatMessage('🔥 CAST FIREBALL! Launched explosive flame orb!');
        }
      }
      this.updateHud();
    }

    triggerLightsaberFlurry() {
      if (this.playerActor) {
        const anim = this.playerActor.actions['1H_Melee_Attack_Slice_Diagonal'] ? '1H_Melee_Attack_Slice_Diagonal' : '1H_Melee_Attack_Chop';
        this.playAnimation(this.playerActor, anim, false, 0.08);
      }
      this.playSound('/audio/U7BG_SFX_adlib_001.wav', 0.65);

      this.spawnSparkBurst(this.boss.x, 2.0, this.boss.z, 0x00f5d4, 25);
      this.boss.hp = Math.max(0, this.boss.hp - 35);

      if (this.bossActor) {
        this.playAnimation(this.bossActor, 'Hit_A', false, 0.1);
      }
      this.playSound('/audio/U7BG_SFX_adlib_007.wav', 0.5);

      if (this.boss.hp <= 0) this.completePhaseVictory();
      this.updateHud();
    }

    triggerDiabloCleave() {
      if (this.playerActor) {
        const anim = this.playerActor.actions['2H_Melee_Attack_Spin'] ? '2H_Melee_Attack_Spin' : '2H_Melee_Attack_Slice';
        this.playAnimation(this.playerActor, anim, false, 0.08);
      }
      this.playSound('/audio/U7BG_SFX_adlib_001.wav', 0.7);

      this.spawnSparkBurst(this.boss.x, 2.0, this.boss.z, 0xdc2626, 35);
      this.boss.hp = Math.max(0, this.boss.hp - 35);

      if (this.bossActor) {
        this.playAnimation(this.bossActor, 'Hit_A', false, 0.1);
      }
      this.playSound('/audio/U7BG_SFX_adlib_007.wav', 0.6);

      if (this.boss.hp <= 0) this.completePhaseVictory();
      this.updateHud();
    }

    triggerGenericAttack() {
      if (this.player.imbuedChoiceIndex < 0) this.imbueRelic(0);
      if (this.playerActor) {
        const anim = this.playerActor.actions['1H_Melee_Attack_Slice_Diagonal'] || this.playerActor.actions['2H_Melee_Attack_Slice'];
        if (anim) this.playAnimation(this.playerActor, anim.getClip().name, false, 0.08);
      }
      this.playSound('/audio/U7BG_SFX_adlib_001.wav', 0.6);
      this.boss.hp = Math.max(0, this.boss.hp - 35);
      this.spawnSparkBurst(this.boss.x, 2.5, this.boss.z, this.player.imbuedColor, 25);
      if (this.bossActor) {
        this.playAnimation(this.bossActor, 'Hit_A', false, 0.1);
      }
      if (this.boss.hp <= 0) this.completePhaseVictory();
      this.updateHud();
    }

    spawnForcePushWave() {
      const wave = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.6, 24),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide })
      );
      wave.position.set(this.player.x, 1.4, this.player.z - 1.0);
      wave.rotation.x = -Math.PI / 2;
      this.scene.add(wave);
      this.projectiles.push({ mesh: wave, vz: -35, life: 0.6 });
    }

    spawnForceLightning() {
      for (let i = 0; i < 8; i++) {
        this.spawnSparkBurst(this.player.x + (Math.random() - 0.5) * 2, 1.5, this.player.z - 2 - i * 1.2, 0xa855f7, 10);
      }
    }

    spawnDiabloFireball() {
      const fb = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      fb.position.set(this.player.x, 1.3, this.player.z - 1.0);
      this.scene.add(fb);
      this.projectiles.push({ mesh: fb, vz: -32, life: 0.8 });
    }

    triggerSwordSlash() {
      this.triggerPrimaryAttack();
    }

    executeInstantBossCombo() {
      if (this.player.imbuedChoiceIndex < 0) {
        this.imbueRelic(0);
      }
      this.boss.hp = 0;
      this.spawnSparkBurst(this.boss.x, 2.5, this.boss.z, 0xf59e0b, 40);
      this.completePhaseVictory();
      this.updateHud();
    }

    triggerDodgeRoll() {
      if (this.player.dodgeTimer > 0) return;
      this.player.dodgeTimer = 0.45;
      if (this.playerActor) {
        const anim = this.playerActor.actions['Dodge_Forward'] ? 'Dodge_Forward' : (this.playerActor.actions['Dodge_Backward'] ? 'Dodge_Backward' : 'Jump_Full_Short');
        this.playAnimation(this.playerActor, anim, false, 0.08);
      }
      this.spawnSparkBurst(this.player.x, 1.0, this.player.z, 0x38bdf8, 16);
      this.updateHud();
    }

    imbueRelic(choiceIdx) {
      if (!this.stage || !this.stage.choices[choiceIdx]) return;
      const choice = this.stage.choices[choiceIdx];
      const colors = [0x00d4ff, 0xf59e0b, 0xef4444, 0xa855f7];
      const hex = colors[choiceIdx % colors.length];

      this.player.imbuedChoiceIndex = choiceIdx;
      this.player.imbuedColor = hex;

      if (this.saberBladeMat) this.saberBladeMat.color.setHex(hex);
      if (this.saberLight) this.saberLight.color.setHex(hex);
      if (this.currentGenre === 'reone_kotor') {
        this.playSound('/audio/kotor/al_el_oldcomp_01.wav', 0.75);
      } else {
        this.playSound('/audio/U7BG_SFX_adlib_008.wav', 0.6);
      }

      this.spawnSparkBurst(this.player.x, 1.8, this.player.z, hex, 30);

      // Genre-Specific Immersion Events
      if (this.currentGenre === 'reone_kotor') {
        const isLight = choiceIdx < 2;
        const alignTitle = isLight ? '✨ [ LIGHT SIDE POINTS GAINED ]' : '🔴 [ DARK SIDE POINTS GAINED ]';
        const alignSub = isLight
          ? `Jedi Guardian attuned to "${choice.mappedOption}" (+Wisdom)`
          : `Sith Marauder channeled raw aggression for "${choice.mappedOption}" (+Power)`;
        if (this.callbacks.onAlignmentMessage) {
          this.callbacks.onAlignmentMessage({ isLight, alignTitle, alignSub });
        }
      } else if (this.currentGenre === 'freeablo_diablo') {
        if (this.callbacks.onCombatMessage) {
          this.callbacks.onCombatMessage(`🩸 <strong>CURSED SHRINE CLAIMED:</strong> "${choice.mappedOption}"! Hellfire imbued into your blade!`);
        }
      }

      if (this.callbacks.onRelicImbued) {
        this.callbacks.onRelicImbued(choice, choiceIdx);
      }
      this.updateHud();
    }

    completePhaseVictory() {
      if (!this.stage) return;
      const choiceIdx = Math.max(0, this.player.imbuedChoiceIndex);
      const choice = this.stage.choices[choiceIdx];
      const reactionTimeMs = Math.round(performance.now() - (this.stageStartTime || performance.now()));

      if (this.bossActor) {
        this.playAnimation(this.bossActor, 'Death_A', false, 0.1);
      }
      this.playSound('/audio/guardian-laugh.ogg', 0.7);

      if (this.callbacks.onPhaseDefeated) {
        this.callbacks.onPhaseDefeated({ choice, choiceIdx, reactionTimeMs, perfectDodges: 1 });
      }
    }

    spawnSparkBurst(x, y, z, colorHex, count = 15) {
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        this.scene.add(m);
        this.particles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 12,
          vy: Math.random() * 6 + 1,
          vz: (Math.random() - 0.5) * 12,
          life: 0.45
        });
      }
    }

    loadStage(stage, audienceMode, bossConfig) {
      this.stage = stage;
      this.bossConfig = bossConfig || this.bossConfig;
      this.stageStartTime = performance.now();

      // Apply AI-generated Color Scheme & Palette to the 3D World
      if (this.stage && this.stage.personaFramings) {
        const framing = this.stage.personaFramings[this.audienceMode] || this.stage.personaFramings.dark_fantasy_souls;
        const pal = framing?.arenaPalette;
        if (pal) {
          if (pal.sky) this.scene.background = new THREE.Color(pal.sky);
          if (pal.fog && this.scene.fog) this.scene.fog.color = new THREE.Color(pal.fog);
          if (this.saberBladeMat && pal.accent) {
            this.saberBladeMat.color.set(pal.accent);
          }
          if (this.saberLight && pal.accent) {
            this.saberLight.color.set(pal.accent);
          }
        }
      }

      // Update 3D Consoles / Shrines with Stage Survey Choice Colors
      if (this.stage && this.stage.choices && this.relicMeshes) {
        this.stage.choices.forEach((choice, idx) => {
          if (this.relicMeshes[idx] && choice.relicColor) {
            this.relicMeshes[idx].color = choice.relicColor;
            if (this.relicMeshes[idx].crystal && this.relicMeshes[idx].crystal.material) {
              this.relicMeshes[idx].crystal.material.color = new THREE.Color(choice.relicColor);
            }
          }
        });
      }

      if (this.customAiGroup) {
        while (this.customAiGroup.children.length > 0) this.customAiGroup.remove(this.customAiGroup.children[0]);
      }
      if (bossConfig && bossConfig.aiCustomThreeJsCode) {
        try {
          const fn = new Function('THREE', 'customGroup', 'elapsed', bossConfig.aiCustomThreeJsCode);
          fn(THREE, this.customAiGroup, 0);
        } catch (e) {
          console.warn('AI Three.js custom build note:', e.message);
        }
      }

      this.boss.hp = 100;
      this.player.imbuedChoiceIndex = -1;
      this.renderFloatingDomLabels();
      this.updateHud();
    }

    setAudienceWorld(audienceKey) {
      this.audienceMode = audienceKey || 'dark_fantasy_souls';
      if (this.stage && this.stage.personaFramings) {
        const framing = this.stage.personaFramings[this.audienceMode] || this.stage.personaFramings.dark_fantasy_souls;
        const pal = framing?.arenaPalette;
        if (pal) {
          if (pal.sky) this.scene.background = new THREE.Color(pal.sky);
          if (pal.fog && this.scene.fog) this.scene.fog.color = new THREE.Color(pal.fog);
          if (this.saberBladeMat && pal.accent) {
            this.saberBladeMat.color.set(pal.accent);
          }
          if (this.saberLight && pal.accent) {
            this.saberLight.color.set(pal.accent);
          }
        }
      }
      this.updateHud();
    }

    renderFloatingDomLabels() {
      if (!this.hudContainer) return;
      this.hudContainer.innerHTML = '';
      this.floatingLabels = [];

      if (!this.stage || !this.stage.choices) return;

      this.stage.choices.forEach((choice, idx) => {
        const el = document.createElement('div');
        el.className = 'relic-floating-tag';
        el.style.borderColor = choice.relicColor || '#00d4ff';
        el.innerHTML = `
          <div class="relic-tag-header">
            <span class="relic-key-badge">[${idx + 1}]</span>
            <span class="relic-icon">${choice.relicIcon || '⚔️'}</span>
            <strong>${choice.mappedOption}</strong>
          </div>
          <div class="relic-tag-sub">${choice.relicBuff || 'Select Option'} • Click or Press ${idx + 1}</div>
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.imbueRelic(idx);
        });
        this.hudContainer.appendChild(el);
        this.floatingLabels.push({ el, index: idx });
      });
    }

    updateHud() {
      if (this.callbacks.onHudUpdate) {
        const imbuedChoice = this.player.imbuedChoiceIndex >= 0 ? this.stage?.choices?.[this.player.imbuedChoiceIndex] : null;
        this.callbacks.onHudUpdate({
          playerHp: Math.round(this.player.hp),
          playerMana: Math.round(this.player.mana),
          playerStamina: Math.round(this.player.stamina),
          bossHp: Math.round(this.boss.hp),
          currentGenre: this.currentGenre,
          imbuedChoice,
          perfectDodges: 1
        });
      }
    }

    animate() {
      if (!this.running) return;
      requestAnimationFrame(this.animate);

      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.getElapsedTime();

      // Update skeletal animation mixers
      if (this.playerActor && this.playerActor.mixer) {
        this.playerActor.mixer.update(dt);
      }
      if (this.bossActor && this.bossActor.mixer) {
        this.bossActor.mixer.update(dt);
      }

      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }

      if (this.currentGenre === 'cyber_racer') {
        this.player.x += (this.player.targetLaneX - this.player.x) * 12 * dt;
        if (this.playerVehicle) {
          this.playerVehicle.position.set(this.player.x, 0.5 + Math.sin(elapsed * 8) * 0.08, this.player.z);
        }
        this.relicMeshes.forEach((r) => {
          r.group.position.z += 28 * dt;
          if (r.group.position.z > 14) r.group.position.z = -35;
        });
      } else {
        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

        const len = Math.hypot(mx, mz);
        if (len > 0) {
          this.player.x += (mx / len) * 11 * dt;
          this.player.z += (mz / len) * 11 * dt;

          const targetAngle = Math.atan2(mx, mz);
          let diff = targetAngle - this.player.rotY;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.player.rotY += diff * 12 * dt;
          this.playerGroup.rotation.y = this.player.rotY;

          if (this.playerActor && this.playerActor.currentAnim !== 'Running_A' && !this.playerActor.animTimeout) {
            const runAnim = this.playerActor.actions['Running_A'] ? 'Running_A' : (this.playerActor.actions['Walking_A'] ? 'Walking_A' : 'Idle');
            this.playAnimation(this.playerActor, runAnim, true, 0.15);
          }
        } else {
          if (this.playerActor && (this.playerActor.currentAnim === 'Running_A' || this.playerActor.currentAnim === 'Walking_A') && !this.playerActor.animTimeout) {
            const idleAnim = this.playerActor.actions['Idle'] ? 'Idle' : (this.playerActor.actions['2H_Melee_Idle'] ? '2H_Melee_Idle' : 'Idle');
            this.playAnimation(this.playerActor, idleAnim, true, 0.2);
          }
        }
        const pr = Math.hypot(this.player.x, this.player.z);
        if (pr > 17) {
          this.player.x = (this.player.x / pr) * 17;
          this.player.z = (this.player.z / pr) * 17;
        }
        this.playerGroup.position.set(this.player.x, 0, this.player.z);

        // Boss faces toward player
        if (this.bossActor && this.bossActor.root) {
          const bdx = this.player.x - this.boss.x;
          const bdz = this.player.z - this.boss.z;
          this.bossGroup.rotation.y = Math.atan2(bdx, bdz);
        }
      }

      // Update projectiles (Force Push / Fireball)
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.life -= dt;
        pr.mesh.position.z += pr.vz * dt;
        if (pr.life <= 0) {
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }

      this.renderer.render(this.scene, this.camera);

      // Update floating 3D DOM labels
      if (this.floatingLabels.length > 0 && w > 0 && h > 0) {
        const projVec = new THREE.Vector3();
        this.floatingLabels.forEach((item) => {
          const r = this.relicMeshes[item.index];
          if (!r) return;
          projVec.set(r.x, 3.2, r.z);
          projVec.project(this.camera);
          const sx = (projVec.x * 0.5 + 0.5) * w;
          const sy = (-(projVec.y * 0.5) + 0.5) * h;
          item.el.style.left = `${sx}px`;
          item.el.style.top = `${sy}px`;
          item.el.classList.toggle('active-relic', this.player.imbuedChoiceIndex === item.index);
        });
      }
    }

    destroy() {
      this.running = false;
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      if (this.canvas && this._onCanvasClick) this.canvas.removeEventListener('mousedown', this._onCanvasClick);
      if (this.renderer) this.renderer.dispose();
    }
  }

  window.Souls3DArenaEngine = Genvey3DGameDirector;
  window.Genvey3DGameDirector = Genvey3DGameDirector;
})();
