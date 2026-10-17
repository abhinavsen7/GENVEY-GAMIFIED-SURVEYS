/**
 * Surveytopia - Player State, Movement, Stats, and Customization
 */

import { checkCollision } from './world.js';
import { sound } from '../audio.js';

const STORAGE_KEY = 'surveytopia_player_v1';

export class Player {
  constructor() {
    this.x = 1300;
    this.y = 1010;
    this.targetX = null;
    this.targetY = null;
    this.speed = 4.5;
    this.radius = 16;
    this.facing = 'down'; // 'down', 'up', 'left', 'right'
    this.isMoving = false;
    this.animTime = 0;
    this.stepAudioTimer = 0;

    // Survey & Economy Stats
    this.coins = 120;
    this.gems = 8;
    this.xp = 40;
    this.trustScore = 100; // 0 - 100% (Honesty Shield)
    this.completedSurveys = [];
    this.unlockedVip = [];
    this.disqualifiedScreeners = [];
    this.cashoutHistory = [];

    // Customization
    this.equipped = {
      outfit: 'casual',
      hat: 'none',
      pet: 'none'
    };
    this.unlockedItems = ['casual', 'none_hat', 'none_pet'];

    this.loadState();
  }

  saveState() {
    try {
      const data = {
        coins: this.coins,
        gems: this.gems,
        xp: this.xp,
        trustScore: this.trustScore,
        completedSurveys: this.completedSurveys,
        unlockedVip: this.unlockedVip,
        disqualifiedScreeners: this.disqualifiedScreeners,
        cashoutHistory: this.cashoutHistory,
        equipped: this.equipped,
        unlockedItems: this.unlockedItems,
        x: this.x,
        y: this.y
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save player state to localStorage:', e);
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.coins === 'number') this.coins = data.coins;
        if (typeof data.gems === 'number') this.gems = data.gems;
        if (typeof data.xp === 'number') this.xp = data.xp;
        if (typeof data.trustScore === 'number') this.trustScore = data.trustScore;
        if (Array.isArray(data.completedSurveys)) this.completedSurveys = data.completedSurveys;
        if (Array.isArray(data.unlockedVip)) this.unlockedVip = data.unlockedVip;
        if (Array.isArray(data.disqualifiedScreeners)) this.disqualifiedScreeners = data.disqualifiedScreeners;
        if (Array.isArray(data.cashoutHistory)) this.cashoutHistory = data.cashoutHistory;
        if (data.equipped) this.equipped = { ...this.equipped, ...data.equipped };
        if (Array.isArray(data.unlockedItems)) this.unlockedItems = data.unlockedItems;
        if (typeof data.x === 'number') this.x = data.x;
        if (typeof data.y === 'number') this.y = data.y;
      }
    } catch (e) {
      console.warn('Could not load player state from localStorage:', e);
    }
  }

  getLevel() {
    return Math.floor(this.xp / 100) + 1;
  }

  getLevelTitle() {
    const lvl = this.getLevel();
    if (lvl === 1) return 'Novice Surveyor';
    if (lvl === 2) return 'Data Scout';
    if (lvl === 3) return 'Market Analyst';
    if (lvl === 4) return 'Research Prodigy';
    return 'Survey Overlord';
  }

  getXpProgress() {
    const currentLvlBase = (this.getLevel() - 1) * 100;
    const progressInLvl = this.xp - currentLvlBase;
    return { current: progressInLvl, max: 100, pct: Math.min(100, Math.max(0, (progressInLvl / 100) * 100)) };
  }

  addRewards(coins, gems, xp, soundTrigger = true) {
    this.coins += coins;
    this.gems += gems;
    const oldLvl = this.getLevel();
    this.xp += xp;
    const newLvl = this.getLevel();

    if (soundTrigger) {
      if (newLvl > oldLvl) {
        sound.playVipFanfare();
      } else {
        sound.playCoin();
      }
    }
    this.saveState();
  }

  adjustTrust(delta) {
    this.trustScore = Math.max(10, Math.min(100, this.trustScore + delta));
    this.saveState();
  }

  moveToTarget(tx, ty) {
    this.targetX = tx;
    this.targetY = ty;
  }

  update(keys, joystickVec = null, dt = 1) {
    let dx = 0;
    let dy = 0;

    // Keyboard controls
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // Joystick override
    if (joystickVec && (Math.abs(joystickVec.x) > 0.1 || Math.abs(joystickVec.y) > 0.1)) {
      dx = joystickVec.x;
      dy = joystickVec.y;
      this.targetX = null;
      this.targetY = null;
    }

    // Click/tap to move
    if (this.targetX !== null && this.targetY !== null && dx === 0 && dy === 0) {
      const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y);
      if (dist > 6) {
        dx = (this.targetX - this.x) / dist;
        dy = (this.targetY - this.y) / dist;
      } else {
        this.targetX = null;
        this.targetY = null;
      }
    }

    // Normalize diagonal keyboard speed
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      this.isMoving = true;
      const nx = (dx / length) * this.speed;
      const ny = (dy / length) * this.speed;

      // Update facing
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx > 0 ? 'right' : 'left';
      } else {
        this.facing = dy > 0 ? 'down' : 'up';
      }

      // Test horizontal move
      const nextX = this.x + nx;
      if (!checkCollision(nextX, this.y, this.radius)) {
        this.x = nextX;
      }

      // Test vertical move
      const nextY = this.y + ny;
      if (!checkCollision(this.x, nextY, this.radius)) {
        this.y = nextY;
      }

      this.animTime += 0.2;
      this.stepAudioTimer += 0.2;
      if (this.stepAudioTimer > 1.8) {
        sound.playStep();
        this.stepAudioTimer = 0;
      }
    } else {
      this.isMoving = false;
      this.animTime = 0;
    }
  }
}
