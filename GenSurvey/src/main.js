/**
 * Surveytopia - Main Game Loop and Application Controller
 */

import './style.css';
import { Player } from './game/player.js';
import { WorldRenderer } from './game/renderer.js';
import { getNearbyNpc } from './game/npc.js';
import { sound } from './audio.js';
import { DialogueSystem } from './ui/dialogueSystem.js';
import { BankSystem } from './ui/bankSystem.js';
import { WardrobeSystem } from './ui/wardrobeSystem.js';
import { HUD } from './ui/hud.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.keys = {};
    this.player = new Player();
    this.renderer = new WorldRenderer(this.canvas);
    this.dialogue = new DialogueSystem(this.player, this.renderer);
    this.bank = new BankSystem(this.player, this.renderer);
    this.wardrobe = new WardrobeSystem(this.player, this.renderer);
    this.hud = new HUD(this.player, this.renderer, this.bank, this.wardrobe, this.dialogue);

    this.nearbyNpc = null;
    this.lastFrameTime = performance.now();

    this.bindInputs();
    this.startLoop();
  }

  bindInputs() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Handle dialogue open / interact
      if (e.code === 'KeyE' || e.code === 'Space') {
        if (!this.dialogue.isOpen && !this.isAnyModalOpen()) {
          this.handleInteraction();
        }
      }

      // Hotkey: Bank [B]
      if (e.code === 'KeyB') {
        if (!this.isAnyModalOpen()) this.bank.open();
        else if (this.bank.modal && !this.bank.modal.classList.contains('hidden')) this.bank.close();
      }

      // Hotkey: Quest Log [Q]
      if (e.code === 'KeyQ') {
        const questModal = document.getElementById('quest-modal');
        if (questModal?.classList.contains('hidden')) this.hud.openQuestLog();
        else questModal?.classList.add('hidden');
      }

      // Hotkey: World Map [M]
      if (e.code === 'KeyM') {
        const mapModal = document.getElementById('map-modal');
        if (mapModal?.classList.contains('hidden')) this.hud.openMapModal();
        else mapModal?.classList.add('hidden');
      }

      // Escape key closes modals
      if (e.code === 'Escape') {
        this.closeAllModals();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Canvas click-to-move / click-to-interact
    this.canvas.addEventListener('click', (e) => {
      sound.init();
      if (this.isAnyModalOpen()) return;

      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      // Convert screen coords to world coords via camera
      const w = this.canvas.width;
      const h = this.canvas.height;
      const worldX = (clickScreenX - w / 2) / this.renderer.camera.zoom + this.renderer.camera.x;
      const worldY = (clickScreenY - h / 2) / this.renderer.camera.zoom + this.renderer.camera.y;

      // Check if clicked directly on an NPC
      const targetNpc = getNearbyNpc(worldX, worldY, 40);
      if (targetNpc) {
        const dist = Math.hypot(targetNpc.x - this.player.x, targetNpc.y - this.player.y);
        if (dist < 85) {
          this.triggerNpcInteraction(targetNpc);
        } else {
          // Move towards NPC
          this.player.moveToTarget(targetNpc.x, targetNpc.y + 35);
        }
      } else {
        // Normal click-to-move
        this.player.moveToTarget(worldX, worldY);
      }
    });
  }

  isAnyModalOpen() {
    return (
      this.dialogue.isOpen ||
      !document.getElementById('bank-modal')?.classList.contains('hidden') ||
      !document.getElementById('wardrobe-modal')?.classList.contains('hidden') ||
      !document.getElementById('quest-modal')?.classList.contains('hidden') ||
      !document.getElementById('map-modal')?.classList.contains('hidden') ||
      !document.getElementById('shield-modal')?.classList.contains('hidden') ||
      !document.getElementById('guide-modal')?.classList.contains('hidden')
    );
  }

  closeAllModals() {
    this.dialogue.close();
    this.bank.close();
    this.wardrobe.close();
    document.getElementById('quest-modal')?.classList.add('hidden');
    document.getElementById('map-modal')?.classList.add('hidden');
    document.getElementById('shield-modal')?.classList.add('hidden');
    document.getElementById('guide-modal')?.classList.add('hidden');
  }

  handleInteraction() {
    if (this.nearbyNpc) {
      this.triggerNpcInteraction(this.nearbyNpc);
    }
  }

  triggerNpcInteraction(npc) {
    if (npc.interactiveType === 'bank') {
      this.bank.open();
    } else {
      this.dialogue.open(npc);
    }
  }

  startLoop() {
    const loop = (currentTime) => {
      const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = currentTime;

      // Don't move player if dialogue or bank modal is open
      if (!this.isAnyModalOpen()) {
        this.player.update(this.keys, this.hud.joystickVec, dt);
      }

      this.renderer.updateCamera(this.player);

      // Check nearby NPC
      this.nearbyNpc = getNearbyNpc(this.player.x, this.player.y, 80);

      // Render world & entities
      this.renderer.render(this.player, this.nearbyNpc);

      // Update HUD & minimap
      this.hud.update();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Boot application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
