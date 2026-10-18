/**
 * Teammate Game Cartridge: Shadow Requiem (3D Gothic Hack-and-Slash Action RPG)
 * Based on new-game-project (Godot 4 Core & WebGL Telemetry Bridge)
 * 
 * Features:
 * - Playable Gothic Swordsman with 24-bone skeleton & analytical two-bone IK weapon grip.
 * - 0.50s responsive dodge roll evasion with invulnerability frames (i-frames).
 * - Interactive Survey NPCs (Sir George & Rowan) dispensing survey questions and relic rewards.
 * - Real-time procedural 16-bit PCM sound synthesizer.
 */

export class ShadowRequiemCartridge {
  constructor(options = {}) {
    this.cartridgeId = 'shadow_requiem_hack_and_slash';
    this.dimension = '3D';
    this.gameConfig = null;
    this.telemetryCallback = options.onSurveyAction || null;
    this.playerGold = 0;
    this.equippedWeapon = { name: 'Shadow Blade', dmg: 48, speed: 1.2 };
    this.currentWave = 1;
    this.surveyResponses = {};
  }

  loadCompiledConfig(config) {
    this.gameConfig = config;
    this.playerGold = config?.starting_gold || 0;
    if (config?.weapons?.[0]) {
      this.equippedWeapon = config.weapons[0];
    }
    console.log(`[Cartridge: ${this.cartridgeId}] Initialized '${config?.campaign_title || 'Shadow Requiem'}'`);
    return {
      status: 'ready',
      cartridgeId: this.cartridgeId,
      dimension: '3D',
      hero: 'Gothic Swordsman',
      nativeGodotPath: 'game_templates/new-game-project',
      mainScene: 'res://main.tscn',
      weaponsCount: config?.weapons?.length || 3,
      npcsCount: 2
    };
  }

  onSurveyAction(actionType, detail = {}) {
    const payload = {
      cartridge_id: this.cartridgeId,
      action_type: actionType,
      timestamp: new Date().toISOString(),
      current_wave: this.currentWave,
      weapon_equipped: this.equippedWeapon?.name || 'Shadow Blade',
      ...detail
    };

    if (actionType === 'SURVEY_NPC_CONSULTED') {
      if (detail.answers) {
        this.surveyResponses[detail.wave || this.currentWave] = detail.answers;
      }
    } else if (actionType === 'WAVE_CLEARED') {
      this.currentWave = (this.currentWave || 1) + 1;
    }

    if (typeof this.telemetryCallback === 'function') {
      this.telemetryCallback(payload);
    }
    return payload;
  }

  getSurveyAffordances() {
    return [
      {
        npc_name: 'Sir George, Gothic Inquisitor',
        dialogue: 'What drove your decision to upgrade your weapon tier?',
        wave: 1,
        reward: 'heal_50'
      },
      {
        npc_name: 'Rowan, Relic Chronicler',
        dialogue: 'How does the difficulty pacing feel during multi-enemy swarms?',
        wave: 2,
        reward: 'energy_boost'
      }
    ];
  }

  getWeapons() {
    return [
      { id: 'shadow_blade', name: 'Shadow Blade', bonus: '+20% Speed' },
      { id: 'requiem_edge', name: 'Requiem Edge', bonus: '+25% Damage' },
      { id: 'great_sword', name: 'Great Sword of Judgment', bonus: 'AoE Cleave' }
    ];
  }
}

export default ShadowRequiemCartridge;
