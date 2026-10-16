/**
 * GENVEY 3D SOULS ENGINE — FRONTEND CONTROLLER (Track 4)
 * Connects the Three.js 3D Souls Boss Arena, Audience World Switcher,
 * Player Cash/Gift Card Wallet, Company Studio Generator, and AMD/Gemma Status.
 */

const state = {
  companies: [],
  players: [],
  campaigns: [],
  rewardsCatalog: [],
  activeCampaignId: null,
  activePlayerId: null,
  activeStageIndex: 0,
  audienceMode: 'dark_fantasy_souls',
  recordedAnswers: [],
  soulsEngine: null,
  audioCtx: null
};

async function initApp() {
  bindTabs();
  bindControls();
  await fetchState();
  initSouls3DEngine();
  loadCampaignInto3DArena(getActiveCampaign());
  refreshAnalyticsPanel();
  checkAiStatusFast();
}

function bindTabs() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  document.getElementById('header-ai-pill')?.addEventListener('click', () => {
    document.querySelector('[data-tab="track4-tab"]')?.click();
  });
}

function getActiveCampaign() {
  return state.campaigns.find((c) => c.id === state.activeCampaignId) || state.campaigns[0];
}

function getActivePlayer() {
  return state.players.find((p) => p.id === state.activePlayerId) || state.players[0];
}

async function fetchState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  state.companies = data.companies || [];
  state.players = data.players || [];
  state.campaigns = data.campaigns || [];
  state.rewardsCatalog = data.rewardsCatalog || [];

  if (!state.activeCampaignId && state.campaigns[0]) {
    state.activeCampaignId = state.campaigns[0].id;
  }
  if (!state.activePlayerId && state.players[0]) {
    state.activePlayerId = state.players[0].id;
  }

  renderCampaignSelect();
  renderPlayerWallet();
}

function renderCampaignSelect() {
  const sel = document.getElementById('campaign-select');
  if (!sel) return;
  sel.innerHTML = state.campaigns
    .map((c) => `<option value="${c.id}" ${c.id === state.activeCampaignId ? 'selected' : ''}>${c.title} (+${c.rewardPoints} Coins)</option>`)
    .join('');
}

function renderPlayerWallet() {
  const player = getActivePlayer();
  if (!player) return;

  const pSel = document.getElementById('player-select');
  if (pSel) {
    pSel.innerHTML = state.players
      .map((p) => `<option value="${p.id}" ${p.id === player.id ? 'selected' : ''}>${p.name} (${p.points} Coins)</option>`)
      .join('');
  }

  document.getElementById('wallet-coins-display').textContent = `${player.points.toLocaleString()} Coins`;
  document.getElementById('wallet-level-display').textContent = `Level ${player.level || 1}`;
  document.getElementById('wallet-wins-display').textContent = `${player.gamesWon || 0} Bosses Slain`;

  const rewardsList = document.getElementById('rewards-list');
  if (rewardsList) {
    rewardsList.innerHTML = state.rewardsCatalog
      .map(
        (r) => `
        <div class="reward-item">
          <div class="reward-info">
            <strong>${r.icon} ${r.title}</strong>
            <span>Cost: ${r.pointsCost} Coins • ${r.badge}</span>
          </div>
          <button class="redeem-btn" onclick="redeemReward('${r.id}')">Redeem</button>
        </div>
      `
      )
      .join('');
  }

  const histEl = document.getElementById('redemptions-history');
  if (histEl) {
    if (!player.redemptions || player.redemptions.length === 0) {
      histEl.innerHTML = `<div class="muted-text">No redemptions yet. Defeat the Boss or redeem your Coins above!</div>`;
    } else {
      histEl.innerHTML = player.redemptions
        .map(
          (red) => `
          <div class="voucher-pill">
            <span><strong>${red.rewardTitle}</strong></span>
            <code>${red.voucherCode}</code>
          </div>
        `
        )
        .join('');
    }
  }
}

window.redeemReward = async function (rewardId) {
  const player = getActivePlayer();
  if (!player) return;

  const res = await fetch(`/api/players/${player.id}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Could not redeem reward.');
    return;
  }
  await fetchState();
};

function initSouls3DEngine() {
  const canvas = document.getElementById('souls-canvas');
  const labelsLayer = document.getElementById('relic-labels-layer');
  if (!canvas || !window.Souls3DArenaEngine) return;

  state.soulsEngine = new window.Souls3DArenaEngine(canvas, labelsLayer, {
    onHudUpdate: (hud) => {
      document.getElementById('hud-player-hp').style.width = `${hud.playerHp}%`;
      document.getElementById('hud-player-stam').style.width = `${hud.playerStamina}%`;
      document.getElementById('hud-boss-hp').style.width = `${hud.bossHp}%`;

      const shieldBadge = document.getElementById('hud-shield-badge');
      const imbuedEl = document.getElementById('hud-imbued-status');

      if (hud.imbuedChoice) {
        shieldBadge.textContent = `⚔️ SHIELD SHATTERED! Slash Boss [Click / J] with "${hud.imbuedChoice.mappedOption}"!`;
        shieldBadge.style.borderColor = '#10b981';
        shieldBadge.style.color = '#6ee7b7';
        imbuedEl.innerHTML = `🔥 Greatsword Imbued: <strong>${hud.imbuedChoice.relicIcon} ${hud.imbuedChoice.mappedOption}</strong>`;
      } else {
        shieldBadge.textContent = `🛡️ AEGIS SHIELD LOCKED — Run to a Relic Altar or Press [1–4] to Imbue!`;
        shieldBadge.style.borderColor = '#f59e0b';
        shieldBadge.style.color = '#fde68a';
        imbuedEl.innerHTML = `🗡️ Greatsword: <strong>Unattuned Steel (Choose a Relic [1–4] first)</strong>`;
      }
    },
    onRelicImbued: (choice, idx) => {
      const msgEl = document.getElementById('hud-combat-msg');
      msgEl.innerHTML = `🔥 <strong>GREATSWORD IMBUED WITH [${idx + 1}] "${choice.mappedOption}"!</strong> Boss Aegis Shield Shattered — Now Click or Press <strong>J</strong> to Slash the Boss!`;
      playSynthChord([261.63, 329.63, 523.25], 'triangle', 0.25);
    },
    onCombatMessage: (msg) => {
      document.getElementById('hud-combat-msg').innerHTML = msg;
    },
    onPhaseDefeated: ({ choice, reactionTimeMs }) => {
      handleBossPhaseDefeated(choice, reactionTimeMs);
    }
  });
}

function loadCampaignInto3DArena(campaign) {
  if (!campaign) return;
  state.activeCampaignId = campaign.id;
  state.activeStageIndex = 0;
  state.recordedAnswers = [];
  document.getElementById('victory-overlay')?.classList.add('hidden');

  loadCurrentStageInto3D();
}

function loadCurrentStageInto3D() {
  const campaign = getActiveCampaign();
  if (!campaign || !campaign.stages) return;

  const stage = campaign.stages[state.activeStageIndex];
  if (!stage) return;

  const framing =
    stage.personaFramings?.[state.audienceMode] ||
    stage.personaFramings?.dark_fantasy_souls;

  document.getElementById('hud-phase-pill').textContent = `BOSS PHASE ${stage.stageNumber} OF ${stage.totalStages} • ${framing?.worldTitle || campaign.setting}`;
  document.getElementById('hud-boss-name').textContent = framing?.bossName || campaign.title;
  document.getElementById('hud-question-text').textContent = `Survey Phase ${stage.stageNumber}: ${stage.hiddenSurveyQuestion?.originalQuestionText || ''}`;
  document.getElementById('hud-combat-msg').innerHTML = framing?.dialogue || stage.narrativePrompt;

  // Show WebAudio Synth strip if this stage tests audio
  const audioStrip = document.getElementById('hud-audio-strip');
  if (stage.stimulus?.type === 'audio_synth') {
    audioStrip.classList.remove('hidden');
  } else {
    audioStrip.classList.add('hidden');
  }

  if (state.soulsEngine) {
    state.soulsEngine.loadStage(stage, state.audienceMode, campaign.proceduralBossConfig);
  }
}

async function handleBossPhaseDefeated(choice, reactionTimeMs) {
  const campaign = getActiveCampaign();
  const stage = campaign?.stages?.[state.activeStageIndex];
  if (!stage) return;

  state.recordedAnswers.push({
    questionId: stage.hiddenSurveyQuestion?.questionId || `q_${state.activeStageIndex + 1}`,
    mappedOption: choice.mappedOption,
    reactionTimeMs: reactionTimeMs || 1800,
    impliedWTPMultiplier: choice.impliedWTPMultiplier || 1.0
  });

  playSynthChord([329.63, 440.0, 659.25], 'sine', 0.35);

  if (state.activeStageIndex + 1 < campaign.stages.length) {
    state.activeStageIndex += 1;
    loadCurrentStageInto3D();
  } else {
    // All Boss Phases Defeated! Submit session & reward player
    const avgMult =
      state.recordedAnswers.reduce((acc, a) => acc + (a.impliedWTPMultiplier || 1), 0) /
      Math.max(1, state.recordedAnswers.length);
    const impliedWTP = Math.round((campaign.basePrice || 49) * avgMult);

    const player = getActivePlayer();
    const res = await fetch(`/api/campaigns/${campaign.id}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player?.id,
        answers: state.recordedAnswers,
        impliedWTP,
        comboMultiplier: 1.3
      })
    });
    const data = await res.json();

    const overlay = document.getElementById('victory-overlay');
    if (overlay) {
      document.getElementById('victory-coins-pill').textContent =
        `+${data.rewardsEarned?.totalEarnedPoints || 550} Genvey Coins & +${data.rewardsEarned?.earnedXp || 360} XP Earned!`;
      overlay.classList.remove('hidden');
    }

    await fetchState();
    refreshAnalyticsPanel();
  }
}

function playSynthChord(notes, waveform = 'sine', duration = 0.4) {
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = state.audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = waveform;
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + duration);
      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + duration);
    });
  } catch (e) {
    console.warn('WebAudio synth preview skipped:', e);
  }
}

function bindControls() {
  // Campaign Select
  document.getElementById('campaign-select')?.addEventListener('change', (e) => {
    state.activeCampaignId = e.target.value;
    loadCampaignInto3DArena(getActiveCampaign());
    refreshAnalyticsPanel();
  });

  // Track 4 Live Audience World Switcher
  document.querySelectorAll('.aud-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.aud-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.audienceMode = btn.dataset.audience;
      if (state.soulsEngine) {
        state.soulsEngine.setAudienceWorld(state.audienceMode);
      }
      loadCurrentStageInto3D();
    });
  });

  // Combat Action Buttons
  document.getElementById('btn-dodge-roll')?.addEventListener('click', () => {
    state.soulsEngine?.triggerDodgeRoll();
  });
  document.getElementById('btn-sword-slash')?.addEventListener('click', () => {
    state.soulsEngine?.triggerSwordSlash();
  });
  document.getElementById('btn-fatal-combo')?.addEventListener('click', () => {
    state.soulsEngine?.executeInstantBossCombo();
  });

  // Multimodal WebAudio Synth Buttons
  document.getElementById('btn-play-synth-a')?.addEventListener('click', () => {
    playSynthChord([261.63, 329.63, 392.0, 523.25], 'sine', 0.55);
  });
  document.getElementById('btn-play-synth-b')?.addEventListener('click', () => {
    playSynthChord([293.66, 349.23, 440.0, 587.33], 'sawtooth', 0.45);
  });

  // Play Again button
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    loadCampaignInto3DArena(getActiveCampaign());
  });

  // Player Select & New Player Form
  document.getElementById('player-select')?.addEventListener('change', (e) => {
    state.activePlayerId = e.target.value;
    renderPlayerWallet();
  });

  document.getElementById('btn-toggle-new-player')?.addEventListener('click', () => {
    document.getElementById('new-player-form')?.classList.toggle('hidden');
  });

  document.getElementById('new-player-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-player-name').value.trim();
    const personaType = document.getElementById('new-player-persona').value;
    if (!name) return;

    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, personaType })
    });
    const data = await res.json();
    if (data.player) {
      state.activePlayerId = data.player.id;
      document.getElementById('new-player-name').value = '';
      document.getElementById('new-player-form').classList.add('hidden');
      await fetchState();
    }
  });

  // Company Studio: Generate New 3D Souls Boss Game
  document.getElementById('generate-game-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-compile-game');
    const origText = btn.textContent;
    btn.textContent = '⏳ Generating 3D Boss & Shaders with AI (Gemma 4 / AMD)...';
    btn.disabled = true;

    try {
      const companyName = document.getElementById('comp-name-input').value.trim();
      const industry = document.getElementById('comp-industry-input').value.trim();
      const genre = document.getElementById('comp-genre-input').value;
      const mediaType = document.getElementById('comp-media-input').value;
      const durationMinutes = Number(document.getElementById('comp-duration-input').value) || 5;

      const parseOpts = (id) =>
        document
          .getElementById(id)
          .value.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);

      const questions = [
        {
          id: 'q_custom_1',
          category: 'Phase 1: Core Feature Priority',
          text: document.getElementById('q1-text').value.trim(),
          options: parseOpts('q1-opts')
        },
        {
          id: 'q_custom_2',
          category: 'Phase 2: Multimodal Audio / Vibe',
          text: document.getElementById('q2-text').value.trim(),
          options: parseOpts('q2-opts')
        },
        {
          id: 'q_custom_3',
          category: 'Phase 3: Price & Value Tier',
          text: document.getElementById('q3-text').value.trim(),
          options: parseOpts('q3-opts')
        }
      ];

      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          industry,
          genre,
          mediaType,
          durationMinutes,
          questions
        })
      });
      const data = await res.json();
      if (data.campaign) {
        state.activeCampaignId = data.campaign.id;
        await fetchState();
        loadCampaignInto3DArena(data.campaign);
        await refreshAnalyticsPanel();

        // Update AI Generation Box
        const tel = data.aiTelemetry || {};
        const bossCfg = data.campaign.proceduralBossConfig || {};
        document.getElementById('gen-source-chip').textContent = `Source: ${tel.activeInferenceSource || 'Gemma 4 + Procedural 3D'}`;
        document.getElementById('gen-cost-chip').textContent = `Cost: $${tel.estimatedCostUsd || 0.00085} (${tel.totalTokens || 1300} tokens)`;
        document.getElementById('gen-lore-output').textContent = bossCfg.generatedBossLore || data.campaign.title;
        document.getElementById('gen-params-output').textContent =
          `3D Boss Scale: ${bossCfg.bossScale || 1.28}x • Articulated Wings: ${bossCfg.wingCount || 4} • Halo Rings: ${bossCfg.haloRings || 2} • Shockwave Speed: ${bossCfg.shockwaveSpeed || 12}m/s`;
      }
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  });

  // Track 4 AMD Config & Live Gemma Test
  document.getElementById('amd-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const logEl = document.getElementById('live-ping-log');
    logEl.textContent = 'Connecting to AMD Token Factory (notebooks.amd.com/tokenfactory)...';

    const amdEndpoint = document.getElementById('amd-endpoint-input').value.trim();
    const amdApiKey = document.getElementById('amd-key-input').value.trim();
    const amdModel = document.getElementById('amd-model-input').value.trim();

    const res = await fetch('/api/ai/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amdEndpoint, amdApiKey, amdModel, runLiveTest: false })
    });
    const data = await res.json();
    logEl.textContent = JSON.stringify(data, null, 2);
    updateTopAiBadge(data);
  });

  document.getElementById('btn-test-local-gemma')?.addEventListener('click', async () => {
    const logEl = document.getElementById('live-ping-log');
    logEl.textContent = 'Running live inference on Local Google Gemma 4 (gemma4:latest via Ollama on CPU — takes ~15-25s)...';
    const res = await fetch('/api/ai/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runLiveTest: true })
    });
    const data = await res.json();
    logEl.textContent = JSON.stringify(data, null, 2);
    updateTopAiBadge(data);
  });
}

async function refreshAnalyticsPanel() {
  const campaign = getActiveCampaign();
  if (!campaign) return;

  const res = await fetch(`/api/campaigns/${campaign.id}/analytics`);
  const data = await res.json();
  const analytics = data.analytics;
  if (!analytics) return;

  document.getElementById('analytics-sessions-count').textContent =
    `${analytics.totalCompletions} Completed Boss Raids`;

  const listEl = document.getElementById('simple-analytics-list');
  if (!listEl) return;

  listEl.innerHTML = (analytics.questionBreakdown || [])
    .map(
      (q) => `
      <div class="analytic-q-card">
        <h4>${q.questionText}</h4>
        ${(q.options || [])
          .map(
            (opt) => `
          <div class="opt-bar-row">
            <div class="opt-bar-label">
              <span>${opt.option}</span>
              <strong>${opt.convictionWeightedSharePct}% (${opt.rawCount} votes • ${opt.avgReactionTimeMs}ms)</strong>
            </div>
            <div class="opt-bar-track">
              <div class="opt-bar-fill" style="width: ${opt.convictionWeightedSharePct}%;"></div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
    )
    .join('');
}

async function checkAiStatusFast() {
  try {
    const res = await fetch('/api/ai/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runLiveTest: false })
    });
    const data = await res.json();
    updateTopAiBadge(data);
    const logEl = document.getElementById('live-ping-log');
    if (logEl) {
      logEl.textContent = JSON.stringify(data, null, 2);
    }
  } catch (e) {
    console.warn('Status check error:', e);
  }
}

function updateTopAiBadge(data) {
  const textEl = document.getElementById('ai-status-text');
  if (!textEl) return;
  if (data.amdOnline) {
    textEl.textContent = `🟢 AMD Cloud (${data.amdModel}): LIVE • Gemma 4 Local: Ready`;
  } else {
    const gemmaPart = data.gemmaOnline ? 'Gemma 4 Local: Online' : 'Gemma 4: Standby';
    textEl.textContent = `${gemmaPart} • AMD Key: Check Config`;
  }
}

window.addEventListener('DOMContentLoaded', initApp);
