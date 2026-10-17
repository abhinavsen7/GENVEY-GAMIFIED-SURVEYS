/**
 * Surveytopia - Heads-Up Display (HUD), Minimap, Quest Log & Navigation
 */

import { getCurrentDistrict, DISTRICTS } from '../game/world.js';
import { NPCS } from '../game/npc.js';
import { SURVEY_DATA } from '../data/surveys.js';
import { sound } from '../audio.js';

export class HUD {
  constructor(player, renderer, bank, wardrobe, dialogue) {
    this.player = player;
    this.renderer = renderer;
    this.bank = bank;
    this.wardrobe = wardrobe;
    this.dialogue = dialogue;

    this.currentDistrictId = null;
    this.joystickVec = { x: 0, y: 0 };
    this.isJoystickActive = false;

    this.bindDOM();
    this.initMobileControls();
  }

  bindDOM() {
    // Quick Nav Buttons
    document.getElementById('hud-btn-bank')?.addEventListener('click', () => this.bank.open());
    document.getElementById('hud-btn-wardrobe')?.addEventListener('click', () => this.wardrobe.open());
    document.getElementById('hud-btn-quests')?.addEventListener('click', () => this.openQuestLog());
    document.getElementById('hud-btn-map')?.addEventListener('click', () => this.openMapModal());
    document.getElementById('hud-btn-guide')?.addEventListener('click', () => this.openGuideModal());

    // Sound toggle
    const audioBtn = document.getElementById('hud-audio-btn');
    audioBtn?.addEventListener('click', () => {
      sound.init();
      const enabled = sound.toggle();
      audioBtn.innerHTML = enabled ? '🔊' : '🔇';
      audioBtn.title = enabled ? 'Mute Sound Effects' : 'Unmute Sound Effects';
    });

    // Honesty shield info click
    document.getElementById('hud-shield-container')?.addEventListener('click', () => {
      this.openShieldModal();
    });

    // Quest log close
    document.getElementById('quest-modal-close')?.addEventListener('click', () => {
      document.getElementById('quest-modal')?.classList.add('hidden');
    });

    // Map modal close
    document.getElementById('map-modal-close')?.addEventListener('click', () => {
      document.getElementById('map-modal')?.classList.add('hidden');
    });

    // Guide modal close
    document.getElementById('guide-modal-close')?.addEventListener('click', () => {
      document.getElementById('guide-modal')?.classList.add('hidden');
    });

    // Shield modal close
    document.getElementById('shield-modal-close')?.addEventListener('click', () => {
      document.getElementById('shield-modal')?.classList.add('hidden');
    });
  }

  initMobileControls() {
    const joyZone = document.getElementById('virtual-joystick-zone');
    const joyStick = document.getElementById('virtual-joystick-stick');
    const actionBtn = document.getElementById('mobile-action-btn');

    if (!joyZone || !joyStick) return;

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = joyZone.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
      this.isJoystickActive = true;
    };

    const onTouchMove = (e) => {
      if (!this.isJoystickActive) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dist = Math.hypot(dx, dy);
      const maxDist = 40;

      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);
      const moveX = Math.cos(angle) * clampedDist;
      const moveY = Math.sin(angle) * clampedDist;

      joyStick.style.transform = `translate(${moveX}px, ${moveY}px)`;
      this.joystickVec = {
        x: moveX / maxDist,
        y: moveY / maxDist
      };
    };

    const onTouchEnd = () => {
      this.isJoystickActive = false;
      joyStick.style.transform = 'translate(0px, 0px)';
      this.joystickVec = { x: 0, y: 0 };
    };

    joyZone.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    // Mobile Action Button (E / Interact)
    actionBtn?.addEventListener('click', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    });
  }

  update() {
    // Current District Check
    const district = getCurrentDistrict(this.player.x, this.player.y);
    if (district.id !== this.currentDistrictId) {
      this.currentDistrictId = district.id;
      this.showDistrictBanner(district);
    }

    // Top Stats Bar
    const coinsEl = document.getElementById('hud-coins');
    const gemsEl = document.getElementById('hud-gems');
    const levelEl = document.getElementById('hud-level-badge');
    const xpFillEl = document.getElementById('hud-xp-fill');
    const xpTextEl = document.getElementById('hud-xp-text');
    const shieldPctEl = document.getElementById('hud-shield-pct');
    const shieldGaugeEl = document.getElementById('hud-shield-fill');

    if (coinsEl) {
      coinsEl.textContent = `${this.player.coins} ($${(this.player.coins / 100).toFixed(2)})`;
    }
    if (gemsEl) {
      gemsEl.textContent = this.player.gems;
    }
    if (levelEl) {
      levelEl.textContent = `Lvl ${this.player.getLevel()} ${this.player.getLevelTitle()}`;
    }

    const xpData = this.player.getXpProgress();
    if (xpFillEl) {
      xpFillEl.style.width = `${xpData.pct}%`;
    }
    if (xpTextEl) {
      xpTextEl.textContent = `${xpData.current}/${xpData.max} XP`;
    }

    // Shield Bar
    if (shieldPctEl) {
      shieldPctEl.textContent = `${this.player.trustScore}%`;
    }
    if (shieldGaugeEl) {
      shieldGaugeEl.style.width = `${this.player.trustScore}%`;
      if (this.player.trustScore >= 80) {
        shieldGaugeEl.style.backgroundColor = '#10b981';
      } else if (this.player.trustScore >= 50) {
        shieldGaugeEl.style.backgroundColor = '#f59e0b';
      } else {
        shieldGaugeEl.style.backgroundColor = '#ef4444';
      }
    }

    // Render Minimap
    this.renderMinimap();
  }

  showDistrictBanner(district) {
    const banner = document.getElementById('district-announcer');
    if (!banner) return;

    banner.innerHTML = `
      <div class="district-badge" style="border-color: ${district.theme.primary}; box-shadow: 0 0 20px ${district.theme.primary}44;">
        <span class="district-name">${district.name}</span>
        <span class="district-sub">${district.subtitle}</span>
      </div>
    `;

    banner.classList.remove('hidden');
    banner.classList.add('fade-in-bounce');

    setTimeout(() => {
      banner.classList.remove('fade-in-bounce');
      banner.classList.add('fade-out');
      setTimeout(() => banner.classList.add('hidden'), 500);
    }, 2800);
  }

  renderMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mw = canvas.width;
    const mh = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, mw, mh);

    const scaleX = mw / 2600;
    const scaleY = mh / 2000;

    // Draw district blocks
    DISTRICTS.forEach(d => {
      ctx.fillStyle = d.theme.pavementColor;
      ctx.fillRect(d.bounds.x * scaleX, d.bounds.y * scaleY, d.bounds.width * scaleX, d.bounds.height * scaleY);
      ctx.strokeStyle = d.theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(d.bounds.x * scaleX, d.bounds.y * scaleY, d.bounds.width * scaleX, d.bounds.height * scaleY);
    });

    // Draw Crossways
    ctx.fillStyle = '#334155';
    ctx.fillRect(40 * scaleX, 920 * scaleY, 2520 * scaleX, 160 * scaleY);
    ctx.fillRect(1220 * scaleX, 40 * scaleY, 160 * scaleX, 1920 * scaleY);

    // Draw NPCs
    for (const npc of NPCS) {
      const isDone = this.player.completedSurveys.includes(npc.surveyId);
      const isVip = npc.isVip;
      ctx.fillStyle = isDone ? '#10b981' : isVip ? '#8b5cf6' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(npc.x * scaleX, npc.y * scaleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(this.player.x * scaleX, this.player.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  openQuestLog() {
    sound.init();
    sound.playDialogueBlip();
    const modal = document.getElementById('quest-modal');
    const list = document.getElementById('quest-list-content');
    if (!modal || !list) return;

    list.innerHTML = Object.values(SURVEY_DATA).map(s => {
      const isDone = this.player.completedSurveys.includes(s.id);
      const isVip = s.isVip;
      const isBouncer = s.isBouncer;
      const isUnlocked = isVip ? this.player.unlockedVip.includes(s.id) : true;

      return `
        <div class="quest-log-card ${isDone ? 'done' : isVip && !isUnlocked ? 'locked' : ''}">
          <div class="quest-card-top">
            <span class="quest-avatar">${s.avatar || '📋'}</span>
            <div class="quest-meta">
              <h4>${s.title}</h4>
              <p>${s.npcName} (${s.district.toUpperCase()})</p>
            </div>
            <div class="quest-status-badge">
              ${isDone ? '✅ Completed' : isBouncer ? '🛡️ Screener' : isVip && !isUnlocked ? '🔒 VIP Locked' : '⭐ Available'}
            </div>
          </div>
          <div class="quest-card-bottom">
            <span>${isBouncer ? `Consolation: +${s.consolationCoins} Coins` : `Bounty: 🪙 +${s.rewardCoins} • 💎 +${s.rewardGems}`}</span>
            ${!isDone && isUnlocked && !isBouncer ? `
              <button class="teleport-btn rpg-btn" data-survey="${s.id}">Track NPC</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Teleport / track button
    list.querySelectorAll('.teleport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const surveyId = btn.dataset.survey;
        const npc = NPCS.find(n => n.surveyId === surveyId);
        if (npc) {
          this.player.x = npc.x;
          this.player.y = npc.y + 45;
          sound.playCoin();
          modal.classList.add('hidden');
          this.renderer.addFloatingText('Navigated to Quest Giver!', this.player.x, this.player.y - 20, '#38bdf8');
        }
      });
    });

    modal.classList.remove('hidden');
  }

  openMapModal() {
    sound.init();
    sound.playDialogueBlip();
    const modal = document.getElementById('map-modal');
    if (!modal) return;

    // Fast travel buttons
    modal.querySelectorAll('.fast-travel-card').forEach(card => {
      card.addEventListener('click', () => {
        const distId = card.dataset.district;
        const d = DISTRICTS.find(item => item.id === distId);
        if (d) {
          this.player.x = d.bounds.x + d.bounds.width / 2;
          this.player.y = d.bounds.y + d.bounds.height / 2;
          this.player.targetX = null;
          this.player.targetY = null;
          sound.playVipFanfare();
          modal.classList.add('hidden');
          this.renderer.addFloatingText(`Fast Traveled to ${d.name}!`, this.player.x, this.player.y - 20, '#10b981');
        }
      });
    });

    modal.classList.remove('hidden');
  }

  openShieldModal() {
    sound.init();
    sound.playDialogueBlip();
    const modal = document.getElementById('shield-modal');
    if (!modal) return;

    const shieldScore = document.getElementById('shield-modal-score');
    const shieldStatus = document.getElementById('shield-modal-status');

    if (shieldScore) shieldScore.textContent = `${this.player.trustScore}%`;
    if (shieldStatus) {
      if (this.player.trustScore >= 80) {
        shieldStatus.innerHTML = '<span class="badge-success">EXEMPLARY SCHOLAR (VIP ACCESS ACTIVE)</span>';
      } else if (this.player.trustScore >= 50) {
        shieldStatus.innerHTML = '<span class="badge-warning">GOOD STANDING (BE MINDFUL OF TRAPS)</span>';
      } else {
        shieldStatus.innerHTML = '<span class="badge-danger">PROBATION (RECOVER TRUST AT TOWN HALL)</span>';
      }
    }

    modal.classList.remove('hidden');
  }

  openGuideModal() {
    sound.init();
    sound.playDialogueBlip();
    document.getElementById('guide-modal')?.classList.remove('hidden');
  }
}
