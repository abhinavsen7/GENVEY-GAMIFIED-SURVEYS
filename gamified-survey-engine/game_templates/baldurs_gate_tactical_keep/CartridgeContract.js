/**
 * Standard Teammate Game Cartridge: Baldur's Gate Tactical Keep (3D Isometric CRPG)
 * Implements the standard Teammate Cartridge Interface:
 * - loadCompiledConfig(gameConfig): Ingests D20 skill checks, AP economy, and portcullis lever puzzles.
 * - onSurveyAction(telemetryPayload): Emits verified gameplay telemetry to /api/telemetry.
 */

export class BaldursGateKeepCartridge {
  constructor(options = {}) {
    this.cartridgeId = 'baldurs_gate_tactical_keep';
    this.dimension = '3D';
    this.gameConfig = null;
    this.telemetryCallback = options.onSurveyAction || null;
    this.apCurrent = 4;
    this.moveBudgetM = 8.0;
  }

  loadCompiledConfig(config) {
    this.gameConfig = config;
    this.apCurrent = 4;
    this.moveBudgetM = 8.0;
    console.log(`[Cartridge: ${this.cartridgeId}] Loaded compiled config for '${config?.campaign_title}'`);
    return {
      status: 'ready',
      cartridgeId: this.cartridgeId,
      d20Encounters: config?.survey_encounters?.length || 2,
      spellsCount: 5
    };
  }

  onSurveyAction(actionType, detail = {}) {
    const payload = {
      cartridge_id: this.cartridgeId,
      action_type: actionType,
      timestamp: new Date().toISOString(),
      ap_remaining: this.apCurrent,
      move_budget_remaining: this.moveBudgetM,
      ...detail
    };

    if (typeof this.telemetryCallback === 'function') {
      this.telemetryCallback(payload);
    }
    return payload;
  }

  castSpell(spellName, apCost = 1) {
    if (this.apCurrent < apCost) return false;
    this.apCurrent -= apCost;
    this.onSurveyAction('SPELL_CAST_AOE', { spell: spellName, ap_spent: apCost });
    return true;
  }

  endTurn() {
    this.apCurrent = 4;
    this.moveBudgetM = 8.0;
    this.onSurveyAction('AP_END_TURN', { turn_reset: true });
  }
}

export default BaldursGateKeepCartridge;
