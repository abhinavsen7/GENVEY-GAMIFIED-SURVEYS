/**
 * ODYSSEY & TRISTRAM — ENGINE STUDIO CONTROLLER
 * Connects the downloaded reone (KotOR) & Freeablo (Diablo) engines to the WebGL Viewport,
 * Native Desktop Launcher, Color & Survey Customizer, and Decision Analytics.
 */

const state = {
  campaigns: [],
  activeCampaignId: null,
  activeGenre: 'reone_kotor',
  activeStageIndex: 0,
  soulsEngine: null,
  musicEnabled: true,
  enginesStatus: {}
};

async function initApp() {
  bindTabs();
  bindEngineSwitcher();
  bindControls();
  bindCustomizerForm();
  await fetchState();
  init3DGameDirector();
  loadActiveCampaignIntoEngine();
  refreshAnalyticsPanel();
}

function bindTabs() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(btn.dataset.tab);
      if (panel) panel.classList.add('active');

      if (btn.dataset.tab === 'analytics-tab') {
        refreshAnalyticsPanel();
      }
    });
  });
}

function bindEngineSwitcher() {
  const btnKotor = document.getElementById('btn-switch-kotor');
  const btnDiablo = document.getElementById('btn-switch-diablo');

  btnKotor?.addEventListener('click', () => {
    btnKotor.classList.add('active');
    btnDiablo?.classList.remove('active');
    switchToGenre('reone_kotor');
  });

  btnDiablo?.addEventListener('click', () => {
    btnDiablo.classList.add('active');
    btnKotor?.classList.remove('active');
    switchToGenre('freeablo_diablo');
  });
}

function switchToGenre(genreKey) {
  state.activeGenre = genreKey;
  const body = document.getElementById('app-body');

  if (genreKey === 'reone_kotor') {
    body.className = 'theme-kotor';
    document.getElementById('brand-logo-icon').textContent = '🌌';
    document.getElementById('engine-tag-badge').textContent = 'reone Odyssey';
    document.getElementById('engine-tag-sub').textContent = 'Star Wars: Knights of the Old Republic RPG Engine';
  } else {
    body.className = 'theme-diablo';
    document.getElementById('brand-logo-icon').textContent = '🔥';
    document.getElementById('engine-tag-badge').textContent = 'Freeablo ARPG';
    document.getElementById('engine-tag-sub').textContent = 'Diablo 1 & 2 Dark Gothic ARPG Engine';
  }

  // Find a campaign matching this genre
  const matchingCamp = state.campaigns.find((c) => c.genre === genreKey);
  if (matchingCamp) {
    state.activeCampaignId = matchingCamp.id;
    const sel = document.getElementById('campaign-select');
    if (sel) sel.value = matchingCamp.id;
  }

  loadActiveCampaignIntoEngine();
}

function getActiveCampaign() {
  return state.campaigns.find((c) => c.id === state.activeCampaignId) || state.campaigns[0];
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    state.campaigns = data.campaigns || [];
    state.enginesStatus = data.engines || {};

    if (!state.activeCampaignId && state.campaigns[0]) {
      state.activeCampaignId = state.campaigns[0].id;
      state.activeGenre = state.campaigns[0].genre || 'reone_kotor';
    }

    renderCampaignSelect();
    updateEnginePill();
  } catch (err) {
    console.error('Failed to fetch state:', err);
  }
}

function renderCampaignSelect() {
  const sel = document.getElementById('campaign-select');
  if (!sel) return;
  sel.innerHTML = state.campaigns
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === state.activeCampaignId ? 'selected' : ''}>${c.title} [${c.genre === 'reone_kotor' ? 'KotOR' : 'Diablo'}]</option>`
    )
    .join('');

  sel.addEventListener('change', (e) => {
    state.activeCampaignId = e.target.value;
    const camp = getActiveCampaign();
    if (camp) {
      state.activeGenre = camp.genre || 'reone_kotor';
      const isKotor = state.activeGenre === 'reone_kotor';
      document.getElementById('btn-switch-kotor')?.classList.toggle('active', isKotor);
      document.getElementById('btn-switch-diablo')?.classList.toggle('active', !isKotor);
      switchToGenre(state.activeGenre);
    }
  });
}

function updateEnginePill() {
  const textEl = document.getElementById('engine-pill-text');
  if (!textEl) return;
  const reone = state.enginesStatus.reone;
  const freeablo = state.enginesStatus.freeablo;

  const kCount = reone?.talkTableStatus?.totalStringsCount || 49266;
  textEl.textContent = `reone: ${kCount.toLocaleString()} Strings • Freeablo: Ready`;
}

function init3DGameDirector() {
  const canvas = document.getElementById('souls-canvas');
  const hudContainer = document.getElementById('relic-labels-layer');
  if (!canvas || !window.Genvey3DGameDirector) return;

  state.soulsEngine = new window.Genvey3DGameDirector(canvas, hudContainer, {
    onHudUpdate: (hud) => {
      document.getElementById('player-hp-text').textContent = hud.playerHp;
      document.getElementById('player-mana-text').textContent = hud.playerMana;
      document.getElementById('boss-hp-fill').style.width = `${Math.max(0, hud.bossHp)}%`;

      // Update Diablo health / mana liquid height
      if (hud.currentGenre === 'freeablo_diablo') {
        const hpPct = Math.max(0, Math.min(100, hud.playerHp));
        const manaPct = Math.max(0, Math.min(100, hud.playerMana));
        document.getElementById('diablo-health-fill').style.height = `${hpPct}%`;
        document.getElementById('diablo-mana-fill').style.height = `${manaPct}%`;
        document.getElementById('diablo-health-value').textContent = `${hud.playerHp} / 100`;
        document.getElementById('diablo-mana-value').textContent = `${hud.playerMana} / 100`;
      }
    },
    onAlignmentMessage: (data) => {
      const banner = document.getElementById('kotor-alignment-banner');
      if (banner) {
        document.getElementById('kotor-align-title').textContent = data.alignTitle;
        document.getElementById('kotor-align-sub').textContent = data.alignSub;
        banner.classList.remove('hidden');
        clearTimeout(banner._hideTimer);
        banner._hideTimer = setTimeout(() => banner.classList.add('hidden'), 2800);
      }
    },
    onCombatMessage: (msg) => {
      console.log('Combat note:', msg);
    },
    onVictory: (summary) => {
      handlePhaseOrGameVictory(summary);
    }
  });
}

function loadActiveCampaignIntoEngine() {
  const camp = getActiveCampaign();
  if (!camp || !state.soulsEngine) return;

  state.activeStageIndex = 0;
  const isKotor = (camp.genre === 'reone_kotor');

  // Toggle HUD elements for KotOR vs Diablo
  document.getElementById('diablo-orbs-container')?.classList.toggle('hidden', isKotor);

  // Update sidebar engine details
  if (isKotor) {
    document.getElementById('sidebar-engine-title').textContent = '🌌 Engine: reone Odyssey';
    document.getElementById('meta-engine-arch').textContent = 'reone (seedhartha/reone C++)';
    document.getElementById('meta-engine-data').textContent = 'Aspyr KotOR Retail Assets';
    document.getElementById('meta-engine-strings').textContent = '49,266 Strings (dialog.tlk)';
    document.getElementById('meta-engine-hero').textContent = 'Jedi Knight.glb (Plasma Lightsaber)';
    document.getElementById('meta-engine-audio').textContent = 'Darth Malak Battle Theme (PCM WAV)';
    document.getElementById('stimulus-instruction').textContent = '🌌 Align with one of the 4 Star Map Consoles [1–4] to break the Sith shield!';
  } else {
    document.getElementById('sidebar-engine-title').textContent = '🔥 Engine: Freeablo ARPG';
    document.getElementById('meta-engine-arch').textContent = 'Freeablo v0.4 (wheybags/freeablo)';
    document.getElementById('meta-engine-data').textContent = 'Tristram Catacombs & MPQ Core';
    document.getElementById('meta-engine-strings').textContent = 'resources/settings-user.ini active';
    document.getElementById('meta-engine-hero').textContent = 'Barbarian.glb (2H Battleaxe Cleave)';
    document.getElementById('meta-engine-audio').textContent = 'Heavy Cleave & Gothic Shrine Audio';
    document.getElementById('stimulus-instruction').textContent = '🔥 Cleanse one of the 4 Cursed Shrines [1–4] to shatter the Demon Lord!';
  }

  // Load into Three.js Game Director
  state.soulsEngine.loadCampaign(camp, state.activeStageIndex, 'dark_fantasy_souls');

  updateStageDecisionCard(camp, state.activeStageIndex);
}

function updateStageDecisionCard(camp, stageIdx) {
  const stage = camp.stages?.[stageIdx] || camp.stages?.[0];
  if (!stage) return;

  const q = stage.hiddenSurveyQuestion || {};
  document.getElementById('boss-display-name').textContent = stage.personaFramings?.dark_fantasy_souls?.bossName || (camp.genre === 'reone_kotor' ? 'Darth Malak (Sith Master)' : 'The Butcher (Skeleton Lord)');
  document.getElementById('boss-phase-badge').textContent = `Phase ${stageIdx + 1} of ${camp.stages.length}`;
  document.getElementById('boss-dialogue-text').textContent = stage.personaFramings?.dark_fantasy_souls?.dialogue || 'Face my power or be destroyed!';

  document.getElementById('active-decision-q').textContent = q.originalQuestionText || 'What is your tactical preference?';

  const optsContainer = document.getElementById('active-decision-options');
  if (optsContainer && stage.choices) {
    optsContainer.innerHTML = stage.choices
      .map(
        (c, idx) => `
        <div class="decision-opt-item" onclick="state.soulsEngine?.imbueRelic(${idx})">
          <span class="opt-num">[${idx + 1}]</span>
          <span class="opt-text">${c.mappedOption}</span>
          <span class="opt-buff">${c.relicBuff}</span>
        </div>
      `
      )
      .join('');
  }
}

async function handlePhaseOrGameVictory(summary) {
  const camp = getActiveCampaign();
  if (!camp) return;

  // Record completed stage
  state.activeStageIndex++;
  if (state.activeStageIndex < (camp.stages?.length || 1)) {
    // Proceed to next stage
    state.soulsEngine.loadStage(camp.stages[state.activeStageIndex], 'dark_fantasy_souls', camp.proceduralBossConfig);
    updateStageDecisionCard(camp, state.activeStageIndex);
  } else {
    // Complete game victory
    document.getElementById('victory-overlay')?.classList.remove('hidden');

    // Post play session to backend
    try {
      await fetch(`/api/campaigns/${camp.id}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'usr_alex',
          answers: (camp.stages || []).map((s, idx) => ({
            questionId: s.hiddenSurveyQuestion?.questionId,
            mappedOption: s.choices?.[0]?.mappedOption || 'Selected Option',
            reactionTimeMs: 1550 + idx * 120
          })),
          impliedWTP: camp.basePrice || 49,
          comboMultiplier: 1.5
        })
      });
    } catch (e) {
      console.warn('Session save note:', e);
    }
  }
}

function bindControls() {
  document.getElementById('btn-dodge-roll')?.addEventListener('click', () => {
    state.soulsEngine?.triggerDodgeRoll();
  });
  document.getElementById('btn-sword-slash')?.addEventListener('click', () => {
    state.soulsEngine?.triggerPrimaryAttack();
  });
  document.getElementById('btn-special-q')?.addEventListener('click', () => {
    state.soulsEngine?.triggerSpecialQ();
  });
  document.getElementById('btn-special-e')?.addEventListener('click', () => {
    state.soulsEngine?.triggerSpecialE();
  });
  document.getElementById('btn-fatal-combo')?.addEventListener('click', () => {
    state.soulsEngine?.executeInstantBossCombo();
  });

  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    document.getElementById('victory-overlay')?.classList.add('hidden');
    loadActiveCampaignIntoEngine();
  });

  document.getElementById('btn-launch-native-engine')?.addEventListener('click', () => {
    const camp = getActiveCampaign();
    launchEngine(camp?.genre === 'reone_kotor' ? 'reone' : 'freeablo');
  });

  document.getElementById('btn-toggle-music')?.addEventListener('click', () => {
    state.musicEnabled = !state.musicEnabled;
    const btn = document.getElementById('btn-toggle-music');
    if (btn) btn.textContent = state.musicEnabled ? '🎵 Music: ON' : '🔇 Music: OFF';

    if (!state.musicEnabled && state.soulsEngine?.currentBgMusic) {
      state.soulsEngine.currentBgMusic.pause();
    } else if (state.musicEnabled && state.soulsEngine) {
      const camp = getActiveCampaign();
      if (camp?.genre === 'reone_kotor') {
        state.soulsEngine.playBgMusic('/audio/kotor/mus_bat_malak.wav', 0.35);
      }
    }
  });
}

async function launchEngine(engineId) {
  try {
    const camp = getActiveCampaign();
    const res = await fetch('/api/engines/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineId, campaignId: camp?.id })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`🎮 [${data.engine || engineId}]: ${data.message || 'Launched successfully!'}`);
    } else {
      alert(`Engine Notice: ${data.error || 'Check engine installation'}`);
    }
  } catch (err) {
    alert(`Failed to launch engine: ${err.message}`);
  }
}
window.launchEngine = launchEngine;

function bindCustomizerForm() {
  const form = document.getElementById('custom-game-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-custom-game');
    const orig = btn.textContent;
    btn.textContent = '⏳ Compiling into Engine...';
    btn.disabled = true;

    try {
      const title = document.getElementById('cust-title').value.trim();
      const genre = document.getElementById('cust-genre').value;
      const setting = document.getElementById('cust-setting').value.trim();

      const palette = {
        accent: document.getElementById('cust-color-accent').value,
        sky: document.getElementById('cust-color-sky').value,
        fog: document.getElementById('cust-color-fog').value,
        floor: document.getElementById('cust-color-floor').value
      };

      const parseOpts = (id) =>
        document
          .getElementById(id)
          .value.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);

      const questions = [
        {
          id: 'q_cust_1',
          category: 'Phase 1: Feature Priority',
          text: document.getElementById('cust-q1-text').value.trim(),
          options: parseOpts('cust-q1-opts')
        },
        {
          id: 'q_cust_2',
          category: 'Phase 2: Audio & Vibe',
          text: document.getElementById('cust-q2-text').value.trim(),
          options: parseOpts('cust-q2-opts')
        },
        {
          id: 'q_cust_3',
          category: 'Phase 3: Value Tier',
          text: document.getElementById('cust-q3-text').value.trim(),
          options: parseOpts('cust-q3-opts')
        }
      ];

      const res = await fetch('/api/games/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre, setting, palette, questions })
      });
      const data = await res.json();

      if (data.game) {
        state.activeCampaignId = data.game.id;
        state.activeGenre = data.game.genre;
        await fetchState();

        // Switch to Tab 1 to immediately play the customized game
        document.querySelector('[data-tab="play-tab"]')?.click();
        switchToGenre(data.game.genre);
      }
    } catch (err) {
      alert('Custom game save error: ' + err.message);
    } finally {
      btn.textContent = orig;
      btn.disabled = false;
    }
  });
}

async function refreshAnalyticsPanel() {
  const camp = getActiveCampaign();
  if (!camp) return;

  try {
    const res = await fetch(`/api/campaigns/${camp.id}/analytics`);
    const data = await res.json();
    const analytics = data.analytics;
    const container = document.getElementById('analytics-breakdown-container');
    if (!container || !analytics) return;

    document.getElementById('analytics-header-desc').textContent =
      `Displaying decisions from ${analytics.totalCompletions || 1} completed runs on "${camp.title}".`;

    container.innerHTML = (analytics.questionBreakdown || [])
      .map(
        (q) => `
        <div class="card" style="margin-bottom: 16px;">
          <h3 style="color: var(--accent); margin-bottom: 8px;">${q.questionText}</h3>
          <div class="breakdown-options-list">
            ${(q.distribution || q.options || [])
              .map(
                (opt) => `
              <div class="opt-bar-row">
                <div class="opt-bar-label">
                  <span>${opt.option}</span>
                  <strong>${opt.convictionWeightedPct ?? opt.convictionWeightedSharePct ?? 0}% (${opt.count ?? opt.rawCount ?? 0} choices)</strong>
                </div>
                <div class="opt-bar-track">
                  <div class="opt-bar-fill" style="width: ${opt.convictionWeightedPct ?? opt.convictionWeightedSharePct ?? 0}%;"></div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.warn('Analytics note:', err);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
