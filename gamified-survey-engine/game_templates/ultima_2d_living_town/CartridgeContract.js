/**
 * Standard Teammate Game Cartridge: Ultima 2D Living Town (Pixel-Art Systems)
 * Implements the standard Teammate Cartridge Interface:
 * - loadCompiledConfig(gameConfig): Ingests physical prop affordances, guard barks, and 16x16 pixel tilesets.
 * - onSurveyAction(telemetryPayload): Emits verified gameplay telemetry to /api/telemetry.
 */

export class Ultima2DTownCartridge {
  constructor(options = {}) {
    this.cartridgeId = 'ultima_2d_living_town';
    this.dimension = '2D';
    this.gameConfig = null;
    this.telemetryCallback = options.onSurveyAction || null;
    this.torchesLit = true;
    this.grabbedProp = null;
  }

  loadCompiledConfig(config) {
    this.gameConfig = config;
    this.torchesLit = true;
    this.grabbedProp = null;
    console.log(`[Cartridge: ${this.cartridgeId}] Loaded compiled config for '${config?.campaign_title}'`);
    return {
      status: 'ready',
      cartridgeId: this.cartridgeId,
      pixelTileset: config?.pixel_tileset || 'dungeon_ii_16x16',
      propsCount: config?.rooms?.[0]?.props?.length || 4
    };
  }

  onSurveyAction(actionType, detail = {}) {
    const payload = {
      cartridge_id: this.cartridgeId,
      action_type: actionType,
      timestamp: new Date().toISOString(),
      torches_lit: this.torchesLit,
      grabbed_prop: this.grabbedProp?.name || null,
      ...detail
    };

    if (actionType === 'TORCH_TOGGLED') {
      this.torchesLit = !this.torchesLit;
      payload.torches_lit = this.torchesLit;
    }

    if (typeof this.telemetryCallback === 'function') {
      this.telemetryCallback(payload);
    }
    return payload;
  }

  interactProp(prop) {
    if (prop.tag === 'flammable_barrel') {
      return this.onSurveyAction('BARREL_IGNITED', { prop_id: prop.prop_id, result: 'BARRICADE_SHATTERED' });
    }
    if (this.grabbedProp) {
      const dropped = this.grabbedProp;
      this.grabbedProp = null;
      return this.onSurveyAction('PROP_DROPPED', { prop_id: dropped.prop_id });
    } else {
      this.grabbedProp = prop;
      return this.onSurveyAction('PROP_GRABBED', { prop_id: prop.prop_id });
    }
  }
}

export default Ultima2DTownCartridge;
