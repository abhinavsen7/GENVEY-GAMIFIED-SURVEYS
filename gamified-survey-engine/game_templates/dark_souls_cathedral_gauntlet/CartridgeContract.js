/**
 * Standard Teammate Game Cartridge: Dark Souls Cathedral Gauntlet (3D Action)
 * Implements the standard Teammate Cartridge Interface:
 * - loadCompiledConfig(gameConfig): Ingests Gemma 4 decomposed survey data, mutated 3D assets, and gold economy.
 * - onSurveyAction(telemetryPayload): Emits verified gameplay telemetry to /api/telemetry.
 */

export class DarkSoulsCathedralCartridge {
  constructor(options = {}) {
    this.cartridgeId = 'dark_souls_cathedral_gauntlet';
    this.dimension = '3D';
    this.gameConfig = null;
    this.telemetryCallback = options.onSurveyAction || null;
    this.playerGold = 0;
    this.equippedWeapon = null;
    this.purchasedSurveyTiers = [];
  }

  loadCompiledConfig(config) {
    this.gameConfig = config;
    this.playerGold = config?.starting_gold || 0;
    this.equippedWeapon = config?.weapons?.[0] || null;
    console.log(`[Cartridge: ${this.cartridgeId}] Loaded compiled config for '${config?.campaign_title}'`);
    return {
      status: 'ready',
      cartridgeId: this.cartridgeId,
      zonesCount: config?.rooms?.length || 4,
      weaponsCount: config?.weapons?.length || 3,
      forgesCount: config?.survey_forges?.length || 2
    };
  }

  onSurveyAction(actionType, detail = {}) {
    const payload = {
      cartridge_id: this.cartridgeId,
      action_type: actionType,
      timestamp: new Date().toISOString(),
      player_gold_at_action: this.playerGold,
      weapon_equipped: this.equippedWeapon?.name || 'Vanguard Greatsword',
      ...detail
    };

    if (actionType === 'SURVEY_FORGE_PURCHASE') {
      const cost = detail.cost_gold || 0;
      this.playerGold = Math.max(0, this.playerGold - cost);
      this.purchasedSurveyTiers.push(detail.tier_name || 'Tier');
    } else if (actionType === 'CHEST_LOOTED') {
      this.playerGold += detail.gold_awarded || 10;
    }

    if (typeof this.telemetryCallback === 'function') {
      this.telemetryCallback(payload);
    }
    return payload;
  }

  getSurveyAffordances() {
    return this.gameConfig?.survey_encounters || [];
  }

  getEconomicTiers() {
    return this.gameConfig?.survey_forges || [
      {
        forge_id: 'forge_premium_tier',
        title: '$10 Sovereign Relic Upgrade',
        cost_gold: 10,
        grants_weapon: 'Sovereign Claymore',
        metric_intent: 'willingness_to_pay_premium_10_tier'
      },
      {
        forge_id: 'forge_micro_upgrade',
        title: '$2 Alchemical Flask Boost',
        cost_gold: 2,
        grants_buff: 'Flame Coating',
        metric_intent: 'willingness_to_pay_micro_2_tier'
      }
    ];
  }
}

export default DarkSoulsCathedralCartridge;
