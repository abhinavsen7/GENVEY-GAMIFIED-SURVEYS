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

  // No hardcoded trial sample games: only user/company generated games are stored & played
  const campaigns = [];

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
