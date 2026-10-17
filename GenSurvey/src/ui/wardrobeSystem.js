/**
 * Surveytopia - Avatar Customization & Gem Cosmetics Shop
 */

import { AVATAR_CUSTOMIZATION } from '../data/surveys.js';
import { sound } from '../audio.js';

export class WardrobeSystem {
  constructor(player, renderer) {
    this.player = player;
    this.renderer = renderer;
    this.modal = document.getElementById('wardrobe-modal');
    this.activeCategory = 'outfits'; // 'outfits' | 'hats' | 'pets'

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('wardrobe-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('wardrobe-tab-outfits')?.addEventListener('click', () => {
      this.activeCategory = 'outfits';
      this.render();
    });
    document.getElementById('wardrobe-tab-hats')?.addEventListener('click', () => {
      this.activeCategory = 'hats';
      this.render();
    });
    document.getElementById('wardrobe-tab-pets')?.addEventListener('click', () => {
      this.activeCategory = 'pets';
      this.render();
    });
  }

  open() {
    sound.init();
    sound.playDialogueBlip();
    this.modal.classList.remove('hidden');
    this.render();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  render() {
    const content = document.getElementById('wardrobe-grid');
    const gemsDisplay = document.getElementById('wardrobe-gems-count');
    if (!content) return;

    if (gemsDisplay) {
      gemsDisplay.textContent = this.player.gems;
    }

    // Toggle active category tabs
    document.querySelectorAll('.wardrobe-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === this.activeCategory);
    });

    const items = AVATAR_CUSTOMIZATION[this.activeCategory] || [];
    const equippedKey = this.activeCategory === 'outfits' ? 'outfit' : this.activeCategory === 'hats' ? 'hat' : 'pet';
    const currentEquipped = this.player.equipped[equippedKey];

    content.innerHTML = items.map(item => {
      const isUnlocked = item.costGems === 0 || this.player.unlockedItems.includes(item.id);
      const isEquipped = currentEquipped === item.id;
      const canAfford = this.player.gems >= item.costGems;

      return `
        <div class="wardrobe-card ${isEquipped ? 'equipped' : ''}">
          <div class="wardrobe-icon-box" style="${item.color ? `background: ${item.color}33; border-color: ${item.color}` : ''}">
            <span class="wardrobe-emoji">${item.icon || '👕'}</span>
          </div>
          <h4 class="wardrobe-name">${item.name}</h4>

          <div class="wardrobe-action">
            ${isEquipped ? `
              <span class="badge-equipped">Active</span>
            ` : isUnlocked ? `
              <button class="rpg-btn equip-btn" data-id="${item.id}" data-cat="${equippedKey}">Equip</button>
            ` : `
              <button class="rpg-btn buy-btn" data-id="${item.id}" data-cost="${item.costGems}" ${!canAfford ? 'disabled' : ''}>
                💎 ${item.costGems} Gems
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Equip handlers
    content.querySelectorAll('.equip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playSelect();
        const id = btn.dataset.id;
        const cat = btn.dataset.cat;
        this.player.equipped[cat] = id;
        this.player.saveState();
        this.renderer.addFloatingText(`Equipped ${id}!`, this.player.x, this.player.y - 20, '#38bdf8');
        this.render();
      });
    });

    // Buy handlers
    content.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cost = parseInt(btn.dataset.cost, 10);
        if (this.player.gems >= cost) {
          sound.playCoin();
          this.player.gems -= cost;
          this.player.unlockedItems.push(id);
          this.player.saveState();
          this.renderer.addFloatingText(`Unlocked!`, this.player.x, this.player.y - 20, '#fbbf24');
          this.render();
        } else {
          sound.playError();
        }
      });
    });
  }
}
