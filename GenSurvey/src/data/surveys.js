/**
 * Surveytopia - Survey Quests, Screeners, and Quality Check Data
 */

export const SURVEY_DATA = {
  // 1. TECH PLAZA
  'nova_tech': {
    id: 'nova_tech',
    npcName: 'Nova the Cyber-Dev',
    title: 'The AI Hardware & Workstation Survey',
    district: 'tech',
    role: 'Hardware Engineer @ Holo-Forge',
    avatar: '👨‍💻',
    greeting: "Hey there! Holo-Forge is surveying tech enthusiasts to plan our next-gen developer workstations and AI accelerator cards. Got 2 minutes to share your setup?",
    rewardCoins: 130,
    rewardGems: 6,
    rewardXp: 85,
    estimatedTime: '2 min',
    questions: [
      {
        id: 'q1',
        text: 'What is your primary operating system for daily productivity or development?',
        type: 'single',
        options: [
          { text: 'Windows 11 / 10', value: 'windows' },
          { text: 'macOS (Apple Silicon)', value: 'macos' },
          { text: 'Linux (Ubuntu / Fedora / Arch)', value: 'linux' },
          { text: 'Dual Boot / Cloud Remote Desktop', value: 'cloud' }
        ]
      },
      {
        id: 'q2',
        text: 'How frequently do you leverage Generative AI tools (LLMs, coding assistants, image gen)?',
        type: 'single',
        options: [
          { text: 'Multiple times every day (Essential workflow)', value: 'daily' },
          { text: 'A few times a week', value: 'weekly' },
          { text: 'Rarely / Just testing occasionally', value: 'rarely' },
          { text: 'Never / Avoid using AI tools', value: 'never' }
        ]
      },
      {
        id: 'q3',
        text: 'Which hardware upgrades are you most likely to purchase in the next 12 months? (Select all that apply)',
        type: 'multi',
        options: [
          { text: 'Dedicated GPU (Nvidia / AMD)', value: 'gpu' },
          { text: 'Ultrawide or 4K High Refresh Monitor', value: 'monitor' },
          { text: 'High RAM capacity (32GB - 64GB+)', value: 'ram' },
          { text: 'Lightweight Laptop with 18+ hr battery', value: 'laptop' }
        ]
      },
      {
        id: 'q4',
        text: 'On a scale of 1 to 5, how satisfied are you with current local AI processing on PCs?',
        type: 'rating',
        min: 1,
        max: 5,
        labels: ['Very Poor', 'Satisfied', 'Revolutionary']
      }
    ],
    completionText: "Telemetry uploaded to the cloud! Your feedback helps us shape next year's silicon roadmaps. Take these fresh crypto-credits!"
  },

  // TECH PLAZA - VIP VENUE & BOUNCER
  'titan_bouncer': {
    id: 'titan_bouncer',
    npcName: 'Titan the Cyber Bouncer',
    title: 'Quantum VIP Lounge Screener',
    district: 'tech',
    role: 'VIP Gatekeeper',
    avatar: '🤖',
    isBouncer: true,
    vipSurveyId: 'quantum_vip',
    consolationCoins: 15,
    screenerQuestion: {
      text: 'HALT! Exclusive Quantum Lounge ahead. Screener question: Do you work in Enterprise IT, Cloud Architecture, or own 8+ smart connected IoT devices?',
      options: [
        { text: 'Yes, I work in Cloud / IT / Manage Enterprise Tech', value: 'qualify_it', qualifies: true },
        { text: 'Yes, Smart Home enthusiast with 8+ IoT devices', value: 'qualify_iot', qualifies: true },
        { text: 'No, I just use a standard smartphone & laptop', value: 'disqualify_basic', qualifies: false },
        { text: "I'm just a casual student browsing around", value: 'disqualify_casual', qualifies: false }
      ],
      qualifyMessage: "ACCESS GRANTED! Verification biometric passed. Step right into the Quantum Lounge for high-yield market research!",
      disqualifyMessage: "Quota full for casual users today, friend. Our client needs enterprise decision-makers. Here's a 15 coin consolation token! Try Retail Row across the bridge."
    }
  },

  'quantum_vip': {
    id: 'quantum_vip',
    npcName: 'Dr. Vane (Quantum Labs)',
    title: 'Enterprise Cloud & Sovereign AI Roadmap [VIP]',
    district: 'tech',
    role: 'Lead Architect @ Quantum AI',
    avatar: '👨‍🔬',
    isVip: true,
    rewardCoins: 380,
    rewardGems: 25,
    rewardXp: 260,
    estimatedTime: '4 min',
    questions: [
      {
        id: 'q1',
        text: 'What is your company or personal priority regarding AI compute infrastructure?',
        type: 'single',
        options: [
          { text: 'Fully On-Premise / Air-gapped private clusters', value: 'onprem' },
          { text: 'Hyperscaler Cloud (AWS / GCP / Azure)', value: 'cloud' },
          { text: 'Hybrid Edge + Cloud Bursting', value: 'hybrid' },
          { text: 'Decentralized Peer-to-Peer nodes', value: 'p2p' }
        ]
      },
      {
        id: 'q2',
        text: 'What budget range does your department/household allocate annually to software subscriptions?',
        type: 'single',
        options: [
          { text: 'Under $500 / year', value: 'low' },
          { text: '$500 to $2,500 / year', value: 'mid' },
          { text: '$2,500 to $10,000 / year', value: 'high' },
          { text: '$10,000+ Enterprise Tier', value: 'enterprise' }
        ]
      },
      {
        id: 'q3',
        text: 'How critical is Data Privacy & Zero Data Retention when selecting SaaS providers?',
        type: 'rating',
        min: 1,
        max: 5,
        labels: ['Not Important', 'Moderate', 'Non-Negotiable Dealbreaker']
      }
    ],
    completionText: "Incredible enterprise insights! The Quantum Council rewards your high-tier expertise with maximum bounty!"
  },

  // 2. RETAIL ROW
  'chef_gordon': {
    id: 'chef_gordon',
    npcName: 'Chef Gordon',
    title: 'Culinary Habits & Grocery Delivery Research',
    district: 'retail',
    role: 'Head Chef @ Le Gourmet Bistro',
    avatar: '👨‍🍳',
    greeting: "Welcome to Retail Row! I'm doing research for restaurant chains and online grocery portals. Mind giving me your genuine taste?",
    rewardCoins: 115,
    rewardGems: 5,
    rewardXp: 75,
    estimatedTime: '2 min',
    questions: [
      {
        id: 'q1',
        text: 'How often do you order meals through food delivery apps (DoorDash, UberEats, Deliveroo, Swiggy/Zomato)?',
        type: 'single',
        options: [
          { text: 'Almost daily (4+ times a week)', value: 'frequent' },
          { text: '1-3 times a week (Weekend treat)', value: 'moderate' },
          { text: '1-2 times a month', value: 'occasional' },
          { text: 'Never / Prefer cooking or dining in-person', value: 'never' }
        ]
      },
      {
        id: 'q2',
        text: 'Which factors sway you most when picking an online grocery brand? (Choose top 2)',
        type: 'multi',
        options: [
          { text: 'Speed of delivery (under 30 mins)', value: 'speed' },
          { text: 'Lowest prices & discount coupons', value: 'discounts' },
          { text: 'Freshness guarantee of produce & meat', value: 'freshness' },
          { text: 'Organic & eco-friendly packaging', value: 'eco' }
        ]
      },
      {
        id: 'q3',
        text: 'How much are you willing to pay as a delivery & service fee for instant groceries?',
        type: 'single',
        options: [
          { text: '$0 (Only order if free delivery)', value: 'zero' },
          { text: '$1.00 - $2.50', value: 'low' },
          { text: '$3.00 - $5.00', value: 'medium' },
          { text: '$5.00+ if under 15 minutes', value: 'premium' }
        ]
      }
    ],
    completionText: "Mamma mia, that is delicious data! The culinary guild thanks you with fresh coins. Bon appétit!"
  },

  'harper_retail': {
    id: 'harper_retail',
    npcName: 'Harper the Trendsetter',
    title: 'Fast Fashion & Sustainable Retail Study',
    district: 'retail',
    role: 'Boutique Stylist @ Chic Haven',
    avatar: '👗',
    greeting: "Darling! Fashion brands need to know if consumers actually care about sustainable apparel or just flashy sales. Quick styling survey?",
    rewardCoins: 90,
    rewardGems: 4,
    rewardXp: 60,
    estimatedTime: '1.5 min',
    questions: [
      {
        id: 'q1',
        text: 'Where do you purchase the majority of your clothing and footwear?',
        type: 'single',
        options: [
          { text: 'Online marketplaces (Amazon, ASOS, Zara online)', value: 'online' },
          { text: 'Physical retail malls and department stores', value: 'malls' },
          { text: 'Thrift stores & vintage consignment shops', value: 'thrift' },
          { text: 'Direct-to-consumer sustainable indie brands', value: 'indie' }
        ]
      },
      {
        id: 'q2',
        text: 'Would you pay 15% more for clothing guaranteed 100% recycled or ethically made?',
        type: 'single',
        options: [
          { text: 'Yes, absolutely - sustainability is my priority', value: 'yes' },
          { text: 'Only if the style and durability match premium brands', value: 'maybe' },
          { text: 'No, price and fit come first', value: 'no' }
        ]
      }
    ],
    completionText: "Fabulous answers, darling! Keep that aesthetic glowing with these shiny coins!"
  },

  // 3. AUTO ALLEY
  'axel_mechanic': {
    id: 'axel_mechanic',
    npcName: 'Axel the Grease Monkey',
    title: 'Electric Mobility & Daily Commute Trends',
    district: 'auto',
    role: 'Chief Tuner @ Nitro Garage',
    avatar: '🔧',
    greeting: "Yo driver! The automotive consortium wants real driver data on EV range anxiety, public chargers, and gas prices. Ready to inspect your engine?",
    rewardCoins: 145,
    rewardGems: 7,
    rewardXp: 95,
    estimatedTime: '2.5 min',
    questions: [
      {
        id: 'q1',
        text: 'What type of vehicle powers your primary transportation?',
        type: 'single',
        options: [
          { text: 'Gasoline / Diesel internal combustion engine (ICE)', value: 'ice' },
          { text: 'Hybrid (PHEV or HEV)', value: 'hybrid' },
          { text: 'Full Battery Electric Vehicle (BEV)', value: 'ev' },
          { text: 'Public transit, bicycle, or e-scooter', value: 'transit' }
        ]
      },
      {
        id: 'q2',
        text: 'What is the biggest hesitation stopping you (or peers) from buying an EV?',
        type: 'single',
        options: [
          { text: 'High upfront vehicle purchase cost', value: 'cost' },
          { text: 'Lack of reliable public chargers on road trips', value: 'chargers' },
          { text: 'Battery degradation & replacement worries', value: 'battery' },
          { text: 'Nothing - I already own one or want one ASAP', value: 'none' }
        ]
      },
      {
        id: 'q3',
        text: 'Rate the importance of in-car tech (Apple CarPlay, Android Auto, Heads-up Display) on a 1-5 scale:',
        type: 'rating',
        min: 1,
        max: 5,
        labels: ['Dont Care', 'Nice to Have', 'Must-Have Requirement']
      }
    ],
    completionText: "That's premium octane data! Your feedback will keep future cars fast, smart, and green. Here is your payout!"
  },

  // AUTO ALLEY - VIP BOUNCER
  'clutch_bouncer': {
    id: 'clutch_bouncer',
    npcName: 'Sergeant Clutch',
    title: 'Hypercar & Autonomous Club Screener',
    district: 'auto',
    role: 'Paddock Marshal',
    avatar: '🏎️',
    isBouncer: true,
    vipSurveyId: 'hypercar_vip',
    consolationCoins: 20,
    screenerQuestion: {
      text: 'HOLD UP! Only active long-haul drivers or premium auto enthusiasts past this velvet rope. Screener: How many miles/km do you drive each week?',
      options: [
        { text: 'Over 100 miles (160 km) per week (Daily long commuter / Road tripper)', value: 'high_mileage', qualifies: true },
        { text: '50 - 100 miles per week (Regular suburban commuter)', value: 'mid_mileage', qualifies: true },
        { text: 'Under 20 miles per week (Weekend short trips only)', value: 'low_mileage', qualifies: false },
        { text: "I do not drive or own a vehicle", value: 'no_drive', qualifies: false }
      ],
      qualifyMessage: "Green flag waving! You fit the high-mileage driver profile. The Hypercar VIP lounge awaits you!",
      disqualifyMessage: "Looking for high-mileage road warriors today, champ. Take 20 coins for your gas tank and check out Cinema Street down the road!"
    }
  },

  'hypercar_vip': {
    id: 'hypercar_vip',
    npcName: 'Lady Electra',
    title: 'Autonomous Navigation & Premium In-Cabin Audio [VIP]',
    district: 'auto',
    role: 'Director of UX @ Apex Motors',
    avatar: '🏁',
    isVip: true,
    rewardCoins: 410,
    rewardGems: 28,
    rewardXp: 290,
    estimatedTime: '4 min',
    questions: [
      {
        id: 'q1',
        text: 'How comfortable would you be taking a nap in a Level-4 fully autonomous self-driving car on highways?',
        type: 'single',
        options: [
          { text: 'Completely comfortable - trust the sensors', value: 'trust' },
          { text: 'Slightly nervous, would check frequently', value: 'cautious' },
          { text: 'Never - human hands must stay on the wheel', value: 'never' }
        ]
      },
      {
        id: 'q2',
        text: 'Which in-cabin luxury feature would you pay extra for?',
        type: 'multi',
        options: [
          { text: 'Studio Dolby Atmos sound with seat headrest speakers', value: 'audio' },
          { text: 'Heated, ventilated & acupressure massage seats', value: 'massage' },
          { text: 'Ultra-fast satellite internet hotspot worldwide', value: 'starlink' },
          { text: 'Augmented reality full windshield navigation', value: 'ar_hud' }
        ]
      }
    ],
    completionText: "Sensational telemetry! The Apex Board awards you maximum VIP tokens and honorary racer status!"
  },

  // 4. CINEMA STREET
  'director_stella': {
    id: 'director_stella',
    npcName: 'Director Stella',
    title: 'Streaming Wars & Cinema Box Office Study',
    district: 'cinema',
    role: 'Film Producer @ Starlight Studios',
    avatar: '🎬',
    greeting: "Action! Movie studios are locked in battle between theatrical releases and instant streaming. What makes YOU buy a cinema ticket?",
    rewardCoins: 125,
    rewardGems: 5,
    rewardXp: 80,
    estimatedTime: '2 min',
    questions: [
      {
        id: 'q1',
        text: 'Which streaming platforms are you actively subscribed to right now? (Select all)',
        type: 'multi',
        options: [
          { text: 'Netflix', value: 'netflix' },
          { text: 'Disney+ / Hulu', value: 'disney' },
          { text: 'Amazon Prime Video', value: 'prime' },
          { text: 'Max (HBO) / Apple TV+', value: 'max_apple' },
          { text: 'Free Ad-Supported (YouTube / Tubi / Pluto)', value: 'free' }
        ]
      },
      {
        id: 'q2',
        text: 'What movie genre drags you to a physical IMAX/Dolby cinema instead of waiting for home streaming?',
        type: 'single',
        options: [
          { text: 'Sci-Fi / Superhero Big CGI spectacles (Dune, Marvel, Avatar)', value: 'scifi' },
          { text: 'Horror & Psychological Thrillers with crowd reactions', value: 'horror' },
          { text: 'Animation / Family blockbusters', value: 'animation' },
          { text: 'Nothing - I strictly prefer watching from my couch', value: 'couch' }
        ]
      },
      {
        id: 'q3',
        text: 'How tolerant are you of unskippable commercial ads on streaming services if the tier is 50% cheaper?',
        type: 'rating',
        min: 1,
        max: 5,
        labels: ['Hate Ads (Will Cancel)', 'Tolerable', 'Love Cheaper Tier']
      }
    ],
    completionText: "That's a wrap! Five stars for your answers. Collect your royalty coins and enjoy the premiere!"
  },

  'popcorn_pete': {
    id: 'popcorn_pete',
    npcName: 'Popcorn Pete',
    title: 'Gaming Microtransactions & Battle Pass Feedback',
    district: 'cinema',
    role: 'Arcade Host @ Pixel Palace',
    avatar: '🕹️',
    greeting: "Sup player one! The gaming publishers want honest opinions on Season Passes, Gacha loot, and cosmetics. Don't pull your punches!",
    rewardCoins: 105,
    rewardGems: 4,
    rewardXp: 70,
    estimatedTime: '2 min',
    questions: [
      {
        id: 'q1',
        text: 'How do you feel about paid Battle Passes in video games?',
        type: 'single',
        options: [
          { text: 'Love them - great value for active gamers', value: 'love' },
          { text: 'Only buy them if they give back enough premium currency to renew', value: 'self_sustaining' },
          { text: 'Dislike FOMO (fear of missing out) time gates', value: 'hate_fomo' },
          { text: 'Never spend money on microtransactions', value: 'never' }
        ]
      },
      {
        id: 'q2',
        text: 'What is the most acceptable form of in-game monetization?',
        type: 'single',
        options: [
          { text: 'Cosmetic only skins / emotes (Zero gameplay advantage)', value: 'cosmetic' },
          { text: 'Expansions and DLC story campaigns', value: 'dlc' },
          { text: 'Pay-to-progress speedups', value: 'pay2skip' }
        ]
      }
    ],
    completionText: "High score achieved! Pete gives you an arcade token pouch full of shiny coins!"
  },

  // 5. ATTENTION CHECK / HONESTY SHIELD (ANTI-FRAUD MECHANIC)
  'gobby_goblin': {
    id: 'gobby_goblin',
    npcName: 'Gobby the Glitch Goblin',
    title: 'The Trickster Attention Trap',
    district: 'central',
    role: 'Market Research Integrity Bot',
    avatar: '👺',
    greeting: "Hehehe! Lurking in the alleyways, I catch automated bots and reckless speed-clickers! Think your Honesty Shield can withstand my cunning questions?",
    rewardCoins: 150,
    rewardGems: 12,
    rewardXp: 120,
    estimatedTime: '1.5 min',
    isAttentionTrap: true,
    questions: [
      {
        id: 'q1',
        text: 'To begin, what is your favorite gaming genre?',
        type: 'single',
        options: [
          { text: 'Open World RPGs', value: 'rpg' },
          { text: 'Shooters / Battle Royale', value: 'fps' },
          { text: 'Strategy & Simulation', value: 'strategy' },
          { text: 'Puzzle & Casual', value: 'casual' }
        ]
      },
      {
        id: 'q2_trap',
        text: '🚨 ATTENTION AUDIT: To verify you are reading questions attentively, please choose the option labeled "Cyber Neon Blue" below, regardless of your personal preference.',
        type: 'attention_check',
        targetValue: 'neon_blue',
        options: [
          { text: 'Crimson Dragon Red', value: 'red' },
          { text: 'Cyber Neon Blue (Required Check)', value: 'neon_blue' },
          { text: 'Emerald Goblin Green', value: 'green' },
          { text: 'Shadow Void Black', value: 'black' }
        ]
      },
      {
        id: 'q3',
        text: 'On a scale of 1 to 5, how meticulously do you read survey questions in real life?',
        type: 'rating',
        min: 1,
        max: 5,
        labels: ['Skim Quickly', 'Reasonably Mindful', 'Word by Word']
      }
    ],
    passText: "Curses! Your Honesty Shield deflected my trap! You truly read with sharp eyes. +5% Honesty Shield bonus & shiny bounty awarded!",
    failText: "Aha! Caught you speed-clicking! You failed the attention check. Your Trust Score drops by 15%! The Market Research Council does not like bots."
  },

  // 6. CENTRAL PLAZA - MAYOR & REPUTATION REHAB
  'mayor_sterling': {
    id: 'mayor_sterling',
    npcName: 'Mayor Sterling',
    title: 'Surveytopia Citizen Briefing & Ethics',
    district: 'central',
    role: 'Mayor of Surveytopia',
    avatar: '🎩',
    greeting: "Greetings, citizen! Welcome to Surveytopia, where consumer voices build our vibrant economy. Every district houses real brands eager for honest feedback. Keep your Honesty Shield high to access exclusive VIP venues!",
    rewardCoins: 75,
    rewardGems: 5,
    rewardXp: 50,
    estimatedTime: '1 min',
    questions: [
      {
        id: 'q1',
        text: 'What do you think is the best benefit of open-world survey gamification?',
        type: 'single',
        options: [
          { text: 'Turning boring radio buttons into immersive RPG quests', value: 'fun' },
          { text: 'Earning real cashout rewards at the Town Bank', value: 'cash' },
          { text: 'Exploring themed 2D districts and customizing avatars', value: 'rpg' },
          { text: 'All of the above!', value: 'all' }
        ]
      }
    ],
    completionText: "Here is your Citizen Welcome Bounty! Visit the Town Bank anytime to withdraw your earned rewards into real payment methods."
  }
};

export const CASHOUT_OPTIONS = [
  {
    id: 'paypal',
    name: 'PayPal Cash',
    icon: '💳',
    color: '#0070ba',
    rates: [
      { coins: 500, value: '$5.00' },
      { coins: 1000, value: '$10.00' },
      { coins: 2500, value: '$25.00' }
    ],
    fieldLabel: 'PayPal Email Address',
    placeholder: 'surveyor@example.com'
  },
  {
    id: 'upi',
    name: 'UPI / Instant Bank (India/Global)',
    icon: '⚡',
    color: '#00baf2',
    rates: [
      { coins: 400, value: '₹350' },
      { coins: 800, value: '₹750' },
      { coins: 2000, value: '₹2,000' }
    ],
    fieldLabel: 'UPI ID / VPA',
    placeholder: 'user@okhdfcbank'
  },
  {
    id: 'amazon',
    name: 'Amazon Gift Card',
    icon: '📦',
    color: '#ff9900',
    rates: [
      { coins: 500, value: '$5.00 e-Code' },
      { coins: 1000, value: '$10.00 e-Code' },
      { coins: 2000, value: '$20.00 e-Code' }
    ],
    fieldLabel: 'Delivery Email Address',
    placeholder: 'shopper@amazon.com'
  },
  {
    id: 'steam',
    name: 'Steam Wallet Card',
    icon: '🎮',
    color: '#1b2838',
    rates: [
      { coins: 500, value: '$5.00 Steam Code' },
      { coins: 1000, value: '$10.00 Steam Code' }
    ],
    fieldLabel: 'Steam Account Name / Email',
    placeholder: 'gamer_pro'
  },
  {
    id: 'googleplay',
    name: 'Google Play Gift Card',
    icon: '▶️',
    color: '#01875f',
    rates: [
      { coins: 500, value: '$5.00 Play Balance' },
      { coins: 1000, value: '$10.00 Play Balance' }
    ],
    fieldLabel: 'Google Account Email',
    placeholder: 'user@gmail.com'
  }
];

export const AVATAR_CUSTOMIZATION = {
  outfits: [
    { id: 'casual', name: 'Casual Hoodie', color: '#3b82f6', costGems: 0, unlocked: true },
    { id: 'cyber', name: 'Cyberpunk Neon Coat', color: '#06b6d4', costGems: 10, unlocked: false },
    { id: 'tuxedo', name: 'VIP Gold Tuxedo', color: '#eab308', costGems: 25, unlocked: false },
    { id: 'crimson', name: 'Crimson Velvet Robe', color: '#ef4444', costGems: 15, unlocked: false },
    { id: 'emerald', name: 'Emerald Explorer', color: '#10b981', costGems: 12, unlocked: false }
  ],
  hats: [
    { id: 'none', name: 'No Headgear', icon: '👤', costGems: 0, unlocked: true },
    { id: 'cap', name: 'Surveyor Baseball Cap', icon: '🧢', costGems: 5, unlocked: false },
    { id: 'fedora', name: 'Detective Fedora', icon: '🎩', costGems: 12, unlocked: false },
    { id: 'crown', name: 'Data Royalty Crown', icon: '👑', costGems: 30, unlocked: false },
    { id: 'vr', name: 'Holo-VR Visor', icon: '🥽', costGems: 20, unlocked: false }
  ],
  pets: [
    { id: 'none', name: 'No Pet', icon: '', costGems: 0, unlocked: true },
    { id: 'drone', name: 'Data Scout Drone', icon: '🛸', costGems: 15, unlocked: false },
    { id: 'cat', name: 'Lucky Coin Cat', icon: '🐱', costGems: 20, unlocked: false },
    { id: 'dog', name: 'Cyber Shepherd', icon: '🐕', costGems: 20, unlocked: false }
  ]
};
