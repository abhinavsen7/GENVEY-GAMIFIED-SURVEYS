/**
 * reseed_games.js
 * 1. Wipes all 15 previous legacy games and test sessions.
 * 2. Uses live AMD Token Factory (Gemma-4-31B-IT on Radeon Cloud) to generate:
 *    - Star Wars: Knights of the Old Republic Style RPG (reone Engine backend)
 *    - Diablo 1 & 2 Dark Gothic ARPG (Freeablo Engine backend)
 * 3. AI adapts color scheme, atmosphere, and injects survey questions into in-game consoles and shrines.
 */

const fs = require('fs');
const path = require('path');
const { loadStore, saveStore } = require('../src/store');
const { compileSurveyToGame } = require('../src/ai_engine');
const { configureFreeabloForCampaign, parseKotorTalkTable } = require('../src/native_engine_manager');

async function reseed() {
  console.log('⚔️  Wiping all previous games from data_store.json...');
  const store = loadStore();
  store.campaigns = [];
  store.sessions = [];

  const kotorCompany = store.companies.find((c) => c.name.includes('RazerNova')) || {
    id: `comp_razernova`,
    name: 'RazerNova Gaming',
    industry: 'Next-Gen Peripherals & Audio',
    createdAt: new Date().toISOString()
  };

  const diabloCompany = store.companies.find((c) => c.name.includes('Hyperion')) || {
    id: `comp_hyperion`,
    name: 'Hyperion Energy & Beverages',
    industry: 'D2C Craft Energy & Esports Nutrition',
    createdAt: new Date().toISOString()
  };

  console.log('\n🌌 Generating Game 1: Star Wars KotOR Style RPG (reone Engine Backend) via Gemma-4-31B-IT on AMD Cloud...');
  const kotorQuestions = [
    {
      id: 'q_kotor_1',
      category: 'Phase 1: Hardware Responsiveness',
      text: 'Which controller input technology provides the greatest tactical advantage in fast-paced combat?',
      options: [
        'Hall-Effect Zero-Drift Analog Sticks',
        'Optical Micro-Switch Triggers',
        '8000Hz Hyper-Polling Wireless Rate',
        'Modular Swappable D-Pad Profiles'
      ]
    },
    {
      id: 'q_kotor_2',
      category: 'Phase 2: Multimodal Spatial Audio',
      text: 'Which acoustic sound profile best immerses you in cosmic sci-fi environments?',
      options: [
        'Deep Sub-Bass Cinematic Boom',
        'Crisp Spatial Pinpoint Directionality',
        'Balanced Natural Studio Acoustics',
        'Warm Dynamic Ambient Surround'
      ]
    },
    {
      id: 'q_kotor_3',
      category: 'Phase 3: Value & Pricing Tier',
      text: 'Which price tier feels like the most compelling value for a tournament pro controller?',
      options: [
        '$59 Core Tournament Wired',
        '$89 Pro Wireless Low-Latency',
        '$119 Magnetic Charging Dock Bundle',
        '$149 Carbon Fiber Collector Edition'
      ]
    }
  ];

  const kotorCompiled = await compileSurveyToGame(kotorCompany, {
    companyName: kotorCompany.name,
    genre: 'reone_kotor',
    mediaType: 'full_multimodal',
    durationMinutes: 5,
    questions: kotorQuestions
  });

  const kotorCampaign = {
    id: `camp_kotor_${Date.now()}`,
    companyId: kotorCompany.id,
    companyName: kotorCompany.name,
    industry: kotorCompany.industry,
    title: 'RAZERNOVA: Korriban Trial of the Star Map (Star Wars KotOR RPG)',
    surveyObjective: 'Evaluate pro gamer input and acoustic preferences via Jedi vs. Sith combat on reone framework.',
    genre: 'reone_kotor',
    genreName: 'Star Wars: Knights of the Old Republic RPG (reone Engine)',
    setting: kotorCompiled.setting || 'Korriban Sith Academy & Star Forge Spire',
    mediaType: 'full_multimodal',
    durationMinutes: 5,
    rewardPoints: 600,
    basePrice: 89,
    createdAt: new Date().toISOString(),
    proceduralBossConfig: kotorCompiled.proceduralBossConfig,
    questions: kotorQuestions,
    stages: kotorCompiled.stages,
    aiTelemetry: kotorCompiled.aiTelemetry
  };
  const kotorTalkTable = parseKotorTalkTable(10);
  kotorCampaign.proceduralBossConfig.talkTableStatus = kotorTalkTable;
  store.campaigns.push(kotorCampaign);
  console.log('✅ KotOR Campaign Created:', kotorCampaign.title);
  console.log('   Inference:', kotorCompiled.aiTelemetry.activeInferenceSource);
  console.log('   Linked KotOR dialog strings:', kotorTalkTable.totalStringsCount);

  console.log('\n🔥 Generating Game 2: Diablo 1 & 2 Dark Gothic ARPG (Freeablo Engine Backend) via Gemma-4-31B-IT on AMD Cloud...');
  const diabloQuestions = [
    {
      id: 'q_diablo_1',
      category: 'Phase 1: Dark Fantasy Elixir Flavor',
      text: 'Which potion flavor profile sustains your focus through the darkest dungeon raids?',
      options: [
        'Crimson Blood-Orange Health Potion',
        'Abyssal Blue-Raspberry Mana Surge',
        'Solar Gold Citrus Stamina Brew',
        'Shadow Blackberry Elixir of the Ancients'
      ]
    },
    {
      id: 'q_diablo_2',
      category: 'Phase 2: Functional Energy Ingredients',
      text: 'Which functional health & energy formulation do you prioritize most?',
      options: [
        'Zero Sugar Clean Natural Caffeine',
        'L-Theanine & Nootropic Cognitive Focus',
        'Rapid-Absorption Electrolytes',
        'Immunity & Anti-Oxidant Herbal Extracts'
      ]
    },
    {
      id: 'q_diablo_3',
      category: 'Phase 3: Packaging & Raid Format',
      text: 'Which supply tier represents the best daily value for your gaming setup?',
      options: [
        '$2.49 Single Cold Can Drop',
        '$29.99 40-Serving Powder Tub',
        '$39.99 Shaker & Trial Flavour Bundle',
        '$59.99 Guild Vault Season Pass'
      ]
    }
  ];

  const diabloCompiled = await compileSurveyToGame(diabloCompany, {
    companyName: diabloCompany.name,
    genre: 'freeablo_diablo',
    mediaType: 'full_multimodal',
    durationMinutes: 5,
    questions: diabloQuestions
  });

  const diabloCampaign = {
    id: `camp_diablo_${Date.now() + 1}`,
    companyId: diabloCompany.id,
    companyName: diabloCompany.name,
    industry: diabloCompany.industry,
    title: 'HYPERION: Tristram Catacombs of Despair (Diablo 1 & 2 Dark Gothic ARPG)',
    surveyObjective: 'Gather functional beverage and energy preferences via Barbarian hack-and-slash on Freeablo framework.',
    genre: 'freeablo_diablo',
    genreName: 'Diablo 1 & 2 Dark Gothic ARPG (Freeablo Engine)',
    setting: diabloCompiled.setting || 'Tristram Catacombs of Despair',
    mediaType: 'full_multimodal',
    durationMinutes: 5,
    rewardPoints: 600,
    basePrice: 30,
    createdAt: new Date().toISOString(),
    proceduralBossConfig: diabloCompiled.proceduralBossConfig,
    questions: diabloQuestions,
    stages: diabloCompiled.stages,
    aiTelemetry: diabloCompiled.aiTelemetry
  };
  const freeabloCfg = configureFreeabloForCampaign(diabloCampaign);
  diabloCampaign.proceduralBossConfig.freeabloConfig = freeabloCfg;
  store.campaigns.push(diabloCampaign);
  console.log('✅ Diablo Campaign Created:', diabloCampaign.title);
  console.log('   Inference:', diabloCompiled.aiTelemetry.activeInferenceSource);
  console.log('   Configured Freeablo settings:', freeabloCfg.success);

  // Save clean data store
  saveStore(store);
  console.log('\n🎉 Successfully wiped old games and seeded 2 authentic open-source engine games into data_store.json!');
  console.log('Total campaigns in store:', store.campaigns.length);
}

reseed().catch(console.error);
