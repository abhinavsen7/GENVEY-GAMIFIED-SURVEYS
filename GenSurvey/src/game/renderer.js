/**
 * Surveytopia - High-Fidelity 2D Canvas Renderer
 * Renders districts, neon architecture, animated NPCs, dynamic lighting, and particles.
 */

import { WORLD_WIDTH, WORLD_HEIGHT, DISTRICTS, BUILDINGS, PROPS, getCurrentDistrict } from './world.js';
import { NPCS } from './npc.js';

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 1300, y: 1010, zoom: 1.0 };
    this.particles = [];
    this.floatingTexts = [];
    this.time = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initAmbientParticles();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initAmbientParticles() {
    this.ambientParticles = [];
    for (let i = 0; i < 90; i++) {
      this.ambientParticles.push({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.4,
        radius: 1.5 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  addFloatingText(text, x, y, color = '#fbbf24') {
    this.floatingTexts.push({
      text,
      x,
      y,
      startY: y,
      color,
      alpha: 1.0,
      vy: -1.2,
      life: 0,
      maxLife: 75
    });
  }

  addBurstParticles(x, y, count = 15, color = '#f59e0b') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  updateCamera(player) {
    // Smooth camera lerp
    const targetX = player.x;
    const targetY = player.y;
    this.camera.x += (targetX - this.camera.x) * 0.08;
    this.camera.y += (targetY - this.camera.y) * 0.08;

    // Bounds clamping
    const halfW = (this.canvas.width / 2) / this.camera.zoom;
    const halfH = (this.canvas.height / 2) / this.camera.zoom;

    this.camera.x = Math.max(halfW, Math.min(WORLD_WIDTH - halfW, this.camera.x));
    this.camera.y = Math.max(halfH, Math.min(WORLD_HEIGHT - halfH, this.camera.y));
  }

  render(player, nearbyNpc) {
    this.time += 0.025;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Save camera transform
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Render World Districts & Roads
    this.renderGround(ctx);

    // 2. Render Props & Trees (Under characters)
    this.renderProps(ctx, player);

    // 3. Render Buildings
    this.renderBuildings(ctx, player);

    // 4. Render NPCs
    this.renderNPCs(ctx, player, nearbyNpc);

    // 5. Render Player
    this.renderPlayer(ctx, player);

    // 6. Render Pet
    this.renderPet(ctx, player);

    // 7. Ambient Floating Particles
    this.renderAmbientParticles(ctx);

    // 8. Dynamic Particles & Floating Text
    this.renderParticlesAndText(ctx);

    // Restore camera transform
    ctx.restore();

    // 9. Vignette & Subtle Scanlines / Glow
    this.renderLightingOverlay(ctx, w, h);
  }

  renderGround(ctx) {
    // Outer border grid
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Draw 4 Main District Ground Foundations
    DISTRICTS.forEach(d => {
      ctx.fillStyle = d.theme.pavementColor;
      ctx.fillRect(d.bounds.x, d.bounds.y, d.bounds.width, d.bounds.height);

      // District Border Neon Accent
      ctx.strokeStyle = d.theme.primary;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(d.bounds.x, d.bounds.y, d.bounds.width, d.bounds.height);
      ctx.globalAlpha = 1.0;

      // Special District Floors
      if (d.id === 'tech') {
        // Cyan cyber grid
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = d.bounds.x; x < d.bounds.x + d.bounds.width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, d.bounds.y);
          ctx.lineTo(x, d.bounds.y + d.bounds.height);
          ctx.stroke();
        }
        for (let y = d.bounds.y; y < d.bounds.y + d.bounds.height; y += step) {
          ctx.beginPath();
          ctx.moveTo(d.bounds.x, y);
          ctx.lineTo(d.bounds.x + d.bounds.width, y);
          ctx.stroke();
        }
      } else if (d.id === 'cinema') {
        // Star walk tiles
        ctx.fillStyle = 'rgba(236, 72, 153, 0.05)';
        for (let x = d.bounds.x + 60; x < d.bounds.x + d.bounds.width - 60; x += 120) {
          ctx.fillRect(x, d.bounds.y + 360, 40, 40);
        }
      } else if (d.id === 'auto') {
        // Yellow hazard curbs
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 12]);
        ctx.strokeRect(d.bounds.x + 20, d.bounds.y + 20, d.bounds.width - 40, d.bounds.height - 40);
        ctx.setLineDash([]);
      }
    });

    // Main Connecting Avenues / Boulevards
    ctx.fillStyle = '#1e293b';
    // Horizontal crossway
    ctx.fillRect(40, 920, WORLD_WIDTH - 80, 160);
    // Vertical crossway
    ctx.fillRect(1220, 40, 160, WORLD_HEIGHT - 80);

    // Crossway road markings (yellow center dashes)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 16]);
    ctx.beginPath();
    ctx.moveTo(40, 1000);
    ctx.lineTo(WORLD_WIDTH - 40, 1000);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(1300, 40);
    ctx.lineTo(1300, WORLD_HEIGHT - 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Plaza Circular Stone Pavers
    const cx = 1300;
    const cy = 1000;
    ctx.fillStyle = '#263147';
    ctx.beginPath();
    ctx.arc(cx, cy, 260, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Concentric plaza rings
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderProps(ctx, player) {
    for (const prop of PROPS) {
      if (prop.type === 'fountain') {
        // Holographic Central Fountain
        const fx = prop.x;
        const fy = prop.y;

        // Fountain Stone Basin
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(fx, fy, prop.radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Animated Water Ripple
        const rippleR = ((this.time * 20) % (prop.radius - 8)) + 6;
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx, fy, rippleR, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing Hologram Core
        const glow = Math.sin(this.time * 3) * 0.25 + 0.75;
        const grad = ctx.createRadialGradient(fx, fy, 4, fx, fy, 28);
        grad.addColorStop(0, `rgba(165, 180, 252, ${glow})`);
        grad.addColorStop(0.6, `rgba(99, 102, 241, ${glow * 0.7})`);
        grad.addColorStop(1, 'rgba(79, 70, 229, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fx, fy, 32, 0, Math.PI * 2);
        ctx.fill();

        // Holographic Floating Icons
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const floatY = Math.sin(this.time * 2) * 5;
        ctx.fillText('🌐', fx, fy + floatY);

      } else if (prop.type === 'tree') {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(prop.x + 4, prop.y + 12, prop.radius, prop.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#78350f';
        ctx.fillRect(prop.x - 4, prop.y - 2, 8, 16);

        // Leaves with subtle sway
        const sway = Math.sin(this.time * 1.5 + prop.x) * 2;
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(prop.x + sway, prop.y - 12, prop.radius, 0, Math.PI * 2);
        ctx.fill();

        // Highlight layer
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(prop.x + sway - 5, prop.y - 17, prop.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

      } else if (prop.type === 'bench') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(prop.x - prop.width / 2 + 2, prop.y + 6, prop.width, prop.height * 0.6);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2;
        ctx.strokeRect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height);

      } else if (prop.type === 'car') {
        // Car shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(prop.x - 28, prop.y - 14, 60, 32, 6);
        ctx.fill();

        // Car Body
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.roundRect(prop.x - 26, prop.y - 16, 56, 28, 6);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(prop.x - 10, prop.y - 12, 16, 20);

        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(prop.x - 20, prop.y - 19, 10, 4);
        ctx.fillRect(prop.x + 12, prop.y - 19, 10, 4);
        ctx.fillRect(prop.x - 20, prop.y + 11, 10, 4);
        ctx.fillRect(prop.x + 12, prop.y + 11, 10, 4);

      } else if (prop.type === 'lamp') {
        // Streetlamp
        ctx.fillStyle = '#475569';
        ctx.fillRect(prop.x - 3, prop.y - 30, 6, 30);
        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 32, 7, 0, Math.PI * 2);
        ctx.fill();

        // Ambient Lamp Light Pool
        const lGrad = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 70);
        lGrad.addColorStop(0, `${prop.color}44`);
        lGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 70, 0, Math.PI * 2);
        ctx.fill();

      } else if (prop.type === 'dumpster') {
        // Shady alleyway dumpster for Gobby
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(prop.x - 2, prop.y + prop.height - 4, prop.width + 4, 8);
        ctx.fillStyle = '#1e3a1e';
        ctx.fillRect(prop.x, prop.y, prop.width, prop.height);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(prop.x, prop.y, prop.width, prop.height);

        // Glitch particles hovering
        if (Math.random() < 0.3) {
          this.particles.push({
            x: prop.x + Math.random() * prop.width,
            y: prop.y + Math.random() * prop.height,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1 - Math.random(),
            radius: 2,
            color: '#4ade80',
            alpha: 0.9,
            decay: 0.05
          });
        }
      }
    }
  }

  renderBuildings(ctx, player) {
    for (const b of BUILDINGS) {
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(b.x + 8, b.y + b.height - 10, b.width, 24);

      // Building Wall Base
      ctx.fillStyle = b.wallColor;
      ctx.fillRect(b.x, b.y + 40, b.width, b.height - 40);

      // Building Roof
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(b.x - 6, b.y, b.width + 12, 44);

      // Glowing Facade Border
      ctx.strokeStyle = b.accentColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y + 40, b.width, b.height - 40);

      // Roof trim
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.3;
      ctx.strokeRect(b.x - 6, b.y, b.width + 12, 44);
      ctx.globalAlpha = 1.0;

      // Glowing Signboard with Icon & Name
      const signY = b.y + 12;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(b.x + 20, signY - 2, b.width - 40, 26, 6);
      ctx.fill();
      ctx.strokeStyle = b.accentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${b.icon} ${b.name}`, b.x + b.width / 2, signY + 11);

      // Windows
      const winCols = Math.floor(b.width / 60);
      const winW = 28;
      const winH = 34;
      for (let c = 0; c < winCols; c++) {
        const wx = b.x + 24 + c * 56;
        const wy = b.y + 60;
        if (wx + winW < b.x + b.width - 10) {
          ctx.fillStyle = b.accentColor;
          ctx.globalAlpha = 0.45 + Math.sin(this.time * 2 + c) * 0.15;
          ctx.fillRect(wx, wy, winW, winH);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(wx, wy, winW, winH);
          ctx.globalAlpha = 1.0;
        }
      }

      // Grand Entrance Door
      const doorW = 54;
      const doorH = 46;
      const doorX = b.x + (b.width - doorW) / 2;
      const doorY = b.y + b.height - doorH;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(doorX, doorY, doorW, doorH);
      ctx.strokeStyle = b.accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(doorX, doorY, doorW, doorH);

      // Door Welcome Rug
      ctx.fillStyle = b.accentColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(doorX - 6, doorY + doorH - 4, doorW + 12, 10);
      ctx.globalAlpha = 1.0;

      // VIP Stanchions & Velvet Rope for VIP Venues
      if (b.isVip) {
        const isUnlocked = player.unlockedVip.includes(b.vipNpcId);
        const postLeftX = doorX - 16;
        const postRightX = doorX + doorW + 16;
        const postY = doorY + doorH - 8;

        // Brass Posts
        ctx.fillStyle = '#eab308';
        ctx.fillRect(postLeftX - 3, postY - 24, 6, 24);
        ctx.fillRect(postRightX - 3, postY - 24, 6, 24);
        ctx.beginPath();
        ctx.arc(postLeftX, postY - 24, 5, 0, Math.PI * 2);
        ctx.arc(postRightX, postY - 24, 5, 0, Math.PI * 2);
        ctx.fill();

        // Velvet Rope
        if (!isUnlocked) {
          // Closed rope
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(postLeftX, postY - 20);
          ctx.quadraticCurveTo(doorX + doorW / 2, postY - 6, postRightX, postY - 20);
          ctx.stroke();

          // Locked VIP Badge
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('🔒 VIP SCREENER', doorX + doorW / 2, doorY - 10);
        } else {
          // Open rope
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(postLeftX, postY - 20);
          ctx.lineTo(postLeftX - 12, postY - 4);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(postRightX, postY - 20);
          ctx.lineTo(postRightX + 12, postY - 4);
          ctx.stroke();

          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#22c55e';
          ctx.fillText('✨ VIP UNLOCKED', doorX + doorW / 2, doorY - 10);
        }
      }
    }
  }

  renderNPCs(ctx, player, nearbyNpc) {
    for (const npc of NPCS) {
      const isLocked = npc.isVip && !player.unlockedVip.includes(npc.surveyId);
      const isCompleted = player.completedSurveys.includes(npc.surveyId);

      // Character Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(npc.x, npc.y + 14, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // If VIP and locked, render subtle translucent hologram effect
      if (isLocked) {
        ctx.globalAlpha = 0.55;
      }

      // Idle Bobbing
      const bob = Math.sin(this.time * 3 + npc.x) * 2;

      // Legs
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(npc.x - 7, npc.y + 6 + bob, 5, 8);
      ctx.fillRect(npc.x + 2, npc.y + 6 + bob, 5, 8);

      // Torso / Shirt
      ctx.fillStyle = npc.shirtColor;
      ctx.beginPath();
      ctx.roundRect(npc.x - 10, npc.y - 8 + bob, 20, 15, 3);
      ctx.fill();

      // Head
      ctx.fillStyle = npc.skinColor;
      ctx.beginPath();
      ctx.arc(npc.x, npc.y - 14 + bob, 9, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = npc.hairColor;
      ctx.beginPath();
      ctx.arc(npc.x, npc.y - 17 + bob, 8.5, Math.PI, Math.PI * 2);
      ctx.fill();

      // Hat / Headgear
      if (npc.hat === 'tophat') {
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(npc.x - 11, npc.y - 23 + bob, 22, 3);
        ctx.fillRect(npc.x - 7, npc.y - 34 + bob, 14, 12);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(npc.x - 7, npc.y - 25 + bob, 14, 2);
      } else if (npc.hat === 'chefhat') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(npc.x - 8, npc.y - 25 + bob, 16, 5);
        ctx.beginPath();
        ctx.arc(npc.x - 4, npc.y - 28 + bob, 6, 0, Math.PI * 2);
        ctx.arc(npc.x + 4, npc.y - 28 + bob, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (npc.hat === 'horns') {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(npc.x - 8, npc.y - 22 + bob);
        ctx.lineTo(npc.x - 12, npc.y - 32 + bob);
        ctx.lineTo(npc.x - 4, npc.y - 23 + bob);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(npc.x + 4, npc.y - 23 + bob);
        ctx.lineTo(npc.x + 12, npc.y - 32 + bob);
        ctx.lineTo(npc.x + 8, npc.y - 22 + bob);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;

      // Quest Overhead Indicator
      const markerY = npc.y - 38 + Math.sin(this.time * 4 + npc.x) * 4;

      if (isLocked) {
        // Locked VIP
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', npc.x, markerY);
      } else if (isCompleted) {
        // Completed green checkmark
        ctx.font = 'bold 14px "Outfit", sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        ctx.fillText('✅', npc.x, markerY);
      } else if (npc.isAttentionTrap) {
        // Attention Trap Goblin
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', npc.x, markerY);
      } else if (npc.isBouncer) {
        // Screener Bouncer
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🛡️', npc.x, markerY);
      } else {
        // Available Survey Quest Giver (Golden animated !)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(npc.x, markerY - 3, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1b4b';
        ctx.font = 'bold 13px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', npc.x, markerY - 3);
      }

      // NPC Name Label
      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      const nameW = ctx.measureText(npc.name).width + 12;
      ctx.fillRect(npc.x - nameW / 2, npc.y + 24, nameW, 16);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(npc.name, npc.x, npc.y + 32);

      // Interaction Prompt [E] when player is near
      if (nearbyNpc && nearbyNpc.id === npc.id) {
        const bubbleY = npc.y - 58 + Math.sin(this.time * 5) * 3;
        const promptText = isLocked ? 'Locked (Pass Screener)' : '[E] Talk';

        ctx.font = 'bold 12px "Outfit", sans-serif';
        const pW = ctx.measureText(promptText).width + 16;

        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(npc.x - pW / 2, bubbleY - 10, pW, 20, 10);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(promptText, npc.x, bubbleY);
      }
    }
  }

  renderPlayer(ctx, player) {
    const px = player.x;
    const py = player.y;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + 14, 15, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walking leg animation
    const walkOffset = player.isMoving ? Math.sin(player.animTime * 12) * 4 : 0;
    const bob = player.isMoving ? Math.abs(Math.sin(player.animTime * 12)) * 2 : 0;

    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px - 7, py + 6 + bob + walkOffset, 5, 8);
    ctx.fillRect(px + 2, py + 6 + bob - walkOffset, 5, 8);

    // Outfit Color
    let outfitColor = '#3b82f6';
    if (player.equipped.outfit === 'cyber') outfitColor = '#06b6d4';
    if (player.equipped.outfit === 'tuxedo') outfitColor = '#eab308';
    if (player.equipped.outfit === 'crimson') outfitColor = '#ef4444';
    if (player.equipped.outfit === 'emerald') outfitColor = '#10b981';

    // Torso / Jacket
    ctx.fillStyle = outfitColor;
    ctx.beginPath();
    ctx.roundRect(px - 10, py - 9 + bob, 20, 16, 4);
    ctx.fill();

    // Belt / detail
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 10, py + 4 + bob, 20, 3);

    // Arms
    ctx.fillStyle = outfitColor;
    if (player.isMoving) {
      ctx.fillRect(px - 14, py - 6 + bob - walkOffset, 4, 10);
      ctx.fillRect(px + 10, py - 6 + bob + walkOffset, 4, 10);
    } else {
      ctx.fillRect(px - 13, py - 6 + bob, 3.5, 10);
      ctx.fillRect(px + 9.5, py - 6 + bob, 3.5, 10);
    }

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(px, py - 15 + bob, 9.5, 0, Math.PI * 2);
    ctx.fill();

    // Face / Eyes based on facing direction
    ctx.fillStyle = '#0f172a';
    if (player.facing === 'down') {
      ctx.fillRect(px - 4, py - 15 + bob, 2.5, 2.5);
      ctx.fillRect(px + 1.5, py - 15 + bob, 2.5, 2.5);
    } else if (player.facing === 'up') {
      // Back of head, only hair
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(px, py - 16 + bob, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (player.facing === 'left') {
      ctx.fillRect(px - 6, py - 15 + bob, 2.5, 2.5);
    } else if (player.facing === 'right') {
      ctx.fillRect(px + 3.5, py - 15 + bob, 2.5, 2.5);
    }

    // Hair (if not facing up)
    if (player.facing !== 'up') {
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(px, py - 18 + bob, 9, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // Equipped Headgear
    if (player.equipped.hat === 'cap') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(px, py - 21 + bob, 8, Math.PI, Math.PI * 2);
      ctx.fill();
      const brimDir = player.facing === 'left' ? -1 : 1;
      ctx.fillRect(px - 4, py - 20 + bob, 14 * brimDir, 3);
    } else if (player.equipped.hat === 'crown') {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(px - 8, py - 23 + bob);
      ctx.lineTo(px - 8, py - 30 + bob);
      ctx.lineTo(px - 4, py - 26 + bob);
      ctx.lineTo(px, py - 32 + bob);
      ctx.lineTo(px + 4, py - 26 + bob);
      ctx.lineTo(px + 8, py - 30 + bob);
      ctx.lineTo(px + 8, py - 23 + bob);
      ctx.closePath();
      ctx.fill();
    } else if (player.equipped.hat === 'vr') {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(px - 7, py - 17 + bob, 14, 5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 7, py - 17 + bob, 14, 5);
    } else if (player.equipped.hat === 'fedora') {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(px - 11, py - 23 + bob, 22, 3);
      ctx.fillRect(px - 7, py - 29 + bob, 14, 7);
    }

    // Player Name Tag & Level Badge
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const tag = `You (Lvl ${player.getLevel()})`;
    const tagW = ctx.measureText(tag).width + 12;
    ctx.fillRect(px - tagW / 2, py - 42, tagW, 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(tag, px, py - 34);
  }

  renderPet(ctx, player) {
    if (player.equipped.pet === 'none') return;

    // Follow behind player
    const lagX = player.x - (player.facing === 'right' ? 26 : player.facing === 'left' ? -26 : 0);
    const lagY = player.y + 12;
    const petBob = Math.sin(this.time * 6) * 3;

    if (player.equipped.pet === 'drone') {
      // Floating Cyber Drone
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(lagX, lagY - 20 + petBob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Drone Eye
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(lagX, lagY - 20 + petBob, 3, 0, Math.PI * 2);
      ctx.fill();

      // Holographic scan beam
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.moveTo(lagX, lagY - 14 + petBob);
      ctx.lineTo(lagX - 10, lagY + 4);
      ctx.lineTo(lagX + 10, lagY + 4);
      ctx.closePath();
      ctx.fill();
    } else if (player.equipped.pet === 'cat') {
      // Lucky Coin Cat
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(lagX, lagY + petBob, 7, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(lagX - 6, lagY - 5 + petBob);
      ctx.lineTo(lagX - 8, lagY - 11 + petBob);
      ctx.lineTo(lagX - 2, lagY - 7 + petBob);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(lagX + 2, lagY - 7 + petBob);
      ctx.lineTo(lagX + 8, lagY - 11 + petBob);
      ctx.lineTo(lagX + 6, lagY - 5 + petBob);
      ctx.fill();
    } else if (player.equipped.pet === 'dog') {
      // Cyber Shepherd
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(lagX - 6, lagY - 4 + petBob, 12, 8);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(lagX + 4, lagY - 6 + petBob, 4, 4); // Cyber collar
    }
  }

  renderAmbientParticles(ctx) {
    for (const p of this.ambientParticles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < 0) p.y = WORLD_HEIGHT;
      if (p.x < 0) p.x = WORLD_WIDTH;
      if (p.x > WORLD_WIDTH) p.x = 0;

      const alpha = (Math.sin(this.time * 2 + p.phase) * 0.3 + 0.5) * p.alpha;
      ctx.fillStyle = `rgba(165, 180, 252, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderParticlesAndText(ctx) {
    // Burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life++;
      ft.alpha = 1 - (ft.life / ft.maxLife);

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 15px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // Fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  renderLightingOverlay(ctx, w, h) {
    // Subtle dark vignette to emphasize focus
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(3, 7, 18, 0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
}
