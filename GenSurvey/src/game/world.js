/**
 * Surveytopia - World Map, District Definitions, Buildings, and Collisions
 */

export const WORLD_WIDTH = 2600;
export const WORLD_HEIGHT = 2000;

export const DISTRICTS = [
  {
    id: 'central',
    name: 'Central Plaza',
    subtitle: 'Heart of Surveytopia • Town Hall & Bank',
    bounds: { x: 950, y: 700, width: 700, height: 600 },
    theme: {
      primary: '#6366f1',
      ambient: 'rgba(99, 102, 241, 0.08)',
      roadColor: '#242b3d',
      pavementColor: '#1e2433'
    }
  },
  {
    id: 'tech',
    name: 'Tech Plaza',
    subtitle: 'Electronics, AI & Quantum Computing',
    bounds: { x: 100, y: 100, width: 950, height: 750 },
    theme: {
      primary: '#06b6d4',
      ambient: 'rgba(6, 182, 212, 0.12)',
      roadColor: '#111827',
      pavementColor: '#0f172a',
      neonGrid: true
    }
  },
  {
    id: 'retail',
    name: 'Retail Row',
    subtitle: 'Dining, Groceries & FMCG Trends',
    bounds: { x: 1550, y: 100, width: 950, height: 750 },
    theme: {
      primary: '#10b981',
      ambient: 'rgba(16, 185, 129, 0.10)',
      roadColor: '#2b231d',
      pavementColor: '#241e19'
    }
  },
  {
    id: 'auto',
    name: 'Auto Alley',
    subtitle: 'EVs, Automotive & Daily Commute',
    bounds: { x: 100, y: 1150, width: 950, height: 750 },
    theme: {
      primary: '#f59e0b',
      ambient: 'rgba(245, 158, 11, 0.10)',
      roadColor: '#1c1917',
      pavementColor: '#171412'
    }
  },
  {
    id: 'cinema',
    name: 'Cinema Street',
    subtitle: 'Streaming, Entertainment & Gaming',
    bounds: { x: 1550, y: 1150, width: 950, height: 750 },
    theme: {
      primary: '#ec4899',
      ambient: 'rgba(236, 72, 153, 0.12)',
      roadColor: '#201625',
      pavementColor: '#1a111f'
    }
  }
];

export const BUILDINGS = [
  // CENTRAL PLAZA BUILDINGS
  {
    id: 'town_hall',
    name: 'Surveytopia Town Hall',
    x: 1120,
    y: 720,
    width: 360,
    height: 180,
    roofColor: '#4f46e5',
    wallColor: '#312e81',
    accentColor: '#818cf8',
    icon: '🏛️',
    door: { x: 1260, y: 880, width: 80, height: 20 },
    npcId: 'mayor_sterling'
  },
  {
    id: 'town_bank',
    name: 'Surveytopia Central Bank & Cashout',
    x: 1120,
    y: 1100,
    width: 360,
    height: 170,
    roofColor: '#16a34a',
    wallColor: '#14532d',
    accentColor: '#4ade80',
    icon: '🏦',
    door: { x: 1260, y: 1100, width: 80, height: 20 },
    interactiveType: 'bank'
  },

  // TECH PLAZA BUILDINGS
  {
    id: 'holo_forge',
    name: 'Holo-Forge AI Labs',
    x: 220,
    y: 200,
    width: 340,
    height: 200,
    roofColor: '#0891b2',
    wallColor: '#164e63',
    accentColor: '#22d3ee',
    icon: '💻',
    npcId: 'nova_tech'
  },
  {
    id: 'quantum_lounge',
    name: 'Quantum VIP Penthouse',
    x: 640,
    y: 200,
    width: 340,
    height: 220,
    roofColor: '#4338ca',
    wallColor: '#1e1b4b',
    accentColor: '#a5b4fc',
    icon: '💎',
    isVip: true,
    bouncerNpcId: 'titan_bouncer',
    vipNpcId: 'quantum_vip'
  },

  // RETAIL ROW BUILDINGS
  {
    id: 'bistro',
    name: 'Le Gourmet Bistro & Market',
    x: 1620,
    y: 200,
    width: 340,
    height: 200,
    roofColor: '#ea580c',
    wallColor: '#7c2d12',
    accentColor: '#fb923c',
    icon: '🍽️',
    npcId: 'chef_gordon'
  },
  {
    id: 'chic_haven',
    name: 'Chic Haven Boutique',
    x: 2040,
    y: 200,
    width: 340,
    height: 200,
    roofColor: '#059669',
    wallColor: '#064e3b',
    accentColor: '#34d399',
    icon: '🛍️',
    npcId: 'harper_retail'
  },

  // AUTO ALLEY BUILDINGS
  {
    id: 'nitro_garage',
    name: 'Nitro EV & Auto Tuning',
    x: 220,
    y: 1260,
    width: 360,
    height: 210,
    roofColor: '#d97706',
    wallColor: '#78350f',
    accentColor: '#fbbf24',
    icon: '🔧',
    npcId: 'axel_mechanic'
  },
  {
    id: 'hypercar_club',
    name: 'Hypercar VIP Paddock',
    x: 660,
    y: 1260,
    width: 340,
    height: 210,
    roofColor: '#dc2626',
    wallColor: '#7f1d1d',
    accentColor: '#f87171',
    icon: '🏎️',
    isVip: true,
    bouncerNpcId: 'clutch_bouncer',
    vipNpcId: 'hypercar_vip'
  },

  // CINEMA STREET BUILDINGS
  {
    id: 'neon_cinema',
    name: 'Neon Grand Cinema & Studios',
    x: 1620,
    y: 1260,
    width: 360,
    height: 220,
    roofColor: '#be185d',
    wallColor: '#701a75',
    accentColor: '#f472b6',
    icon: '🎬',
    npcId: 'director_stella'
  },
  {
    id: 'pixel_palace',
    name: 'Pixel Palace Retro Arcade',
    x: 2060,
    y: 1260,
    width: 340,
    height: 210,
    roofColor: '#7e22ce',
    wallColor: '#4c1d95',
    accentColor: '#c084fc',
    icon: '🕹️',
    npcId: 'popcorn_pete'
  }
];

// Interactive landmarks, trees, streetlights, cars, fountain
export const PROPS = [
  // Central Fountain (Holographic globe)
  { type: 'fountain', x: 1300, y: 1000, radius: 46 },

  // Trickster Goblin Hideout (Alleyway between Tech and Auto)
  { type: 'dumpster', x: 800, y: 920, width: 60, height: 40 },

  // Park Benches in Central
  { type: 'bench', x: 1200, y: 960, width: 44, height: 16 },
  { type: 'bench', x: 1400, y: 960, width: 44, height: 16 },
  { type: 'bench', x: 1200, y: 1040, width: 44, height: 16 },
  { type: 'bench', x: 1400, y: 1040, width: 44, height: 16 },

  // Trees in Central & Retail
  { type: 'tree', x: 1060, y: 880, radius: 26 },
  { type: 'tree', x: 1540, y: 880, radius: 26 },
  { type: 'tree', x: 1060, y: 1120, radius: 26 },
  { type: 'tree', x: 1540, y: 1120, radius: 26 },
  { type: 'tree', x: 1580, y: 440, radius: 24 },
  { type: 'tree', x: 2000, y: 440, radius: 24 },
  { type: 'tree', x: 2420, y: 440, radius: 24 },

  // Cars in Auto Alley
  { type: 'car', x: 300, y: 1540, color: '#ef4444', angle: 0 },
  { type: 'car', x: 440, y: 1540, color: '#3b82f6', angle: 0 },
  { type: 'car', x: 740, y: 1540, color: '#eab308', angle: 0 },

  // Streetlamps in Cinema & Tech
  { type: 'lamp', x: 390, y: 440, color: '#06b6d4' },
  { type: 'lamp', x: 810, y: 440, color: '#06b6d4' },
  { type: 'lamp', x: 1800, y: 1520, color: '#ec4899' },
  { type: 'lamp', x: 2230, y: 1520, color: '#ec4899' }
];

// Check collisions against world borders and solid buildings/props
export function checkCollision(x, y, radius = 18) {
  // World bounds
  if (x - radius < 40 || x + radius > WORLD_WIDTH - 40) return true;
  if (y - radius < 40 || y + radius > WORLD_HEIGHT - 40) return true;

  // Solid buildings
  for (const b of BUILDINGS) {
    // If it's a VIP building and player unlocked it, allow entry inside
    if (x + radius > b.x && x - radius < b.x + b.width &&
        y + radius > b.y && y - radius < b.y + b.height) {
      return true;
    }
  }

  // Fountain collision
  const fountain = PROPS[0];
  const dist = Math.hypot(x - fountain.x, y - fountain.y);
  if (dist < fountain.radius + radius) return true;

  return false;
}

export function getCurrentDistrict(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.bounds.x && x <= d.bounds.x + d.bounds.width &&
        y >= d.bounds.y && y <= d.bounds.y + d.bounds.height) {
      return d;
    }
  }
  return DISTRICTS[0]; // fallback Central
}
