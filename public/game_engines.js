/**
 * GENVEY 3D SOULS-LIKE & ACTION BOSS ENGINE (Three.js WebGL)
 * ----------------------------------------------------------
 * Features:
 *  - Third-Person 3D Articulated Character Controller (WASD Move, SPACE Dodge Roll with i-frames,
 *    Left-Click / J 3-Hit Greatsword Slash Combo with 3D glowing weapon trails)
 *  - Colossal Procedural 3D Multi-Part Boss (Animated Wings, Rotating Halo Rings, Aegis Shield,
 *    Expanding 3D Shockwave Rings & Sweeping Beams that players dodge roll through)
 *  - 4 Physical 3D Elemental Relic Altars in the arena (North, East, South, West) with 3D-projected
 *    floating labels. Players run to a Relic Altar (or click 1-4 / E) to imbue their 3D Greatsword
 *    with their preferred product feature/option, shattering the Boss's shield, then slash the Boss
 *    to defeat each Phase!
 *  - Real-time Track 4 Audience World Switcher:
 *      * Audience A: Elden / Dark Souls Gothic Cathedral (Crimson/Gold/Obsidian)
 *      * Audience B: Armored Core / Cyber-Mecha Reactor (Cyan/Magenta/Neon Grid)
 */

(function () {
  class Souls3DArenaEngine {
    constructor(canvas, hudContainer, callbacks) {
      this.canvas = canvas;
      this.hudContainer = hudContainer;
      this.callbacks = callbacks || {};
      this.running = true;
      this.stage = null;
      this.audienceMode = 'dark_fantasy_souls'; // or 'cyber_mecha_action'
      this.bossConfig = { bossScale: 1.25, wingCount: 4, haloRings: 2, shockwaveSpeed: 12 };

      // Player state
      this.player = {
        x: 0,
        y: 0,
        z: 13,
        vx: 0,
        vz: 0,
        rotY: Math.PI,
        hp: 100,
        maxHp: 100,
        stamina: 100,
        maxStamina: 100,
        dodgeTimer: 0,
        dodgeCooldown: 0,
        isInvincible: false,
        attackTimer: 0,
        comboStep: 0,
        imbuedChoiceIndex: -1,
        imbuedColor: 0xffffff,
        nearRelicIndex: -1,
        perfectDodges: 0
      };

      // Boss state
      this.boss = {
        x: 0,
        y: 0,
        z: -4,
        hp: 100,
        maxHp: 100,
        poise: 100,
        shieldActive: true,
        hitFlash: 0,
        attackCooldown: 2.2,
        shockwaves: [],
        staggeredTimer: 0
      };

      this.keys = {};
      this.particles = [];
      this.floatingLabels = [];
      this.clock = new THREE.Clock();

      this.initThree();
      this.bindInput();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    initThree() {
      const w = this.canvas.clientWidth || 900;
      const h = this.canvas.clientHeight || 540;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0b0808);
      this.scene.fog = new THREE.FogExp2(0x180f0d, 0.022);

      this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
      this.camera.position.set(0, 7.5, 21);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(w, h, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Lights
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xffdcb5, 1.3);
      this.dirLight.position.set(12, 25, 15);
      this.scene.add(this.dirLight);

      this.bossLight = new THREE.PointLight(0xf97316, 2.8, 32);
      this.bossLight.position.set(0, 5, -4);
      this.scene.add(this.bossLight);

      this.swordLight = new THREE.PointLight(0xffffff, 0, 10);
      this.scene.add(this.swordLight);

      this.buildArenaGeometry();
      this.buildPlayerMesh();
      this.buildBossMesh();
      this.buildRelicAltars();
    }

    buildArenaGeometry() {
      this.arenaGroup = new THREE.Group();
      this.scene.add(this.arenaGroup);

      // Arena circular floor
      const floorGeo = new THREE.CylinderGeometry(24, 25, 1, 48);
      this.floorMat = new THREE.MeshStandardMaterial({
        color: 0x181210,
        roughness: 0.75,
        metalness: 0.25
      });
      const floor = new THREE.Mesh(floorGeo, this.floorMat);
      floor.position.y = -0.5;
      this.arenaGroup.add(floor);

      // Runic / Cyber Concentric Rings on Floor
      const ringGeo1 = new THREE.RingGeometry(11.5, 12.0, 64);
      this.ringMat1 = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      });
      const ring1 = new THREE.Mesh(ringGeo1, this.ringMat1);
      ring1.rotation.x = -Math.PI / 2;
      ring1.position.y = 0.03;
      this.arenaGroup.add(ring1);

      const ringGeo2 = new THREE.RingGeometry(18.5, 18.9, 64);
      const ring2 = new THREE.Mesh(ringGeo2, this.ringMat1);
      ring2.rotation.x = -Math.PI / 2;
      ring2.position.y = 0.03;
      this.arenaGroup.add(ring2);

      // 12 Cathedral Pillars / Reactor Pylons around perimeter
      this.pillars = [];
      this.pillarMat = new THREE.MeshStandardMaterial({
        color: 0x29201c,
        roughness: 0.6,
        metalness: 0.4
      });
      this.brazierMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 21.5;
        const pGroup = new THREE.Group();
        pGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 11, 8), this.pillarMat);
        col.position.y = 5.5;
        pGroup.add(col);

        const brazier = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), this.brazierMat);
        brazier.position.y = 11.6;
        pGroup.add(brazier);

        this.arenaGroup.add(pGroup);
        this.pillars.push({ group: pGroup, brazier });
      }

      // Floating Ember / Cyber Particles
      const partCount = 160;
      const partGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(partCount * 3);
      for (let i = 0; i < partCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 42;
        positions[i * 3 + 1] = Math.random() * 14;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 42;
      }
      partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.ambientParticlesMat = new THREE.PointsMaterial({
        color: 0xf59e0b,
        size: 0.22,
        transparent: true,
        opacity: 0.75
      });
      this.ambientParticles = new THREE.Points(partGeo, this.ambientParticlesMat);
      this.scene.add(this.ambientParticles);
    }

    buildPlayerMesh() {
      this.playerGroup = new THREE.Group();
      this.playerBody = new THREE.Group();
      this.playerGroup.add(this.playerBody);

      const armorMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.75,
        roughness: 0.3
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.5,
        roughness: 0.5
      });
      this.capeMat = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        side: THREE.DoubleSide,
        roughness: 0.8
      });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.55), armorMat);
      torso.position.y = 1.45;
      this.playerBody.add(torso);

      // Head / Knight Helm
      const helm = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 6), armorMat);
      helm.position.y = 2.45;
      this.playerBody.add(helm);

      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.45),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      visor.position.set(0, 2.35, -0.18);
      this.playerBody.add(visor);

      // Flowing Cape
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.55), this.capeMat);
      cape.position.set(0, 1.3, 0.34);
      cape.rotation.x = 0.18;
      this.playerBody.add(cape);

      // Legs
      this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.35), darkMat);
      this.leftLeg.position.set(-0.26, 0.45, 0);
      this.playerBody.add(this.leftLeg);

      this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.35), darkMat);
      this.rightLeg.position.set(0.26, 0.45, 0);
      this.playerBody.add(this.rightLeg);

      // Shield Arm (Left)
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.12, 6), armorMat);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.68, 1.45, -0.1);
      this.playerBody.add(shield);

      // Sword Arm + Oversized Runed Greatsword (Right)
      this.swordPivot = new THREE.Group();
      this.swordPivot.position.set(0.65, 1.5, -0.1);
      this.playerBody.add(this.swordPivot);

      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), darkMat);
      hilt.rotation.x = Math.PI / 2;
      this.swordPivot.add(hilt);

      const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.18), armorMat);
      crossguard.position.set(0, 0, -0.3);
      this.swordPivot.add(crossguard);

      this.swordBladeMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x334155,
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.15
      });
      this.swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 2.7), this.swordBladeMat);
      this.swordBlade.position.set(0, 0, -1.65);
      this.swordPivot.add(this.swordBlade);

      // 3D Slash Arc Trail (Visible during sword swing)
      const slashGeo = new THREE.RingGeometry(1.6, 3.3, 24, 1, 0, Math.PI * 1.15);
      this.slashTrailMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      this.slashTrail = new THREE.Mesh(slashGeo, this.slashTrailMat);
      this.slashTrail.rotation.x = -Math.PI / 2;
      this.slashTrail.position.set(0, 1.35, -0.6);
      this.playerGroup.add(this.slashTrail);

      // Dodge Roll I-Frame Aura Sphere
      this.iframeSphereMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.0
      });
      this.iframeSphere = new THREE.Mesh(new THREE.SphereGeometry(1.45, 12, 12), this.iframeSphereMat);
      this.iframeSphere.position.y = 1.3;
      this.playerGroup.add(this.iframeSphere);

      this.playerGroup.position.set(this.player.x, 0, this.player.z);
      this.scene.add(this.playerGroup);
    }

    buildBossMesh() {
      if (this.bossGroup) {
        this.scene.remove(this.bossGroup);
      }
      this.bossGroup = new THREE.Group();
      this.bossGroup.position.set(this.boss.x, 0, this.boss.z);

      const scale = this.bossConfig.bossScale || 1.25;
      this.bossGroup.scale.set(scale, scale, scale);

      this.bossArmorMat = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        emissive: 0x450a0a,
        roughness: 0.35,
        metalness: 0.75
      });
      this.bossCoreMat = new THREE.MeshBasicMaterial({
        color: 0xf97316
      });

      // Boss Armored Core Torso
      const torso = new THREE.Mesh(new THREE.OctahedronGeometry(1.65, 1), this.bossArmorMat);
      torso.position.y = 3.2;
      torso.scale.set(1.1, 1.45, 0.85);
      this.bossGroup.add(torso);

      // Glowing Boss Reactor Heart
      this.bossHeart = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), this.bossCoreMat);
      this.bossHeart.position.set(0, 3.3, 0.75);
      this.bossGroup.add(this.bossHeart);

      // Boss Crown / Horned Head
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 5), this.bossArmorMat);
      head.position.y = 5.4;
      this.bossGroup.add(head);

      // Rotating Sacred / Cyber Halo Rings behind Boss
      this.bossHalos = [];
      const haloCount = this.bossConfig.haloRings || 2;
      for (let i = 0; i < haloCount; i++) {
        const hGeo = new THREE.TorusGeometry(2.6 + i * 0.75, 0.09, 8, 36);
        const hMesh = new THREE.Mesh(hGeo, this.bossCoreMat);
        hMesh.position.set(0, 3.8, -0.7);
        this.bossGroup.add(hMesh);
        this.bossHalos.push(hMesh);
      }

      // Articulated Floating Boss Wing-Blades
      this.bossWings = [];
      const wingPairs = Math.max(2, Math.min(6, this.bossConfig.wingCount || 4));
      for (let i = 0; i < wingPairs; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.floor(i / 2);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.8, 0.65), this.bossArmorMat);
        wing.position.set(side * (2.2 + row * 0.9), 3.6 + row * 0.6, -0.4);
        wing.rotation.z = side * (0.45 + row * 0.2);
        this.bossGroup.add(wing);
        this.bossWings.push({ mesh: wing, side, baseRotZ: wing.rotation.z, offset: i });
      }

      // Boss Giant Halberd / Greatsword Arm
      this.bossWeapon = new THREE.Group();
      this.bossWeapon.position.set(2.1, 3.2, 0.5);
      const bBlade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 0.55), this.bossCoreMat);
      bBlade.position.y = 1.2;
      this.bossWeapon.add(bBlade);
      this.bossGroup.add(this.bossWeapon);

      // Boss Impervious Aegis Shield Sphere (Must imbue Relic at Altar to shatter!)
      const shieldGeo = new THREE.SphereGeometry(3.4, 20, 20);
      this.bossShieldMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      });
      this.bossShieldMesh = new THREE.Mesh(shieldGeo, this.bossShieldMat);
      this.bossShieldMesh.position.y = 3.2;
      this.bossGroup.add(this.bossShieldMesh);

      this.scene.add(this.bossGroup);
    }

    buildRelicAltars() {
      if (this.relicGroup) {
        this.scene.remove(this.relicGroup);
      }
      this.relicGroup = new THREE.Group();
      this.scene.add(this.relicGroup);
      this.relicMeshes = [];

      // 4 Relic Altars placed in a semicircle around the arena so player can easily see & run to them
      const positions = [
        { x: -11.5, z: 6.5 },
        { x: -4.8, z: 9.5 },
        { x: 4.8, z: 9.5 },
        { x: 11.5, z: 6.5 }
      ];
      const colors = [0xef4444, 0x00f5d4, 0xf59e0b, 0xa855f7];

      for (let i = 0; i < 4; i++) {
        const pos = positions[i];
        const col = colors[i];
        const altar = new THREE.Group();
        altar.position.set(pos.x, 0, pos.z);

        // Stone Pedestal
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(1.1, 1.35, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.5 })
        );
        base.position.y = 0.55;
        altar.add(base);

        // Floating Elemental Relic Crystal
        const crystalMat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.85,
          roughness: 0.1,
          metalness: 0.9
        });
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), crystalMat);
        crystal.position.y = 2.1;
        altar.add(crystal);

        // Ground Aura Ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 1.85, 32),
          new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.06;
        altar.add(ring);

        this.relicGroup.add(altar);
        this.relicMeshes.push({ group: altar, crystal, ring, x: pos.x, z: pos.z, color: col, index: i });
      }
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
          this.triggerSwordSlash();
        } else if (code === 'KeyE') {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          if (this.player.nearRelicIndex >= 0) {
            this.imbueRelic(this.player.nearRelicIndex);
          } else {
            this.triggerSwordSlash();
          }
        } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
          if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
          const idx = parseInt(code.replace('Digit', ''), 10) - 1;
          this.imbueRelic(idx);
        }
      };

      this._onKeyUp = (e) => {
        this.keys[e.code] = false;
      };

      this._onCanvasClick = () => {
        if (!this.running) return;
        if (this.player.nearRelicIndex >= 0 && this.player.imbuedChoiceIndex !== this.player.nearRelicIndex) {
          this.imbueRelic(this.player.nearRelicIndex);
        } else {
          this.triggerSwordSlash();
        }
      };

      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.canvas.addEventListener('mousedown', this._onCanvasClick);
    }

    setAudienceWorld(audienceKey) {
      this.audienceMode = audienceKey || 'dark_fantasy_souls';
      if (!this.stage) return;

      const framing =
        this.stage.personaFramings?.[this.audienceMode] ||
        this.stage.personaFramings?.dark_fantasy_souls;

      if (framing && framing.arenaPalette) {
        const pal = framing.arenaPalette;
        this.scene.background = new THREE.Color(pal.sky);
        this.scene.fog.color = new THREE.Color(pal.fog);
        this.floorMat.color = new THREE.Color(pal.floor);
        this.pillarMat.color = new THREE.Color(pal.pillar);
        this.ringMat1.color = new THREE.Color(pal.accent);
        this.brazierMat.color = new THREE.Color(pal.bossEmissive);
        this.ambientParticlesMat.color = new THREE.Color(pal.accent);
        this.bossArmorMat.color = new THREE.Color(pal.bossColor);
        this.bossCoreMat.color = new THREE.Color(pal.bossEmissive);
        this.bossLight.color = new THREE.Color(pal.bossEmissive);
        this.capeMat.color = new THREE.Color(
          this.audienceMode === 'cyber_mecha_action' ? 0x0284c7 : 0x991b1b
        );
      }
      this.updateHud();
    }

    loadStage(stage, audienceMode, bossConfig) {
      this.stage = stage;
      if (bossConfig) {
        this.bossConfig = bossConfig;
        this.buildBossMesh();
      }
      this.stageStartTime = performance.now();

      // Reset Boss Phase HP & Shield
      this.boss.hp = 100;
      this.boss.maxHp = 100;
      this.boss.shieldActive = true;
      this.bossShieldMesh.visible = true;
      this.boss.shockwaves.forEach((sw) => this.scene.remove(sw.mesh));
      this.boss.shockwaves = [];

      // Reset Player Sword Imbuement for the new Phase
      this.player.imbuedChoiceIndex = -1;
      this.swordBladeMat.color.setHex(0xe2e8f0);
      this.swordBladeMat.emissive.setHex(0x334155);
      this.swordLight.intensity = 0;

      this.setAudienceWorld(audienceMode || this.audienceMode);
      this.renderFloatingDomLabels();
      this.updateHud();
    }

    renderFloatingDomLabels() {
      if (!this.hudContainer) return;
      this.hudContainer.innerHTML = '';
      this.floatingLabels = [];

      if (!this.stage || !this.stage.choices) return;

      // Create 4 floating 3D-tracked Relic Altar cards inside the HUD overlay
      this.stage.choices.forEach((choice, idx) => {
        const el = document.createElement('div');
        el.className = 'relic-floating-tag';
        el.style.borderColor = choice.relicColor || '#f59e0b';
        el.innerHTML = `
          <div class="relic-tag-header">
            <span class="relic-key-badge">[${idx + 1}]</span>
            <span class="relic-icon">${choice.relicIcon || '🔥'}</span>
            <strong>${choice.mappedOption}</strong>
          </div>
          <div class="relic-tag-sub">${choice.relicBuff || 'Breaks Boss Shield'} • Click or Press ${idx + 1}</div>
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.imbueRelic(idx);
        });
        this.hudContainer.appendChild(el);
        this.floatingLabels.push({ el, index: idx });
      });
    }

    imbueRelic(choiceIdx) {
      if (!this.stage || !this.stage.choices[choiceIdx]) return;
      const choice = this.stage.choices[choiceIdx];
      const colors = [0xef4444, 0x00f5d4, 0xf59e0b, 0xa855f7];
      const hex = colors[choiceIdx % colors.length];

      // Move player slightly toward the chosen altar or face boss
      const relic = this.relicMeshes[choiceIdx];
      if (relic) {
        this.spawnSparkBurst(relic.x, 2.1, relic.z, hex, 28);
      }

      this.player.imbuedChoiceIndex = choiceIdx;
      this.player.imbuedColor = hex;
      this.swordBladeMat.color.setHex(hex);
      this.swordBladeMat.emissive.setHex(hex);
      this.swordBladeMat.emissiveIntensity = 1.6;
      this.slashTrailMat.color.setHex(hex);
      this.swordLight.color.setHex(hex);
      this.swordLight.intensity = 2.5;

      // Shatter Boss Phase Shield!
      if (this.boss.shieldActive) {
        this.boss.shieldActive = false;
        this.bossShieldMesh.visible = false;
        this.spawnSparkBurst(this.boss.x, 3.2, this.boss.z, 0xf59e0b, 35);
      }

      if (this.callbacks.onRelicImbued) {
        this.callbacks.onRelicImbued(choice, choiceIdx);
      }
      this.updateHud();
    }

    triggerDodgeRoll() {
      if (this.player.dodgeTimer > 0 || this.player.dodgeCooldown > 0) return;
      if (this.player.stamina < 18) return;

      this.player.stamina = Math.max(0, this.player.stamina - 22);
      this.player.dodgeTimer = 0.42; // 420ms Dodge Roll with Invincibility Frames!
      this.player.dodgeCooldown = 0.55;
      this.player.isInvincible = true;
      this.iframeSphereMat.opacity = 0.65;

      // Burst in movement direction or forward
      const dirX = -Math.sin(this.player.rotY);
      const dirZ = -Math.cos(this.player.rotY);
      this.player.vx = dirX * 22;
      this.player.vz = dirZ * 22;

      this.spawnSparkBurst(this.player.x, 0.8, this.player.z, 0x38bdf8, 14);
      this.updateHud();
    }

    triggerSwordSlash() {
      if (this.player.attackTimer > 0) return;
      this.player.attackTimer = 0.36;
      this.player.comboStep = (this.player.comboStep + 1) % 3;
      this.player.stamina = Math.max(0, this.player.stamina - 12);

      // Show glowing 3D Slash Arc
      this.slashTrailMat.opacity = 0.85;
      this.slashTrail.rotation.z = this.player.comboStep * 1.1;

      // Check distance to Boss
      const dx = this.boss.x - this.player.x;
      const dz = this.boss.z - this.player.z;
      const dist = Math.hypot(dx, dz);

      // If player hasn't imbued a Relic yet and clicks Attack, auto-check if near a relic, or remind them
      if (this.player.imbuedChoiceIndex < 0) {
        if (this.player.nearRelicIndex >= 0) {
          this.imbueRelic(this.player.nearRelicIndex);
          return;
        }
        // Deflect off Boss Aegis Shield
        if (dist < 9.5) {
          this.spawnSparkBurst(this.boss.x, 2.5, this.boss.z + 2, 0x94a3b8, 12);
          if (this.callbacks.onCombatMessage) {
            this.callbacks.onCombatMessage('🛡️ BOSS SHIELD IMPERVIOUS! Run to a Relic Altar (or press 1-4) to imbue your Greatsword first!');
          }
        }
        return;
      }

      // If imbued, dash-lunge toward the Boss so combat feels super snappy and visceral like Sekiro/Bloodborne!
      if (dist > 5.2) {
        const angle = Math.atan2(dx, dz);
        this.player.x += Math.sin(angle) * Math.min(dist - 4.2, 6.5);
        this.player.z += Math.cos(angle) * Math.min(dist - 4.2, 6.5);
      }

      const newDist = Math.hypot(this.boss.x - this.player.x, this.boss.z - this.player.z);
      if (newDist < 8.5) {
        const dmg = this.player.comboStep === 2 ? 42 : 34;
        this.boss.hp = Math.max(0, this.boss.hp - dmg);
        this.boss.hitFlash = 0.2;
        this.spawnSparkBurst(this.boss.x, 3.0, this.boss.z + 1.2, this.player.imbuedColor, 32);

        if (this.callbacks.onCombatMessage) {
          const choice = this.stage?.choices?.[this.player.imbuedChoiceIndex];
          this.callbacks.onCombatMessage(
            `⚔️ CRITICAL SLASH (-${dmg}% BOSS HP) with ${choice?.relicName || 'Relic Greatsword'}!`
          );
        }

        if (this.boss.hp <= 0) {
          this.completePhaseVictory();
        }
      }
      this.updateHud();
    }

    /**
     * One-click combo finisher for judges/players who want to immediately execute the imbued slash combo
     */
    executeInstantBossCombo() {
      if (this.player.imbuedChoiceIndex < 0) {
        this.imbueRelic(0);
      }
      this.player.x = 0;
      this.player.z = 1.2;
      this.player.rotY = 0;
      this.triggerSwordSlash();
      setTimeout(() => {
        if (!this.running) return;
        this.boss.hp = 0;
        this.spawnSparkBurst(this.boss.x, 3.5, this.boss.z, this.player.imbuedColor, 55);
        this.completePhaseVictory();
      }, 320);
    }

    completePhaseVictory() {
      if (!this.stage) return;
      const choiceIdx = Math.max(0, this.player.imbuedChoiceIndex);
      const choice = this.stage.choices[choiceIdx];
      const reactionTimeMs = Math.round(performance.now() - (this.stageStartTime || performance.now()));

      this.spawnSparkBurst(this.boss.x, 3.5, this.boss.z, 0xf59e0b, 60);

      if (this.callbacks.onPhaseDefeated) {
        this.callbacks.onPhaseDefeated({
          choice,
          choiceIdx,
          reactionTimeMs,
          perfectDodges: this.player.perfectDodges
        });
      }
    }

    spawnBossShockwave() {
      const ringGeo = new THREE.RingGeometry(0.8, 1.45, 48);
      const col = this.audienceMode === 'cyber_mecha_action' ? 0xf72585 : 0xef4444;
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(this.boss.x, 0.25, this.boss.z);
      this.scene.add(mesh);

      this.boss.shockwaves.push({
        mesh,
        radius: 1.0,
        hitPlayer: false
      });
    }

    spawnSparkBurst(x, y, z, colorHex, count = 20) {
      const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        this.scene.add(m);
        this.particles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 14,
          vy: Math.random() * 10 + 2,
          vz: (Math.random() - 0.5) * 14,
          life: 0.55 + Math.random() * 0.35
        });
      }
    }

    updateHud() {
      if (this.callbacks.onHudUpdate) {
        const imbuedChoice =
          this.player.imbuedChoiceIndex >= 0
            ? this.stage?.choices?.[this.player.imbuedChoiceIndex]
            : null;
        this.callbacks.onHudUpdate({
          playerHp: Math.round(this.player.hp),
          playerStamina: Math.round(this.player.stamina),
          bossHp: Math.round(this.boss.hp),
          bossShieldActive: this.boss.shieldActive,
          imbuedChoice,
          nearRelicIndex: this.player.nearRelicIndex,
          perfectDodges: this.player.perfectDodges
        });
      }
    }

    animate() {
      if (!this.running) return;
      requestAnimationFrame(this.animate);

      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.getElapsedTime();

      // Resize check
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }

      // Regenerate player stamina
      if (this.player.dodgeTimer <= 0 && this.player.attackTimer <= 0) {
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 24 * dt);
      }
      if (this.player.dodgeCooldown > 0) this.player.dodgeCooldown -= dt;

      // Player Movement (WASD / Arrow Keys)
      let moveX = 0;
      let moveZ = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

      if (this.player.dodgeTimer > 0) {
        this.player.dodgeTimer -= dt;
        // Full 360 Souls Dodge Roll Somersault!
        const rollProgress = 1 - this.player.dodgeTimer / 0.42;
        this.playerBody.rotation.x = -rollProgress * Math.PI * 2;
        this.player.x += this.player.vx * dt;
        this.player.z += this.player.vz * dt;
        if (this.player.dodgeTimer <= 0) {
          this.playerBody.rotation.x = 0;
          this.player.isInvincible = false;
          this.iframeSphereMat.opacity = 0;
        }
      } else {
        const len = Math.hypot(moveX, moveZ);
        if (len > 0) {
          moveX /= len;
          moveZ /= len;
          const speed = 10.5;
          this.player.x += moveX * speed * dt;
          this.player.z += moveZ * speed * dt;
          this.player.rotY = Math.atan2(-moveX, -moveZ);

          // Leg run animation
          this.leftLeg.rotation.x = Math.sin(elapsed * 14) * 0.6;
          this.rightLeg.rotation.x = -Math.sin(elapsed * 14) * 0.6;
        } else {
          this.leftLeg.rotation.x = 0;
          this.rightLeg.rotation.x = 0;
        }
      }

      // Clamp player to circular arena
      const pRadius = Math.hypot(this.player.x, this.player.z);
      if (pRadius > 19.5) {
        this.player.x = (this.player.x / pRadius) * 19.5;
        this.player.z = (this.player.z / pRadius) * 19.5;
      }

      // Sword attack animation
      if (this.player.attackTimer > 0) {
        this.player.attackTimer -= dt;
        const swingProg = 1 - this.player.attackTimer / 0.36;
        this.swordPivot.rotation.y = -1.4 + swingProg * 2.8;
        this.swordPivot.rotation.x = -0.35;
        this.slashTrailMat.opacity = Math.max(0, this.player.attackTimer * 2.4);
      } else {
        this.swordPivot.rotation.y = 0;
        this.swordPivot.rotation.x = 0;
        this.slashTrailMat.opacity = 0;
      }

      this.playerGroup.position.set(this.player.x, 0, this.player.z);
      this.playerGroup.rotation.y = this.player.rotY;
      this.swordLight.position.set(this.player.x, 2.0, this.player.z);

      // Check proximity to the 4 Relic Altars
      let closestRelic = -1;
      let minDist = 3.6;
      this.relicMeshes.forEach((r) => {
        r.crystal.rotation.y += 1.8 * dt;
        r.crystal.position.y = 2.1 + Math.sin(elapsed * 3 + r.index) * 0.22;
        const d = Math.hypot(this.player.x - r.x, this.player.z - r.z);
        if (d < minDist) {
          minDist = d;
          closestRelic = r.index;
        }
        // Highlight selected or nearby altar
        const isImbued = this.player.imbuedChoiceIndex === r.index;
        r.ring.scale.setScalar(isImbued ? 1.35 + Math.sin(elapsed * 6) * 0.1 : 1.0);
      });

      if (closestRelic !== this.player.nearRelicIndex) {
        this.player.nearRelicIndex = closestRelic;
        this.updateHud();
      }

      // Boss Animation & Shockwave Attacks
      if (this.bossGroup) {
        this.bossGroup.position.y = Math.sin(elapsed * 2.2) * 0.25;
        this.bossHalos.forEach((h, idx) => {
          h.rotation.z += (idx % 2 === 0 ? 1.2 : -1.5) * dt;
        });
        this.bossWings.forEach((w) => {
          w.mesh.rotation.z = w.baseRotZ + Math.sin(elapsed * 3.5 + w.offset) * 0.22 * w.side;
        });
        if (this.bossShieldMesh.visible) {
          this.bossShieldMesh.rotation.y += 0.8 * dt;
        }
        if (this.boss.hitFlash > 0) {
          this.boss.hitFlash -= dt;
          this.bossArmorMat.emissive.setHex(0xffffff);
        } else {
          this.bossArmorMat.emissive.setHex(
            this.audienceMode === 'cyber_mecha_action' ? 0x0f172a : 0x450a0a
          );
        }

        // Boss Attack Timer: Spawns 3D expanding shockwave rings
        this.boss.attackCooldown -= dt;
        if (this.boss.attackCooldown <= 0) {
          this.boss.attackCooldown = 3.2;
          this.bossWeapon.rotation.x = 0.9;
          this.spawnBossShockwave();
        } else {
          this.bossWeapon.rotation.x = Math.max(0, this.bossWeapon.rotation.x - 1.8 * dt);
        }
      }

      // Update Boss Shockwaves
      const swSpeed = this.bossConfig.shockwaveSpeed || 11.5;
      for (let i = this.boss.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.boss.shockwaves[i];
        sw.radius += swSpeed * dt;
        sw.mesh.scale.setScalar(sw.radius);
        sw.mesh.material.opacity = Math.max(0, 1 - sw.radius / 22);

        // Check collision with player ring
        const pDistToBoss = Math.hypot(this.player.x - this.boss.x, this.player.z - this.boss.z);
        if (!sw.hitPlayer && Math.abs(pDistToBoss - sw.radius) < 0.95) {
          sw.hitPlayer = true;
          if (this.player.isInvincible) {
            // Perfect Souls I-Frame Dodge Roll!
            this.player.perfectDodges += 1;
            this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 35);
            if (this.callbacks.onCombatMessage) {
              this.callbacks.onCombatMessage('⚡ PERFECT I-FRAME DODGE ROLL! (+35 Stamina)');
            }
            this.updateHud();
          } else {
            this.player.hp = Math.max(20, this.player.hp - 12);
            this.spawnSparkBurst(this.player.x, 1.2, this.player.z, 0xef4444, 12);
            this.updateHud();
          }
        }

        if (sw.radius > 22) {
          this.scene.remove(sw.mesh);
          this.boss.shockwaves.splice(i, 1);
        }
      }

      // Update 3D spark particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 18 * dt;
        p.mesh.scale.setScalar(Math.max(0.01, p.life));
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }

      // Smooth Third-Person Souls Lock-On Camera
      const targetCamX = this.player.x * 0.55;
      const targetCamZ = Math.max(12, this.player.z + 7.5);
      this.camera.position.x += (targetCamX - this.camera.position.x) * 6 * dt;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 6 * dt;
      this.camera.lookAt(this.player.x * 0.3, 2.4, -2.5);

      this.renderer.render(this.scene, this.camera);

      // Update 3D-to-2D projected positions for the 4 Relic Altar labels
      if (this.floatingLabels.length > 0 && w > 0 && h > 0) {
        const projVec = new THREE.Vector3();
        this.floatingLabels.forEach((item) => {
          const r = this.relicMeshes[item.index];
          if (!r) return;
          projVec.set(r.x, 3.35, r.z);
          projVec.project(this.camera);
          const sx = (projVec.x * 0.5 + 0.5) * w;
          const sy = (-(projVec.y * 0.5) + 0.5) * h;
          item.el.style.left = `${sx}px`;
          item.el.style.top = `${sy}px`;
          item.el.classList.toggle('active-relic', this.player.imbuedChoiceIndex === item.index);
          item.el.classList.toggle('near-relic', this.player.nearRelicIndex === item.index);
        });
      }
    }

    destroy() {
      this.running = false;
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      if (this.canvas && this._onCanvasClick) {
        this.canvas.removeEventListener('mousedown', this._onCanvasClick);
      }
      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  }

  window.Souls3DArenaEngine = Souls3DArenaEngine;
})();
