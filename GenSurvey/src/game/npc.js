/**
 * Surveytopia - NPC Characters, Positions, and Interaction States
 */

export const NPCS = [
  // 1. CENTRAL PLAZA
  {
    id: 'mayor_sterling',
    surveyId: 'mayor_sterling',
    name: 'Mayor Sterling',
    role: 'Town Mayor & Citizen Ethics',
    x: 1300,
    y: 890,
    district: 'central',
    shirtColor: '#4f46e5',
    skinColor: '#fcd34d',
    hairColor: '#e2e8f0',
    hat: 'tophat',
    avatar: '🎩',
    dialogueReady: true,
    speech: "Welcome to Surveytopia! Honest answers build our town!"
  },
  {
    id: 'bank_teller_chloe',
    interactiveType: 'bank',
    name: 'Teller Chloe',
    role: 'Town Bank Cashout Vault',
    x: 1300,
    y: 1105,
    district: 'central',
    shirtColor: '#059669',
    skinColor: '#fbcfe8',
    hairColor: '#b45309',
    hat: 'visor',
    avatar: '🏦',
    dialogueReady: true,
    speech: "Cash out your survey coins for PayPal, UPI & Gift Cards!"
  },
  {
    id: 'gobby_goblin',
    surveyId: 'gobby_goblin',
    name: 'Gobby the Glitch',
    role: 'Honesty Auditor (Trickster Goblin)',
    x: 820,
    y: 935,
    district: 'central',
    shirtColor: '#15803d',
    skinColor: '#86efac',
    hairColor: '#166534',
    hat: 'horns',
    avatar: '👺',
    dialogueReady: true,
    isAttentionTrap: true,
    speech: "Hehehe! Think your Honesty Shield is bot-proof?"
  },

  // 2. TECH PLAZA
  {
    id: 'nova_tech',
    surveyId: 'nova_tech',
    name: 'Nova the Cyber-Dev',
    role: 'Hardware Engineer @ Holo-Forge',
    x: 390,
    y: 430,
    district: 'tech',
    shirtColor: '#06b6d4',
    skinColor: '#fed7aa',
    hairColor: '#3b82f6',
    hat: 'headset',
    avatar: '👨‍💻',
    dialogueReady: true,
    speech: "Holo-Forge needs PC & AI hardware telemetry!"
  },
  {
    id: 'titan_bouncer',
    surveyId: 'titan_bouncer',
    name: 'Titan the Bouncer',
    role: 'Quantum VIP Screener',
    x: 770,
    y: 435,
    district: 'tech',
    shirtColor: '#312e81',
    skinColor: '#94a3b8',
    hairColor: '#1e293b',
    hat: 'sunglasses',
    avatar: '🤖',
    isBouncer: true,
    targetVipNpcId: 'quantum_vip',
    dialogueReady: true,
    speech: "HALT! Screener required for Quantum VIP Penthouse."
  },
  {
    id: 'quantum_vip',
    surveyId: 'quantum_vip',
    name: 'Dr. Vane (Quantum Labs)',
    role: 'Enterprise Cloud Architect [VIP]',
    x: 850,
    y: 330,
    district: 'tech',
    shirtColor: '#8b5cf6',
    skinColor: '#fecdd3',
    hairColor: '#cbd5e1',
    hat: 'labcoat',
    avatar: '👨‍🔬',
    isVip: true,
    dialogueReady: false, // Locked until bouncer passes
    speech: "High-yield Enterprise AI Bounty ($3.80 / 380 Coins)!"
  },

  // 3. RETAIL ROW
  {
    id: 'chef_gordon',
    surveyId: 'chef_gordon',
    name: 'Chef Gordon',
    role: 'Head Chef @ Le Gourmet',
    x: 1790,
    y: 430,
    district: 'retail',
    shirtColor: '#ef4444',
    skinColor: '#fde047',
    hairColor: '#f8fafc',
    hat: 'chefhat',
    avatar: '👨‍🍳',
    dialogueReady: true,
    speech: "Fresh questions on food delivery & dining habits!"
  },
  {
    id: 'harper_retail',
    surveyId: 'harper_retail',
    name: 'Harper the Stylist',
    role: 'Boutique Stylist @ Chic Haven',
    x: 2210,
    y: 430,
    district: 'retail',
    shirtColor: '#ec4899',
    skinColor: '#fed7aa',
    hairColor: '#a855f7',
    hat: 'beret',
    avatar: '👗',
    dialogueReady: true,
    speech: "Fashion & sustainable shopping research, darling!"
  },

  // 4. AUTO ALLEY
  {
    id: 'axel_mechanic',
    surveyId: 'axel_mechanic',
    name: 'Axel the Mechanic',
    role: 'Chief Tuner @ Nitro Garage',
    x: 400,
    y: 1490,
    district: 'auto',
    shirtColor: '#f59e0b',
    skinColor: '#fed7aa',
    hairColor: '#78350f',
    hat: 'bandana',
    avatar: '🔧',
    dialogueReady: true,
    speech: "Tell me about your EV & daily commuting habits!"
  },
  {
    id: 'clutch_bouncer',
    surveyId: 'clutch_bouncer',
    name: 'Sergeant Clutch',
    role: 'Hypercar VIP Screener',
    x: 790,
    y: 1495,
    district: 'auto',
    shirtColor: '#7f1d1d',
    skinColor: '#fdba74',
    hairColor: '#172554',
    hat: 'helmet',
    avatar: '🏎️',
    isBouncer: true,
    targetVipNpcId: 'hypercar_vip',
    dialogueReady: true,
    speech: "Velvet rope active! High-mileage screener check."
  },
  {
    id: 'hypercar_vip',
    surveyId: 'hypercar_vip',
    name: 'Lady Electra',
    role: 'Director of UX @ Apex Motors [VIP]',
    x: 870,
    y: 1390,
    district: 'auto',
    shirtColor: '#dc2626',
    skinColor: '#fbcfe8',
    hairColor: '#facc15',
    hat: 'sunglasses',
    avatar: '🏁',
    isVip: true,
    dialogueReady: false, // Locked until bouncer passes
    speech: "Apex Motors $4.10 / 410 Coins Autonomous Driving Survey!"
  },

  // 5. CINEMA STREET
  {
    id: 'director_stella',
    surveyId: 'director_stella',
    name: 'Director Stella',
    role: 'Film Producer @ Starlight Studios',
    x: 1800,
    y: 1500,
    district: 'cinema',
    shirtColor: '#be185d',
    skinColor: '#fde047',
    hairColor: '#1e1b4b',
    hat: 'beret',
    avatar: '🎬',
    dialogueReady: true,
    speech: "Movie box office vs Streaming wars survey!"
  },
  {
    id: 'popcorn_pete',
    surveyId: 'popcorn_pete',
    name: 'Popcorn Pete',
    role: 'Arcade Host @ Pixel Palace',
    x: 2230,
    y: 1500,
    district: 'cinema',
    shirtColor: '#9333ea',
    skinColor: '#fed7aa',
    hairColor: '#38bdf8',
    hat: 'cap',
    avatar: '🕹️',
    dialogueReady: true,
    speech: "Gaming Battle Passes & Microtransactions study!"
  }
];

export function getNearbyNpc(playerX, playerY, maxDistance = 75) {
  let closest = null;
  let minD = maxDistance;

  for (const npc of NPCS) {
    const d = Math.hypot(npc.x - playerX, npc.y - playerY);
    if (d < minD) {
      minD = d;
      closest = npc;
    }
  }

  return closest;
}
