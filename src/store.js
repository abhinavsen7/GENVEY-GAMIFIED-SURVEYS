/**
 * GENVEY Persistent Data Store (Track 4: 3D Souls-Like Adaptive Survey Worlds)
 */

const fs = require('fs');
const path = require('path');
const { GENRE_THEMES } = require('./ai_engine');

const DATA_FILE = path.join(__dirname, '..', 'data_store.json');
const STORE_VERSION = 3; // Bumped for 3D Souls-Like Engine

function createInitialSeed() {
  const companies = [
    {
      id: 'comp_aether',
      name: 'AetherAudio Labs',
      industry: 'Gaming Hardware & Spatial Audio',
      companySize: '50-250 Employees',
      contactRole: 'VP of Product & Consumer Insights',
      targetAudience: 'Core Gamers, Streamers & Audiophiles (18-38)',
      website: 'https://aetheraudio.example.com',
      brandVibe: 'Dark-Tech, High-Precision, Cyber-Acoustic',
      createdAt: '2026-10-16T10:00:00Z'
    },
    {
      id: 'comp_hyperion',
      name: 'Hyperion Energy & Beverages',
      industry: 'D2C Craft Energy & Esports Nutrition',
      companySize: '15-50 Employees',
      contactRole: 'Head of Brand Experience',
      targetAudience: 'Action Gamers, Night Owls & Creators',
      website: 'https://hyperionbrew.example.com',
      brandVibe: 'Bold, Mythic, High-Voltage',
      createdAt: '2026-10-16T12:00:00Z'
    }
  ];

  const players = [
    {
      id: 'usr_alex',
      name: 'Alex "AshenBlade" Chen',
      email: 'alex.blade@gamer.io',
      ageGroup: '18-24',
      personaType: 'dark_fantasy_souls',
      personaTitle: 'Audience A: Elden / Dark Souls Fantasy Gamer',
      points: 1350,
      lifetimePoints: 2350,
      xp: 1850,
      level: 8,
      gamesWon: 5,
      badges: ['⚔️ Boss Slayer', '🔥 Dodge Roll Master'],
      redemptions: [
        {
          id: 'red_101',
          rewardTitle: '$5.00 Steam Wallet Code',
          provider: 'Steam Store',
          type: 'store_credit',
          pointsSpent: 800,
          cashValueUsd: 5.00,
          voucherCode: 'GVY-STM-8841-SOUL',
          redeemedAt: '2026-10-16T09:30:00Z'
        }
      ]
    },
    {
      id: 'usr_maya',
      name: 'Maya "Valkyrie-09" Lin',
      email: 'maya.valkyrie@cyber.co',
      ageGroup: '25-34',
      personaType: 'cyber_mecha_action',
      personaTitle: 'Audience B: Armored Core / Cyber-Mecha Fan',
      points: 1650,
      lifetimePoints: 1650,
      xp: 1400,
      level: 6,
      gamesWon: 4,
      badges: ['⚡ Mecha Breaker', '🎯 Perfect Parry'],
      redemptions: []
    }
  ];

  const campaigns = [
    {
      id: 'camp_aether_souls',
      companyId: 'comp_aether',
      companyName: 'AetherAudio Labs',
      industry: 'Gaming Hardware & Spatial Audio',
      title: 'SOULS OF AETHER: The Obsidian Warden (3D Boss Raid)',
      surveyObjective: 'Discover which headset feature, sonic signature, trailer visual cut, and price tier gamers fight hardest for.',
      genre: 'elden_souls',
      genreName: GENRE_THEMES.elden_souls.name,
      setting: GENRE_THEMES.elden_souls.setting,
      mediaType: 'full_multimodal',
      durationMinutes: 5,
      rewardPoints: 500,
      basePrice: 149,
      createdAt: '2026-10-16T11:00:00Z',
      proceduralBossConfig: {
        seed: 4821,
        bossScale: 1.32,
        wingCount: 4,
        haloRings: 2,
        shockwaveSpeed: 13,
        generatedBossLore: 'Malakor, Sovereign of the Silent Abyss: "Imbue thy Greatsword at the Relic Forges if thou darest shatter my Aegis!"'
      },
      questions: [
        {
          id: 'q_ae_1',
          text: 'Which flagship hardware capability matters most in your gaming headset?',
          category: 'Phase 1: Core Feature Priority',
          options: [
            'Sub-5ms Lossless Wireless Latency',
            '60-Hour Graphene Battery Life',
            'AI Adaptive Neural Noise Cancellation',
            '360° Spatial Footstep Radar Audio'
          ]
        },
        {
          id: 'q_ae_2',
          text: 'Which sonic signature best fits our brand boot-up & trailer audio?',
          category: 'Phase 2: Multimodal Audio Synth Test',
          options: [
            'Warm Acoustic Harmonic (432Hz Choir)',
            'Cybernetic Bass Synth (528Hz Overdrive)',
            'Crystalline Minimalist Chime',
            'Cinematic Sub-Bass Impact Drop'
          ]
        },
        {
          id: 'q_ae_3',
          text: 'What price tier feels right for the Aether-X9 Flagship Edition?',
          category: 'Phase 3: Price & Value Calibration',
          options: [
            '$119 Core Edition',
            '$149 Pro Sweet-Spot Edition',
            '$179 Streamer Dock Bundle',
            '$219 Forged Carbon Collector Edition'
          ]
        }
      ],
      stages: [
        {
          stageNumber: 1,
          totalStages: 3,
          stageId: 'stage_1',
          title: 'Boss Phase 1 of 3: Core Feature Priority',
          bossAttackPattern: 'shockwave_rings',
          narrativePrompt: '"Tarnished Challenger! My Phase 1 Aegis cannot be pierced by cold steel alone. Sprint to one of the 4 Relic Altars to imbue your Greatsword with your chosen capability, then strike me down!"',
          personaFramings: {
            dark_fantasy_souls: {
              personaLabel: 'Audience A: Elden / Dark Souls Fantasy World',
              worldTitle: 'Sunken Cathedral of Ash & Gold',
              bossName: 'Malakor, Warden of the Aether Flame',
              dialogue: '"Tarnished Challenger! Claim one of the 4 Relic Flames around my cathedral to imbue thy Greatsword, dodge my Crimson Shockwaves, and test thy blade against my shield!"',
              arenaPalette: { sky: '#0b0808', fog: '#1c110f', floor: '#181210', pillar: '#29201c', accent: '#f59e0b', bossColor: '#b91c1c', bossEmissive: '#f97316' },
              bossStyle: 'gothic_colossus'
            },
            cyber_mecha_action: {
              personaLabel: 'Audience B: Armored Core / Cyber-Mecha World',
              worldTitle: 'Neo-Veridia Orbital Reactor Core',
              bossName: 'VALKYRIE-X9: Neural Defense Mech',
              dialogue: '"ALERT: Phase 1 Aegis Shield active. Boost to one of the 4 Overclock Terminals to charge your Plasma Katana, evade the laser rings, and strike the core!"',
              arenaPalette: { sky: '#050814', fog: '#09122c', floor: '#0b132b', pillar: '#162447', accent: '#00f5d4', bossColor: '#1e293b', bossEmissive: '#f72585' },
              bossStyle: 'mecha_seraph'
            }
          },
          stimulus: {
            type: 'tactical_dilemma',
            title: 'Phase 1: 3D Relic Forge Imbuement',
            instruction: 'Move with WASD, SPACE to Dodge Roll through Boss shockwaves, and press E (or click a Relic below) to imbue your sword and slash the Boss!'
          },
          hiddenSurveyQuestion: {
            questionId: 'q_ae_1',
            originalQuestionText: 'Which flagship hardware capability matters most in your gaming headset?',
            category: 'Phase 1: Core Feature Priority',
            stealthMechanism: '3D Relic Altar physical navigation + Sword Imbuement + Boss combat completion'
          },
          choices: [
            { id: 'c_1_0', relicName: 'Crimson Flame Blade', relicIcon: '🔥', relicColor: '#ef4444', relicBuff: '+40% Fire Speed Slash', gameActionLabel: '🔥 Imbue Crimson Flame: "Sub-5ms Lossless Wireless Latency"', flavorSubtext: '+40% Attack Speed • Breaks Boss Shield', mappedOption: 'Sub-5ms Lossless Wireless Latency', rewardXp: 80, impliedWTPMultiplier: 1.05 },
            { id: 'c_1_1', relicName: 'Volt-Lightning Edge', relicIcon: '⚡', relicColor: '#00f5d4', relicBuff: '+45% Stamina & Shock', gameActionLabel: '⚡ Imbue Volt-Lightning: "60-Hour Graphene Battery Life"', flavorSubtext: '+45% Stamina Recovery • Breaks Boss Shield', mappedOption: '60-Hour Graphene Battery Life', rewardXp: 80, impliedWTPMultiplier: 0.95 },
            { id: 'c_1_2', relicName: 'Solar Gold Greatsword', relicIcon: '☀️', relicColor: '#f59e0b', relicBuff: '+50% Holy Poise Break', gameActionLabel: '☀️ Imbue Solar Gold: "AI Adaptive Neural Noise Cancellation"', flavorSubtext: '+50% Boss Poise Stagger • Breaks Boss Shield', mappedOption: 'AI Adaptive Neural Noise Cancellation', rewardXp: 85, impliedWTPMultiplier: 1.15 },
            { id: 'c_1_3', relicName: 'Abyssal Void Katana', relicIcon: '🌌', relicColor: '#a855f7', relicBuff: '+45% Spatial Gravity Wave', gameActionLabel: '🌌 Imbue Abyssal Void: "360° Spatial Footstep Radar Audio"', flavorSubtext: '+45% Critical Range • Breaks Boss Shield', mappedOption: '360° Spatial Footstep Radar Audio', rewardXp: 85, impliedWTPMultiplier: 1.10 }
          ]
        },
        {
          stageNumber: 2,
          totalStages: 3,
          stageId: 'stage_2',
          title: 'Boss Phase 2 of 3: Multimodal Audio Synth Trial',
          bossAttackPattern: 'laser_sweep_and_meteors',
          narrativePrompt: '"Phase 2 Awakens! My Sonic Resonance Barrier blocks unattuned blades. Audition the Spatial Sonic Relics and imbue the frequency that rings truest!"',
          personaFramings: {
            dark_fantasy_souls: {
              personaLabel: 'Audience A: Elden / Dark Souls Fantasy World',
              worldTitle: 'Sunken Cathedral of Ash & Gold',
              bossName: 'Malakor, Warden of the Aether Flame (Enraged)',
              dialogue: '"Hear the Cathedral Choirs! Attune thy blade to one of the 4 Sonic Relics and strike through my meteor storm!"',
              arenaPalette: { sky: '#0b0808', fog: '#1c110f', floor: '#181210', pillar: '#29201c', accent: '#f59e0b', bossColor: '#b91c1c', bossEmissive: '#f97316' },
              bossStyle: 'gothic_colossus'
            },
            cyber_mecha_action: {
              personaLabel: 'Audience B: Armored Core / Cyber-Mecha World',
              worldTitle: 'Neo-Veridia Orbital Reactor Core',
              bossName: 'VALKYRIE-X9: Overdrive Mode',
              dialogue: '"WARNING: Acoustic Barrier deployed. Sample the frequency synth nodes and lock your weapon harmonic to pierce the barrier!"',
              arenaPalette: { sky: '#050814', fog: '#09122c', floor: '#0b132b', pillar: '#162447', accent: '#00f5d4', bossColor: '#1e293b', bossEmissive: '#f72585' },
              bossStyle: 'mecha_seraph'
            }
          },
          stimulus: {
            type: 'audio_synth',
            title: 'Phase 2: Live WebAudio Sonic Relic Audition',
            instruction: 'Click to preview the real-time WebAudio synth signatures or run to a Sonic Altar in 3D to imbue your weapon!',
            tracks: [
              { id: 'track_alpha', label: 'Sonic Relic A: Warm 432Hz Harmonic Choir', notes: [261.63, 329.63, 392.00, 523.25], waveform: 'sine', tempoBpm: 96 },
              { id: 'track_beta', label: 'Sonic Relic B: 528Hz Cyber Overdrive Synth', notes: [293.66, 349.23, 440.00, 587.33], waveform: 'sawtooth', tempoBpm: 132 }
            ]
          },
          hiddenSurveyQuestion: {
            questionId: 'q_ae_2',
            originalQuestionText: 'Which sonic signature best fits our brand boot-up & trailer audio?',
            category: 'Phase 2: Multimodal Audio Synth Test',
            stealthMechanism: 'Real-time WebAudio synthesis audition + 3D Relic Altar weapon imbuement'
          },
          choices: [
            { id: 'c_2_0', relicName: 'Crimson Flame Blade', relicIcon: '🔥', relicColor: '#ef4444', relicBuff: '432Hz Harmonic Resonance', gameActionLabel: '🔥 Imbue Harmonic Flame: "Warm Acoustic Harmonic (432Hz Choir)"', flavorSubtext: 'Pure resonant wave • Shatters Phase 2 Shield', mappedOption: 'Warm Acoustic Harmonic (432Hz Choir)', rewardXp: 90, impliedWTPMultiplier: 1.0 },
            { id: 'c_2_1', relicName: 'Volt-Lightning Edge', relicIcon: '⚡', relicColor: '#00f5d4', relicBuff: '528Hz Cyber Synth', gameActionLabel: '⚡ Imbue Synth Lightning: "Cybernetic Bass Synth (528Hz Overdrive)"', flavorSubtext: 'High-voltage pulse • Shatters Phase 2 Shield', mappedOption: 'Cybernetic Bass Synth (528Hz Overdrive)', rewardXp: 95, impliedWTPMultiplier: 1.1 },
            { id: 'c_2_2', relicName: 'Solar Gold Greatsword', relicIcon: '☀️', relicColor: '#f59e0b', relicBuff: 'Crystalline Bell', gameActionLabel: '☀️ Imbue Solar Chime: "Crystalline Minimalist Chime"', flavorSubtext: 'Zero-distortion edge • Shatters Phase 2 Shield', mappedOption: 'Crystalline Minimalist Chime', rewardXp: 85, impliedWTPMultiplier: 0.95 },
            { id: 'c_2_3', relicName: 'Abyssal Void Katana', relicIcon: '🌌', relicColor: '#a855f7', relicBuff: 'Sub-Bass Impact', gameActionLabel: '🌌 Imbue Void Sub-Drop: "Cinematic Sub-Bass Impact Drop"', flavorSubtext: 'Seismic shockwave • Shatters Phase 2 Shield', mappedOption: 'Cinematic Sub-Bass Impact Drop', rewardXp: 95, impliedWTPMultiplier: 1.15 }
          ]
        },
        {
          stageNumber: 3,
          totalStages: 3,
          stageId: 'stage_3',
          title: 'Final Boss Phase 3 of 3: Tribute & Value Forge',
          bossAttackPattern: 'berserk_combo_slam',
          narrativePrompt: '"FINAL PHASE! My Sovereign Core is exposed! Forge thy final Tribute Tier at the Relic Altars and deliver the finishing blow!"',
          personaFramings: {
            dark_fantasy_souls: {
              personaLabel: 'Audience A: Elden / Dark Souls Fantasy World',
              worldTitle: 'Sunken Cathedral of Ash & Gold',
              bossName: 'Malakor, Ascended Lord of Cinder',
              dialogue: '"Final Phase! Choose thy Sovereign Tribute Relic and strike my heart to claim victory and thy Gold Coins!"',
              arenaPalette: { sky: '#0b0808', fog: '#1c110f', floor: '#181210', pillar: '#29201c', accent: '#f59e0b', bossColor: '#b91c1c', bossEmissive: '#f97316' },
              bossStyle: 'gothic_colossus'
            },
            cyber_mecha_action: {
              personaLabel: 'Audience B: Armored Core / Cyber-Mecha World',
              worldTitle: 'Neo-Veridia Orbital Reactor Core',
              bossName: 'VALKYRIE-X9: Core Meltdown Phase',
              dialogue: '"FINAL PHASE: Select your Contract Requisition Terminal, imbue maximum output, and destroy the Boss Core!"',
              arenaPalette: { sky: '#050814', fog: '#09122c', floor: '#0b132b', pillar: '#162447', accent: '#00f5d4', bossColor: '#1e293b', bossEmissive: '#f72585' },
              bossStyle: 'mecha_seraph'
            }
          },
          stimulus: {
            type: 'resource_allocator',
            title: 'Phase 3: Final Tribute Calibration',
            instruction: 'Imbue your final Relic Tier and land the fatal sword combo on the Boss!',
            minCredits: 99,
            maxCredits: 229,
            defaultCredits: 149
          },
          hiddenSurveyQuestion: {
            questionId: 'q_ae_3',
            originalQuestionText: 'What price tier feels right for the Aether-X9 Flagship Edition?',
            category: 'Phase 3: Price & Value Calibration',
            stealthMechanism: 'Final Boss Tribute Relic selection + willingness-to-pay calibration'
          },
          choices: [
            { id: 'c_3_0', relicName: 'Crimson Flame Blade', relicIcon: '🔥', relicColor: '#ef4444', relicBuff: 'Starter Pact', gameActionLabel: '🔥 Imbue Crimson Pact: "$119 Core Edition"', flavorSubtext: 'Lean & lethal • Final Boss Finisher', mappedOption: '$119 Core Edition', rewardXp: 100, impliedWTPMultiplier: 0.80 },
            { id: 'c_3_1', relicName: 'Volt-Lightning Edge', relicIcon: '⚡', relicColor: '#00f5d4', relicBuff: 'Pro Vanguard Pact', gameActionLabel: '⚡ Imbue Lightning Pact: "$149 Pro Sweet-Spot Edition"', flavorSubtext: 'Balanced flagship power • Final Boss Finisher', mappedOption: '$149 Pro Sweet-Spot Edition', rewardXp: 110, impliedWTPMultiplier: 1.00 },
            { id: 'c_3_2', relicName: 'Solar Gold Greatsword', relicIcon: '☀️', relicColor: '#f59e0b', relicBuff: 'Creator Guild Pact', gameActionLabel: '☀️ Imbue Solar Pact: "$179 Streamer Dock Bundle"', flavorSubtext: 'Full transmitter suite • Final Boss Finisher', mappedOption: '$179 Streamer Dock Bundle', rewardXp: 115, impliedWTPMultiplier: 1.20 },
            { id: 'c_3_3', relicName: 'Abyssal Void Katana', relicIcon: '🌌', relicColor: '#a855f7', relicBuff: 'Collector Sovereign Pact', gameActionLabel: '🌌 Imbue Void Pact: "$219 Forged Carbon Collector Edition"', flavorSubtext: 'Prestige collector tier • Final Boss Finisher', mappedOption: '$219 Forged Carbon Collector Edition', rewardXp: 120, impliedWTPMultiplier: 1.45 }
          ]
        }
      ],
      aiTelemetry: {
        amdPlatform: 'AMD Token Factory (notebooks.amd.com/tokenfactory)',
        amdAccelerator: 'AMD Instinct™ MI300X (ROCm™ 6.3)',
        amdModel: 'meta-llama/Llama-3.3-70B-Instruct-ROCm',
        gemmaModel: 'gemma4:latest (Local Ollama)',
        gemmaLiveConnected: true,
        amdLiveConnected: false,
        liveGeneratedOutput: 'Malakor, Sovereign of the Silent Abyss: "Imbue thy Greatsword at the Relic Forges if thou darest shatter my Aegis!"',
        activeInferenceSource: 'Google Gemma 4 (Local Ollama) + AMD Token Factory Ready',
        compilationLatencyMs: 640,
        promptTokens: 495,
        completionTokens: 810,
        totalTokens: 1305,
        estimatedCostUsd: 0.00085,
        qualityGuardrails: {
          schemaValid: true,
          optionBijectionVerified: true,
          zeroLeadingBiasCheck: 'PASSED (Symmetric 3D Relic Placement)',
          multimodalSyncVerified: true
        }
      }
    }
  ];

  const sessions = [
    {
      id: 'sess_1',
      campaignId: 'camp_aether_souls',
      playerId: 'usr_alex',
      playerName: 'Alex "AshenBlade" Chen',
      personaType: 'dark_fantasy_souls',
      completedAt: '2026-10-16T09:10:00Z',
      impliedWTP: 149,
      score: 960,
      answers: [
        { questionId: 'q_ae_1', questionIndex: 0, mappedOption: 'AI Adaptive Neural Noise Cancellation', reactionTimeMs: 1420 },
        { questionId: 'q_ae_2', questionIndex: 1, mappedOption: 'Cybernetic Bass Synth (528Hz Overdrive)', reactionTimeMs: 1680 },
        { questionId: 'q_ae_3', questionIndex: 2, mappedOption: '$149 Pro Sweet-Spot Edition', reactionTimeMs: 1890 }
      ]
    },
    {
      id: 'sess_2',
      campaignId: 'camp_aether_souls',
      playerId: 'usr_maya',
      playerName: 'Maya "Valkyrie-09" Lin',
      personaType: 'cyber_mecha_action',
      completedAt: '2026-10-16T10:15:00Z',
      impliedWTP: 179,
      score: 940,
      answers: [
        { questionId: 'q_ae_1', questionIndex: 0, mappedOption: 'Sub-5ms Lossless Wireless Latency', reactionTimeMs: 1350 },
        { questionId: 'q_ae_2', questionIndex: 1, mappedOption: 'Warm Acoustic Harmonic (432Hz Choir)', reactionTimeMs: 1920 },
        { questionId: 'q_ae_3', questionIndex: 2, mappedOption: '$179 Streamer Dock Bundle', reactionTimeMs: 1740 }
      ]
    },
    {
      id: 'sess_3',
      campaignId: 'camp_aether_souls',
      playerId: 'usr_alex',
      playerName: 'Kai "TwinBlade" Vance',
      personaType: 'dark_fantasy_souls',
      completedAt: '2026-10-16T11:00:00Z',
      impliedWTP: 149,
      score: 910,
      answers: [
        { questionId: 'q_ae_1', questionIndex: 0, mappedOption: 'AI Adaptive Neural Noise Cancellation', reactionTimeMs: 1290 },
        { questionId: 'q_ae_2', questionIndex: 1, mappedOption: 'Cybernetic Bass Synth (528Hz Overdrive)', reactionTimeMs: 1340 },
        { questionId: 'q_ae_3', questionIndex: 2, mappedOption: '$149 Pro Sweet-Spot Edition', reactionTimeMs: 1620 }
      ]
    }
  ];

  const rewardsCatalog = [
    {
      id: 'rew_cash_5',
      title: '$5.00 Instant PayPal / UPI Cash Out',
      provider: 'Direct Cash Payout',
      category: 'Actual Cash',
      type: 'actual_cash',
      pointsCost: 800,
      cashValueUsd: 5.00,
      icon: '💵',
      badge: 'ACTUAL CASH'
    },
    {
      id: 'rew_steam_5',
      title: '$5.00 Steam Digital Gift Card',
      provider: 'Steam Store',
      category: 'Gaming Store Credit',
      type: 'store_credit',
      pointsCost: 800,
      cashValueUsd: 5.00,
      icon: '🎮',
      badge: 'INSTANT CODE'
    },
    {
      id: 'rew_amazon_10',
      title: '$10.00 Amazon Store Credit',
      provider: 'Amazon',
      category: 'Retail Store Credit',
      type: 'store_credit',
      pointsCost: 1400,
      cashValueUsd: 10.00,
      icon: '📦',
      badge: 'STORE CREDIT'
    },
    {
      id: 'rew_cash_15',
      title: '$15.00 Visa Direct / Bank Cash Transfer',
      provider: 'Visa Direct',
      category: 'Actual Cash',
      type: 'actual_cash',
      pointsCost: 2000,
      cashValueUsd: 15.00,
      icon: '💳',
      badge: 'ACTUAL CASH'
    }
  ];

  return {
    version: STORE_VERSION,
    companies,
    players,
    campaigns,
    sessions,
    rewardsCatalog
  };
}

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === STORE_VERSION) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Re-initializing store:', e.message);
  }
  const initial = createInitialSeed();
  saveStore(initial);
  return initial;
}

function saveStore(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save store:', e.message);
  }
}

module.exports = {
  loadStore,
  saveStore,
  createInitialSeed
};
