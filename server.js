/**
 * GENVEY Server: Track 4 — 3D Souls-Like Adaptive Survey Worlds
 * Powered by AMD Token Factory (Instinct MI300X / ROCm) & Local Google Gemma 4 (Ollama)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const { loadStore, saveStore } = require('./src/store');
const {
  runtimeConfig,
  saveAmdKeyToEnv,
  GENRE_THEMES,
  callLocalGemma,
  callAMDTokenFactory,
  compileSurveyToGame
} = require('./src/ai_engine');
const {
  computeConvictionWeight,
  aggregateCampaignAnalytics
} = require('./src/econometrics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let store = loadStore();

/**
 * GET /api/state
 * Returns complete platform state + honest AI hardware connection status
 */
app.get('/api/state', async (req, res) => {
  res.json({
    companies: store.companies,
    players: store.players,
    campaigns: store.campaigns,
    rewardsCatalog: store.rewardsCatalog,
    genres: GENRE_THEMES,
    aiConfig: {
      amdEndpoint: runtimeConfig.amdEndpoint,
      amdModel: runtimeConfig.amdModel,
      hasAmdKey: Boolean(runtimeConfig.amdApiKey),
      gemmaEndpoint: runtimeConfig.gemmaEndpoint,
      gemmaModel: runtimeConfig.gemmaModel,
      hardwareTarget: runtimeConfig.hardwareTarget
    }
  });
});

/**
 * POST /api/ai/status
 * Performs a live health check on Local Gemma 4 (Ollama) and AMD Token Factory
 */
app.post('/api/ai/status', async (req, res) => {
  if (req.body.amdApiKey && req.body.amdApiKey.trim()) {
    runtimeConfig.amdApiKey = req.body.amdApiKey.trim();
  }
  if (req.body.amdEndpoint && req.body.amdEndpoint.trim()) {
    runtimeConfig.amdEndpoint = req.body.amdEndpoint.trim();
  }
  if (req.body.amdModel && req.body.amdModel.trim()) {
    runtimeConfig.amdModel = req.body.amdModel.trim();
  }
  if (req.body.amdApiKey || req.body.amdEndpoint || req.body.amdModel) {
    saveAmdKeyToEnv(runtimeConfig.amdApiKey, runtimeConfig.amdEndpoint, runtimeConfig.amdModel);
  }

  // Only run full CPU Gemma generation if requested, otherwise check Ollama /api/tags fast!
  let gemmaOnline = false;
  let gemmaSample = 'gemma4:latest installed locally on Ollama (localhost:11434)';
  let gemmaLatencyMs = 0;

  if (req.body.runLiveTest) {
    const gemmaCheck = await callLocalGemma('Say: GEMMA 4 READY', 28000);
    gemmaOnline = gemmaCheck.ok;
    gemmaLatencyMs = gemmaCheck.latencyMs;
    if (gemmaCheck.text) gemmaSample = gemmaCheck.text;
  } else {
    // Fast check if Ollama daemon is up on 11434
    const http = require('http');
    gemmaOnline = await new Promise((resolve) => {
      const r = http.get('http://localhost:11434/api/tags', { timeout: 1500 }, (resp) => {
        resolve(resp.statusCode === 200);
      });
      r.on('error', () => resolve(false));
      r.on('timeout', () => { r.destroy(); resolve(false); });
    });
  }

  const amdCheck = await callAMDTokenFactory([{ role: 'user', content: 'Say: AMD ROCM ONLINE' }], 6000);

  res.json({
    gemmaOnline,
    gemmaLatencyMs,
    gemmaModel: runtimeConfig.gemmaModel,
    gemmaSample,
    amdOnline: amdCheck.ok,
    amdConfigured: Boolean(runtimeConfig.amdApiKey),
    amdSample: amdCheck.text || (runtimeConfig.amdApiKey ? 'Connection failed — check API key' : 'No AMD Token Factory API Key entered yet'),
    amdModel: runtimeConfig.amdModel,
    amdEndpoint: runtimeConfig.amdEndpoint
  });
});

/**
 * POST /api/companies
 * Register a new Company account
 */
app.post('/api/companies', (req, res) => {
  const { name, industry, companySize, contactRole, targetAudience, brandVibe } = req.body;
  if (!name || !industry) {
    return res.status(400).json({ error: 'Company name and industry are required.' });
  }

  const newCompany = {
    id: `comp_${Date.now()}`,
    name: name.trim(),
    industry: industry.trim(),
    companySize: companySize || '15-50 Employees',
    contactRole: contactRole || 'Product & Insights Lead',
    targetAudience: targetAudience || 'Gamers & Digital Consumers',
    brandVibe: brandVibe || 'Bold, Next-Gen, High-Impact',
    createdAt: new Date().toISOString()
  };

  store.companies.unshift(newCompany);
  saveStore(store);
  res.json({ company: newCompany });
});

/**
 * POST /api/players
 * Register a new Normal User (Player) account
 */
app.post('/api/players', (req, res) => {
  const { name, email, ageGroup, personaType } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Player name is required.' });
  }

  const pType = personaType || 'dark_fantasy_souls';
  const newPlayer = {
    id: `usr_${Date.now()}`,
    name: name.trim(),
    email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@genvey.gg`,
    ageGroup: ageGroup || '18-24',
    personaType: pType,
    personaTitle: pType === 'cyber_mecha_action'
      ? 'Audience B: Armored Core / Cyber-Mecha Fan'
      : 'Audience A: Elden / Dark Souls Fantasy Gamer',
    points: 400, // Welcome bonus
    lifetimePoints: 400,
    xp: 250,
    level: 1,
    gamesWon: 0,
    badges: ['⚔️ Ashen Challenger'],
    redemptions: []
  };

  store.players.unshift(newPlayer);
  saveStore(store);
  res.json({ player: newPlayer });
});

/**
 * POST /api/campaigns/generate
 * Generates a playable 3D Souls-Like Boss Game from a Company's survey questions
 */
app.post('/api/campaigns/generate', async (req, res) => {
  try {
    const {
      companyId,
      companyName,
      industry,
      surveyObjective,
      genre,
      mediaType,
      durationMinutes,
      rewardPoints,
      basePrice,
      questions
    } = req.body;

    let company = store.companies.find((c) => c.id === companyId);
    if (!company && companyName) {
      company = {
        id: `comp_${Date.now()}`,
        name: companyName.trim(),
        industry: (industry || 'Consumer Brand').trim(),
        createdAt: new Date().toISOString()
      };
      store.companies.unshift(company);
    }
    if (!company) company = store.companies[0];

    const compiled = await compileSurveyToGame(company, {
      companyName: company.name,
      genre,
      mediaType,
      durationMinutes,
      questions
    });

    const newCampaign = {
      id: `camp_${Date.now()}`,
      companyId: company.id,
      companyName: company.name,
      industry: company.industry,
      title: req.body.customTitle || compiled.gameTitle,
      surveyObjective: surveyObjective || `Discover consumer preferences for ${company.name} via 3D Souls Boss combat.`,
      genre: compiled.genre,
      genreName: compiled.genreName,
      setting: compiled.setting,
      mediaType: compiled.mediaType,
      durationMinutes: compiled.durationMinutes,
      rewardPoints: Number(rewardPoints) || (compiled.durationMinutes * 90 + 150),
      basePrice: Number(basePrice) || 49,
      createdAt: new Date().toISOString(),
      proceduralBossConfig: compiled.proceduralBossConfig,
      questions: (questions && questions.length > 0) ? questions : compiled.stages.map((s) => ({
        id: s.hiddenSurveyQuestion.questionId,
        text: s.hiddenSurveyQuestion.originalQuestionText,
        category: s.hiddenSurveyQuestion.category,
        options: s.choices.map((c) => c.mappedOption)
      })),
      stages: compiled.stages,
      aiTelemetry: compiled.aiTelemetry
    };

    store.campaigns.unshift(newCampaign);
    saveStore(store);

    res.json({
      campaign: newCampaign,
      aiTelemetry: compiled.aiTelemetry
    });
  } catch (err) {
    console.error('Campaign generation error:', err);
    res.status(500).json({ error: 'Failed to compile survey into 3D Souls game.' });
  }
});

/**
 * GET /api/campaigns/:id/analytics
 * Returns clean survey results from completed 3D Boss battles
 */
app.get('/api/campaigns/:id/analytics', async (req, res) => {
  const campaign = store.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found.' });
  }

  const campaignSessions = store.sessions.filter((s) => s.campaignId === campaign.id);
  const analytics = aggregateCampaignAnalytics(campaign, campaignSessions);

  res.json({
    campaign,
    analytics,
    recentSessions: campaignSessions.slice(0, 10)
  });
});

/**
 * POST /api/campaigns/:id/play
 * Records a completed 3D Souls Boss victory, maps imbued Relics to survey answers, and rewards the player
 */
app.post('/api/campaigns/:id/play', (req, res) => {
  const campaign = store.campaigns.find((c) => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found.' });
  }

  const { playerId, answers, impliedWTP, comboMultiplier } = req.body;
  const player = store.players.find((p) => p.id === playerId) || store.players[0];

  const basePoints = campaign.rewardPoints || 500;
  const bonusPoints = Math.round(basePoints * Math.max(0, (Number(comboMultiplier) || 1.25) - 1));
  const totalEarnedPoints = basePoints + bonusPoints;
  const earnedXp = 220 + (answers?.length || 3) * 60;

  const enrichedAnswers = (answers || []).map((a, idx) => {
    const conv = computeConvictionWeight(a.reactionTimeMs || 1650, campaign.genre);
    return {
      questionId: a.questionId || campaign.questions?.[idx]?.id || `q_${idx + 1}`,
      questionIndex: idx,
      mappedOption: a.mappedOption,
      reactionTimeMs: conv.reactionTimeMs,
      convictionScore: conv.convictionScore,
      cognitiveState: conv.cognitiveState
    };
  });

  const newSession = {
    id: `sess_${Date.now()}`,
    campaignId: campaign.id,
    playerId: player.id,
    playerName: player.name,
    personaType: player.personaType,
    completedAt: new Date().toISOString(),
    impliedWTP: Number(impliedWTP) || campaign.basePrice || 49,
    score: 900 + Math.round(Math.random() * 95),
    answers: enrichedAnswers
  };

  store.sessions.unshift(newSession);

  player.points += totalEarnedPoints;
  player.lifetimePoints += totalEarnedPoints;
  player.xp += earnedXp;
  player.gamesWon += 1;
  player.level = Math.floor(player.xp / 250) + 1;
  if (!player.badges.includes('👑 Boss Vanquisher')) {
    player.badges.push('👑 Boss Vanquisher');
  }

  saveStore(store);

  res.json({
    session: newSession,
    player,
    rewardsEarned: {
      basePoints,
      bonusPoints,
      totalEarnedPoints,
      earnedXp,
      newBalance: player.points
    }
  });
});

/**
 * POST /api/players/:id/redeem
 * Redeems player Genvey Coins for Store Credits or Actual Cash
 */
app.post('/api/players/:id/redeem', (req, res) => {
  const player = store.players.find((p) => p.id === req.params.id);
  if (!player) {
    return res.status(404).json({ error: 'Player not found.' });
  }

  const { rewardId, payoutDestination } = req.body;
  const reward = store.rewardsCatalog.find((r) => r.id === rewardId);
  if (!reward) {
    return res.status(404).json({ error: 'Reward item not found.' });
  }

  if (player.points < reward.pointsCost) {
    return res.status(400).json({
      error: `Need ${reward.pointsCost} Coins (You have ${player.points} Coins). Defeat another Boss to earn more!`
    });
  }

  player.points -= reward.pointsCost;

  const codePrefix = reward.type === 'actual_cash' ? 'CASH-TX' : 'GIFT-CODE';
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  const redemption = {
    id: `red_${Date.now()}`,
    rewardId: reward.id,
    rewardTitle: reward.title,
    provider: reward.provider,
    type: reward.type,
    pointsSpent: reward.pointsCost,
    cashValueUsd: reward.cashValueUsd,
    destination: payoutDestination || player.email,
    voucherCode: `${codePrefix}-${randomCode}`,
    redeemedAt: new Date().toISOString()
  };

  player.redemptions.unshift(redemption);
  saveStore(store);

  res.json({
    redemption,
    player
  });
});

app.listen(PORT, () => {
  console.log(`===================================================================`);
  console.log(`⚔️  GENVEY Track 4: 3D Souls-Like Adaptive Survey Worlds Online`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`⚡ AI Compute: AMD Token Factory (ROCm/Instinct) + Local Gemma 4`);
  console.log(`===================================================================`);
});
