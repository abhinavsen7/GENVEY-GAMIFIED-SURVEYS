import React, { useState, useEffect, useRef } from 'react';
import GameCanvas3D from './GameCanvas3D';
import GameCanvas2D from './components/GameCanvas2D';
import AnalyticsDashboard from './AnalyticsDashboard';

const API_BASE = (typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '8000'))
  ? ''
  : 'http://localhost:8000';

const STYLE_OPTIONS = [
  {
    id: 'BALDURS_GATE_CRPG',
    title: "Baldur's Gate CRPG",
    subtitle: 'Tactical Turn-Based AP, 5-Spell Action Bar & Animated 3D D20 Skill Checks',
    badge: 'TACTICAL CRPG',
    accent: '#6366f1'
  },
  {
    id: 'DARK_SOULS_ACTION',
    title: 'Dark Souls Action',
    subtitle: 'Real-Time Stamina, Poise, 200ms Shield Parry & Riposte, Estus & Covenant Shrines',
    badge: 'SOULSLIKE ARPG',
    accent: '#ef4444'
  },
  {
    id: 'ULTIMA_IMMERSIVE_SANDBOX',
    title: 'Ultima 7 Sandbox',
    subtitle: 'Systemic Object Affordances, Grab/Move Props, Torch Stealth & Guard Barks',
    badge: 'IMMERSIVE SANDBOX',
    accent: '#10b981'
  },
  {
    id: 'CUSTOM_FREEFORM',
    title: '✨ Custom / Freeform Genre',
    subtitle: 'Survival Horror, Bullet-Heaven Horde Arena, Castle Siege, Mystery Noir, or Any User-Defined Genre',
    badge: 'NON-PREDETERMINED GENRE',
    accent: '#ec4899'
  }
];

const CUSTOM_GENRE_PRESETS = [
  {
    genre: 'PSX Survival Horror',
    title: 'Asylum of the Silent Signal',
    prompt: 'A pitch-black PSX survival horror sanitarium stalked by zombies and masked killers where a flickering flashlight reveals behavioral survey terminals.'
  },
  {
    genre: 'Bullet-Heaven Horde Survivor',
    title: 'Crimson Swarm Arena',
    prompt: 'A high-speed top-down bullet-heaven horde survival arena where waves of bats, slimes, skeletons, and dragons test rapid tactical prioritization.'
  },
  {
    genre: 'Medieval Castle Siege Warfare',
    title: 'Ironclad Bastion Siege',
    prompt: 'A large-scale medieval fortress siege with catapults, vanguard knights, and dragon minibosses testing command logistics.'
  },
  {
    genre: 'Mystery Detective Investigation',
    title: 'Shadows Over Britannia',
    prompt: 'A gothic noir detective investigation through rainy courtyards, locked crypts, and suspect interrogations.'
  }
];

function parseRoute(pathname) {
  if (!pathname || pathname === '/') return { view: 'auth', gameId: null };
  if (pathname.startsWith('/play/')) {
    const gid = pathname.replace('/play/', '').trim() || 'latest';
    return { view: 'play', gameId: gid };
  }
  if (pathname.startsWith('/company')) return { view: 'company', gameId: null };
  if (pathname.startsWith('/player')) return { view: 'player', gameId: null };
  return { view: 'auth', gameId: null };
}

export default function App() {
  // Navigation & Route State
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setRoute(parseRoute(path));
  };

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('agy_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authRole, setAuthRole] = useState('company'); // 'company' | 'player'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOrg, setAuthOrg] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Company Portal State (3 Clean Tabs)
  const [companyTab, setCompanyTab] = useState('compiler'); // 'compiler' | 'assets' | 'analytics'
  const [companyName, setCompanyName] = useState('Obsidian Insights Studio');
  const [campaignTitle, setCampaignTitle] = useState('Citadel of the Astral Ledger');
  const [targetDemographic, setTargetDemographic] = useState('Gen Z college students & competitive souls gamers');
  const [surveyIntent, setSurveyIntent] = useState('Find out if users will pay $10 for our premium tier vs $2 per month');
  const [cartridgeId, setCartridgeId] = useState('');
  const [availableCartridges, setAvailableCartridges] = useState([]);
  const [dimension, setDimension] = useState('3D'); // '3D' | '2D'
  const [styleMode, setStyleMode] = useState('DARK_SOULS_ACTION');
  const [customGenre, setCustomGenre] = useState('PSX Survival Horror');
  const [lengthMinutes, setLengthMinutes] = useState(8);
  const [themePrompt, setThemePrompt] = useState('');
  const [questions, setQuestions] = useState([]);
  const [amdStatus, setAmdStatus] = useState(null);
  const [isPingingAmd, setIsPingingAmd] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileToast, setCompileToast] = useState('');

  // Asset Registry & Incremental Scanner State
  const [assetRegistry, setAssetRegistry] = useState(null);
  const [isScanningAssets, setIsScanningAssets] = useState(false);
  const [scanToast, setScanToast] = useState('');
  const [selectedAssetCat, setSelectedAssetCat] = useState('characters_3d');

  // Game Library & Active Fullscreen Game State
  const [gamesList, setGamesList] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [stamina, setStamina] = useState(100);
  const [bossHealth, setBossHealth] = useState(140);
  const [bossPoise, setBossPoise] = useState(80);
  const [bossStaggered, setBossStaggered] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isInvincible, setIsInvincible] = useState(false);
  const [godotStatusToast, setGodotStatusToast] = useState('');

  // Analytics State (ONLY used inside Company Tab 3)
  const [telemetryEvents, setTelemetryEvents] = useState([]);

  const fullscreenContainerRef = useRef(null);
  const canvas3DRef = useRef(null);

  const fetchCustomAssets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/custom-assets`);
      if (res.ok) {
        const data = await res.json();
        setAssetRegistry(data);
      }
    } catch (e) {}
  };

  const fetchGamesLibrary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/games`);
      if (res.ok) {
        const data = await res.json();
        const list = data.games || [];
        setGamesList(list);
        if (list.length > 0 && !activeGame) {
          setActiveGame(list[0]);
          if (list[0].weapons?.length > 0) setSelectedWeapon(list[0].weapons[0]);
        }
      }
    } catch (e) {}
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        setTelemetryEvents(data.events || []);
      }
    } catch (e) {}
  };

  const fetchAmdStatus = async () => {
    setIsPingingAmd(true);
    try {
      const res = await fetch(`${API_BASE}/api/amd/status`);
      if (res.ok) {
        const data = await res.json();
        setAmdStatus(data);
      } else {
        setAmdStatus({ connected: false, error: `HTTP ${res.status}` });
      }
    } catch (e) {
      setAmdStatus({ connected: false, error: e.message });
    } finally {
      setIsPingingAmd(false);
    }
  };

  useEffect(() => {
    fetchCustomAssets();
    fetchGamesLibrary();
    fetchAnalytics();
    fetchAmdStatus();
    const interval = setInterval(fetchAmdStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Load specific game when entering /play/:gameId
  useEffect(() => {
    if (route.view === 'play' && route.gameId) {
      const loadTargetGame = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/games/${route.gameId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.rooms) {
              setActiveGame(data);
              if (data.weapons?.length > 0) setSelectedWeapon(data.weapons[0]);
            }
          }
        } catch (e) {}
      };
      loadTargetGame();
    }
  }, [route.view, route.gameId]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = authMode === 'register'
        ? { name: authName, email: authEmail, password: authPassword, role: authRole, organization: authOrg }
        : { email: authEmail, password: authPassword };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Authentication failed.');
        setAuthLoading(false);
        return;
      }
      localStorage.setItem('agy_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      if (data.user.organization) setCompanyName(data.user.organization);
      navigate(data.user.role === 'company' ? '/company' : '/player');
    } catch (err) {
      setAuthError('Unable to reach authentication server on :8000.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickRoleEnter = (role) => {
    const demoUser = {
      user_id: `demo_${role}`,
      name: role === 'company' ? 'Studio Architect' : 'Vanguard Player',
      email: role === 'company' ? 'architect@studio.ai' : 'player@guild.gg',
      role,
      organization: 'Obsidian Insights Studio'
    };
    localStorage.setItem('agy_user', JSON.stringify(demoUser));
    setCurrentUser(demoUser);
    navigate(role === 'company' ? '/company' : '/player');
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/cartridges`)
      .then((r) => (r.ok ? r.json() : { cartridges: [] }))
      .then((d) => setAvailableCartridges(d.cartridges || []))
      .catch(() => {});
  }, []);

  const handleCompileCampaign = async () => {
    setIsCompiling(true);
    setCompileToast('⚙ Contacting AMD Gemma 4 & Synthesizing Game World...');
    try {
      const sanitizedQuestions = (questions || [])
        .filter(q => q && q.question_text && q.question_text.trim())
        .map((q, idx) => ({
          id: q.id || `q_${idx + 1}`,
          question_text: q.question_text.trim(),
          target_metric: q.target_metric || 'decision_preference',
          options: (q.options || []).filter(opt => opt && typeof opt === 'string' && opt.trim()).map(opt => opt.trim())
        }));

      const payload = {
        company_name: companyName?.trim() || 'Obsidian Insights Studio',
        campaign_title: campaignTitle?.trim() || 'Citadel of the Astral Ledger',
        dimension: dimension || '3D',
        style_mode: styleMode || 'DARK_SOULS_ACTION',
        custom_genre: styleMode === 'CUSTOM_FREEFORM' ? (customGenre?.trim() || 'PSX Survival Horror') : null,
        target_demographic: targetDemographic?.trim() || 'Gen Z college students & competitive gamers',
        survey_intent: surveyIntent?.trim() || 'Find out if users will pay $10 for premium tier vs $2 per month',
        cartridge_id: cartridgeId || null,
        genre_mode:
          styleMode === 'BALDURS_GATE_CRPG'
            ? 'CRPG_ISOMETRIC'
            : styleMode === 'DARK_SOULS_ACTION'
            ? 'SOULSLIKE_ACTION'
            : styleMode === 'ULTIMA_IMMERSIVE_SANDBOX'
            ? 'IMMERSIVE_SIM'
            : 'CUSTOM_FREEFORM',
        length_minutes: Number(lengthMinutes) || 8,
        theme_prompt: themePrompt?.trim() || '',
        questions: sanitizedQuestions
      };

      const res = await fetch(`${API_BASE}/api/compile-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const compiled = await res.json();
        setActiveGame(compiled);
        if (compiled.weapons?.length > 0) setSelectedWeapon(compiled.weapons[0]);
        await fetchGamesLibrary();
        setCompileToast(`🚀 Successfully compiled '${compiled.campaign_title || 'Game'}'! Launching viewport...`);
        // Immediately navigate into fullscreen play mode so user can play the generated game!
        setTimeout(() => {
          navigate(`/play/${compiled.build_id || 'latest'}`);
          setCompileToast('');
        }, 600);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.detail || errJson.message || `HTTP ${res.status}: Failed to compile campaign`;
        setCompileToast(`⚠ Compilation Failed: ${errMsg}`);
        setTimeout(() => setCompileToast(''), 6000);
      }
    } catch (e) {
      console.error('Compile error:', e);
      setCompileToast(`⚠ Network Error: ${e.message || 'Failed to reach compiler backend'}`);
      setTimeout(() => setCompileToast(''), 6000);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleScanAssets = async () => {
    setIsScanningAssets(true);
    setScanToast('Scanning ~/Downloads & custom_asset_packs/ via Headless Blender...');
    try {
      const res = await fetch(`${API_BASE}/api/assets/scan`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAssetRegistry(data.registry);
        const s = data.summary || {};
        setScanToast(
          `Synced! ${s.characters_3d || 0} Heroes, ${s.enemies_3d || 0} Enemies, ${s.weapons_3d || 0} Weapons, ${s.environments_3d || 0} 3D Props, ${s.sprites_and_tiles_2d || 0} 2D Sprites/Tiles.`
        );
      }
    } catch (e) {
      setScanToast('Asset scan error.');
    } finally {
      setIsScanningAssets(false);
      setTimeout(() => setScanToast(''), 5000);
    }
  };

  const handleLaunchNativeGodot = async (gameId = null) => {
    setGodotStatusToast('Launching Native Godot 4 Desktop Window...');
    try {
      const res = await fetch(`${API_BASE}/api/godot/launch-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId || activeGame?.build_id || 'latest' })
      });
      const data = await res.json();
      if (res.ok && data.status === 'launched') {
        setGodotStatusToast(`🚀 Native Godot 4 Window Launched (PID ${data.pid})!`);
      } else {
        setGodotStatusToast(data.message || 'Scene compiled to godot_kernel/scenes/CompiledGame.tscn');
      }
    } catch (e) {
      setGodotStatusToast('Failed to reach Godot launcher endpoint.');
    } finally {
      setTimeout(() => setGodotStatusToast(''), 4000);
    }
  };

  const handleToggleBrowserFullscreen = () => {
    const el = fullscreenContainerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  const sendTelemetry = async (interactionType, questionId, selectedOption, metricDelta = 1.0) => {
    const payload = {
      player_id: currentUser?.email || 'player_vanguard',
      game_id: activeGame?.build_id || 'latest',
      question_id: questionId || 'q1',
      interaction_type: interactionType,
      selected_option: selectedOption,
      metric_delta: Number(metricDelta) || 1.0,
      weapon_equipped: selectedWeapon?.name || 'Relic Greatsword'
    };
    try {
      await fetch(`${API_BASE}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchAnalytics();
    } catch (e) {}
  };

  // ============================================================================
  // VIEW 4: /play/:gameId — 100% FULLSCREEN GAME VIEWPORT (ZERO LOGS, ZERO CLUTTER)
  // ============================================================================
  if (route.view === 'play') {
    const is2DGame = activeGame?.dimension === '2D';
    const mappedGenreMode =
      activeGame?.style_mode === 'BALDURS_GATE_CRPG'
        ? 'CRPG_ISOMETRIC'
        : activeGame?.style_mode === 'DARK_SOULS_ACTION'
        ? 'SOULSLIKE_ACTION'
        : activeGame?.style_mode === 'ULTIMA_IMMERSIVE_SANDBOX'
        ? 'IMMERSIVE_SIM'
        : activeGame?.genre_mode || 'SOULSLIKE_ACTION';

    return (
      <div
        ref={fullscreenContainerRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: '#05070d',
          zIndex: 999
        }}
      >
        {/* Top-Right Corner: ONLY 3 Minimal Action Buttons */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 50
          }}
        >
          <button
            onClick={handleToggleBrowserFullscreen}
            title="Toggle Native Browser Fullscreen (100vw x 100vh)"
            style={{
              background: 'rgba(15, 23, 42, 0.90)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #38bdf866',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ⛶ Fullscreen
          </button>

          <button
            onClick={() => handleLaunchNativeGodot(activeGame?.build_id)}
            title="Spawn Native Godot 4 Engine Desktop Window with this Campaign"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              border: '1px solid #818cf8',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(99, 102, 241, 0.45)'
            }}
          >
            🚀 Launch in Native Godot 4 Window
          </button>

          <button
            onClick={() => navigate(currentUser?.role === 'company' ? '/company' : '/player')}
            title="Exit to Game Library"
            style={{
              background: 'rgba(15, 23, 42, 0.90)',
              border: '1px solid #ef444466',
              color: '#fca5a5',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕ Exit to Library
          </button>
        </div>

        {godotStatusToast && (
          <div
            style={{
              position: 'absolute',
              top: '56px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid #818cf8',
              color: '#e0e7ff',
              padding: '8px 18px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 800,
              zIndex: 60
            }}
          >
            {godotStatusToast}
          </div>
        )}

        {is2DGame ? (
          <GameCanvas2D
            compiledGame={activeGame}
            selectedWeapon={selectedWeapon}
            onSelectWeapon={setSelectedWeapon}
            sendTelemetry={sendTelemetry}
          />
        ) : (
          <GameCanvas3D
            ref={canvas3DRef}
            gameMode={mappedGenreMode}
            selectedWeapon={selectedWeapon}
            compiledGame={activeGame}
            onCompileNow={handleCompileCampaign}
            isCompiling={isCompiling}
            stamina={stamina}
            setStamina={setStamina}
            bossHealth={bossHealth}
            setBossHealth={setBossHealth}
            bossPoise={bossPoise}
            setBossPoise={setBossPoise}
            bossStaggered={bossStaggered}
            setBossStaggered={setBossStaggered}
            sendTelemetry={sendTelemetry}
            setCombatLog={() => {}}
            isAttacking={isAttacking}
            setIsAttacking={setIsAttacking}
            isInvincible={isInvincible}
            setIsInvincible={setIsInvincible}
            videoAnalysis={null}
            onSelectWeapon={setSelectedWeapon}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // SHARED MINIMAL HEADER FOR PORTAL VIEWS (/auth, /company, /player)
  // ============================================================================
  return (
    <div style={{ minHeight: '100vh', background: '#070a12', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header
        style={{
          height: '62px',
          padding: '0 28px',
          borderBottom: '1px solid #1e293b',
          background: 'rgba(11, 15, 25, 0.92)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => navigate('/auth')}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            A4
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.01em' }}>
              AMD Gemma 4 + Godot 4 Game Studio
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Multi-Role Gamified Survey Compiler • 2D &amp; 3D Custom Asset Packs
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Live AMD Token Factory Indicator */}
          <div
            onClick={fetchAmdStatus}
            title={
              amdStatus?.connected
                ? `AMD Token Factory Connected\nModel: ${amdStatus?.model || 'Gemma-4-31B-IT'}\nLatency: ${amdStatus?.latency_ms || 890}ms\nZero Local VRAM\nClick to ping`
                : `AMD Token Factory Disconnected\n${amdStatus?.error || 'Checking...'}\nClick to re-ping`
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: amdStatus?.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: amdStatus?.connected ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              color: amdStatus?.connected ? '#34d399' : '#f87171',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: amdStatus?.connected ? '#10b981' : '#ef4444',
                boxShadow: amdStatus?.connected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
                display: 'inline-block'
              }}
            />
            <span>
              {isPingingAmd
                ? 'Pinging AMD...'
                : amdStatus?.connected
                ? `AMD Token Factory: ONLINE (${amdStatus.model || 'Gemma 4'} | ${amdStatus.latency_ms || 890}ms)`
                : 'AMD Token Factory: Offline'}
            </span>
          </div>

          <button
            onClick={() => navigate('/company')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: route.view === 'company' ? '1px solid #6366f1' : '1px solid #1e293b',
              background: route.view === 'company' ? 'rgba(99, 102, 241, 0.18)' : '#0f172a',
              color: route.view === 'company' ? '#a5b4fc' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🏢 Company Studio
          </button>

          <button
            onClick={() => navigate('/player')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: route.view === 'player' ? '1px solid #10b981' : '1px solid #1e293b',
              background: route.view === 'player' ? 'rgba(16, 185, 129, 0.18)' : '#0f172a',
              color: route.view === 'player' ? '#6ee7b7' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🎮 Player Library ({gamesList.length})
          </button>

          {activeGame && (
            <button
              onClick={() => navigate(`/play/${activeGame.build_id || 'latest'}`)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ▶ Play Fullscreen
            </button>
          )}

          <button
            onClick={() => navigate('/auth')}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#cbd5e1',
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            {currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sign In'}
          </button>
        </nav>
      </header>

      {/* ============================================================================
          VIEW 1: /auth — CLEAN ACCOUNT CREATION & LOGIN
         ============================================================================ */}
      {route.view === 'auth' && (
        <div
          style={{
            minHeight: 'calc(100vh - 62px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.65)'
            }}
          >
            {/* Toggle Sign In / Create Account */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#090d16',
                padding: '4px',
                borderRadius: '10px',
                marginBottom: '24px',
                border: '1px solid #1e293b'
              }}
            >
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  background: authMode === 'login' ? '#1e293b' : 'transparent',
                  color: authMode === 'login' ? '#f8fafc' : '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  background: authMode === 'register' ? '#1e293b' : 'transparent',
                  color: authMode === 'register' ? '#f8fafc' : '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Create Account
              </button>
            </div>

            <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 800 }}>
              {authMode === 'register' ? 'Create Your Portal Account' : 'Welcome Back'}
            </h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8' }}>
              {authMode === 'register'
                ? 'Choose a Company Account to compile surveys into games, or a Player Account to play in Fullscreen.'
                : 'Sign in to access the Company Studio or Player Game Library.'}
            </p>

            {/* Account Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div
                onClick={() => setAuthRole('company')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: authRole === 'company' ? '2px solid #6366f1' : '1px solid #334155',
                  background: authRole === 'company' ? 'rgba(99, 102, 241, 0.14)' : '#090d16',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                  🏢 Company Account
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Create gamified surveys, manage 2D/3D packs, compile games with Gemma 4 &amp; inspect analytics.
                </div>
              </div>

              <div
                onClick={() => setAuthRole('player')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: authRole === 'player' ? '2px solid #10b981' : '1px solid #334155',
                  background: authRole === 'player' ? 'rgba(16, 185, 129, 0.14)' : '#090d16',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                  🎮 Player Account
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Browse published games, play in 100% Fullscreen or Godot 4, earn relics &amp; track progression.
                </div>
              </div>
            </div>

            {authError && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  marginBottom: '16px'
                }}
              >
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {authMode === 'register' && (
                <>
                  <input
                    type="text"
                    placeholder={authRole === 'company' ? 'Your Name / Lead Architect' : 'Player Handle'}
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#090d16',
                      color: '#f8fafc',
                      fontSize: '13px'
                    }}
                  />
                  {authRole === 'company' && (
                    <input
                      type="text"
                      placeholder="Company / Studio Name"
                      value={authOrg}
                      onChange={(e) => setAuthOrg(e.target.value)}
                      style={{
                        padding: '11px 14px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px'
                      }}
                    />
                  )}
                </>
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#090d16',
                  color: '#f8fafc',
                  fontSize: '13px'
                }}
              />

              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#090d16',
                  color: '#f8fafc',
                  fontSize: '13px'
                }}
              />

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  marginTop: '4px',
                  padding: '12px',
                  borderRadius: '9px',
                  border: 'none',
                  background: authRole === 'company' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {authLoading
                  ? 'Authenticating...'
                  : authMode === 'register'
                  ? `Create ${authRole === 'company' ? 'Company' : 'Player'} Account`
                  : 'Sign In'}
              </button>
            </form>

            {/* Instant One-Click Portal Shortcuts */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleQuickRoleEnter('company')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⚡ Enter Company Studio
              </button>
              <button
                type="button"
                onClick={() => handleQuickRoleEnter('player')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🎮 Enter Player Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          VIEW 2: /company — SLEEK COMPANY STUDIO (3 CLEAN TABS, ZERO CLUTTER)
         ============================================================================ */}
      {route.view === 'company' && (
        <div style={{ maxWidth: '1220px', margin: '0 auto', padding: '28px' }}>
          {/* 3 Clean Studio Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { id: 'compiler', label: '1. Campaign & Game Compiler' },
                { id: 'assets', label: '2. Asset Pack Manager (custom_asset_packs/)' },
                { id: 'analytics', label: `3. Behavioral Analytics Dashboard (${telemetryEvents.length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCompanyTab(t.id)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: companyTab === t.id ? '1px solid #6366f1' : '1px solid #1e293b',
                    background: companyTab === t.id ? 'rgba(99, 102, 241, 0.18)' : '#0f172a',
                    color: companyTab === t.id ? '#f8fafc' : '#94a3b8',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeGame && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigate(`/play/${activeGame.build_id}`)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '9px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  ⛶ Launch Fullscreen Game
                </button>
                <button
                  onClick={() => handleLaunchNativeGodot(activeGame.build_id)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '9px',
                    border: '1px solid #818cf8',
                    background: '#1e1b4b',
                    color: '#e0e7ff',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  🚀 Open in Native Godot 4
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: CAMPAIGN & GAME COMPILER WIZARD */}
          {companyTab === 'compiler' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '24px' }}>
              <div
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                      CAMPAIGN TITLE
                    </label>
                    <input
                      type="text"
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                      COMPANY / STUDIO NAME
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                {/* Natural Language Demographic & Survey Intent */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#38bdf8', marginBottom: '6px' }}>
                      🎯 TARGET DEMOGRAPHIC (NATURAL LANGUAGE &amp; CHROMA RAG)
                    </label>
                    <input
                      type="text"
                      value={targetDemographic}
                      onChange={(e) => setTargetDemographic(e.target.value)}
                      placeholder="e.g. Gen Z college students &amp; competitive souls gamers"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #0284c7',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px'
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {[
                        'Gen Z competitive souls gamers',
                        'Millennial tactical CRPG fans',
                        'Retro immersive sandbox explorers',
                        'PSX survival horror fans'
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setTargetDemographic(chip)}
                          style={{
                            background: '#0c1322',
                            border: '1px solid #1e293b',
                            color: '#94a3b8',
                            borderRadius: '4px',
                            padding: '3px 7px',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#34d399', marginBottom: '6px' }}>
                      💡 SURVEY INTENT (NATURAL LANGUAGE DECONSTRUCTION)
                    </label>
                    <input
                      type="text"
                      value={surveyIntent}
                      onChange={(e) => setSurveyIntent(e.target.value)}
                      placeholder="e.g. Find out if users will pay $10 for our premium tier vs $2 per month"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #059669',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px'
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {[
                        'Find out if users will pay $10 for premium tier vs $2 starter tier',
                        'Gauge preference: Accelerated performance vs Deep customization',
                        'Evaluate crisis risk tolerance and leadership decisiveness'
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSurveyIntent(chip)}
                          style={{
                            background: '#061a14',
                            border: '1px solid #1e293b',
                            color: '#94a3b8',
                            borderRadius: '4px',
                            padding: '3px 7px',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Teammate Game Cartridge Registry Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>
                    🕹️ TEAMMATE GAME CARTRIDGE (FEW-SHOT BASE GAME ENGINE)
                  </label>
                  <select
                    value={cartridgeId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setCartridgeId(cid);
                      if (cid === 'dark_souls_cathedral_gauntlet') {
                        setStyleMode('DARK_SOULS_ACTION');
                        setDimension('3D');
                      } else if (cid === 'baldurs_gate_tactical_keep') {
                        setStyleMode('BALDURS_GATE_CRPG');
                        setDimension('3D');
                      } else if (cid === 'ultima_2d_living_town') {
                        setStyleMode('ULTIMA_IMMERSIVE_SANDBOX');
                        setDimension('2D');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d97706',
                      background: '#090d16',
                      color: '#f8fafc',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">None (Pure Gemma 4 Neuro-Symbolic Compilation)</option>
                    {availableCartridges.map((c) => (
                      <option key={c.cartridge_id} value={c.cartridge_id}>
                        {c.title} — {c.author} ({c.dimension})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dimension Selector: 3D Game vs 2D Game */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    DIMENSION ENGINE (917 INDEXED 3D &amp; 2D ASSETS)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { id: '3D', title: '🧊 3D Game (WebGL + Godot 4 3D)', desc: 'Uses 47 Rigged 3D Heroes, 25 Monsters, 473 Castle/Crypt/Britannia Props & 73 Weapons' },
                      { id: '2D', title: '🗺 2D Game (Isometric & Top-Down Sprites)', desc: 'Uses 178 Sprites/Tiles (0x72 Dungeon II, Tiny Swords, FLARE & Lords of Pain)' }
                    ].map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setDimension(d.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: dimension === d.id ? '2px solid #38bdf8' : '1px solid #334155',
                          background: dimension === d.id ? 'rgba(56, 189, 248, 0.12)' : '#090d16',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>{d.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{d.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gameplay Style Selector (3 Predetermined Classics + 4th Non-Predetermined Custom Genre) */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    GAMEPLAY ARCHITECTURE &amp; MECHANICS (PREDETERMINED OR CUSTOM FREEFORM GENRE)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {STYLE_OPTIONS.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => setStyleMode(st.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: styleMode === st.id ? `2px solid ${st.accent}` : '1px solid #334155',
                          background: styleMode === st.id ? `${st.accent}1f` : '#090d16',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 800, color: st.accent, marginBottom: '3px' }}>
                          {st.badge}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.35 }}>
                          {st.subtitle}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom / Non-Predetermined Genre Configuration Box */}
                {styleMode === 'CUSTOM_FREEFORM' && (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid #ec489966',
                      background: 'rgba(236, 72, 153, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#f472b6' }}>
                      ✨ CUSTOM / NON-PREDETERMINED GENRE SPECIFICATION
                    </label>
                    <input
                      type="text"
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="Type any genre (e.g., PSX Survival Horror, Bullet-Heaven Horde Survivor, Castle Siege Warfare, Mystery Noir...)"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #ec4899',
                        background: '#090d16',
                        color: '#f8fafc',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {CUSTOM_GENRE_PRESETS.map((preset) => (
                        <button
                          key={preset.genre}
                          type="button"
                          onClick={() => {
                            setCustomGenre(preset.genre);
                            setCampaignTitle(preset.title);
                            setThemePrompt(preset.prompt);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '999px',
                            border: customGenre === preset.genre ? '1px solid #ec4899' : '1px solid #334155',
                            background: customGenre === preset.genre ? 'rgba(236, 72, 153, 0.25)' : '#0f172a',
                            color: customGenre === preset.genre ? '#fbcfe8' : '#cbd5e1',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ⚡ {preset.genre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* World Theme Prompt */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                    WORLD &amp; AESTHETIC PROMPT
                  </label>
                  <textarea
                    rows={3}
                    value={themePrompt}
                    onChange={(e) => setThemePrompt(e.target.value)}
                    placeholder="Optional aesthetic guidance (e.g. Neon Cyberpunk, 16-bit Cozy Village, Abandoned Station, Ancient Temple)..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#090d16',
                      color: '#f8fafc',
                      fontSize: '13px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Campaign Playtime Length Selector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
                      ⏱️ ESTIMATED PLAYTIME LENGTH ({lengthMinutes} MINUTES • {lengthMinutes <= 6 ? '4 Zones' : lengthMinutes <= 12 ? '6 Zones' : '8 Zones'})
                    </label>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      Determines total connected dungeon zones &amp; encounters
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[
                      { minutes: 4, label: '⚡ Rapid (4 min)', zones: '4 Zones' },
                      { minutes: 8, label: '⚔️ Standard (8 min)', zones: '6 Zones' },
                      { minutes: 12, label: '🏰 Deep Dive (12 min)', zones: '6 Zones' },
                      { minutes: 16, label: '👑 Epic Gauntlet (16 min)', zones: '8 Zones' }
                    ].map((opt) => (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => setLengthMinutes(opt.minutes)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: '8px',
                          border: lengthMinutes === opt.minutes ? '2px solid #38bdf8' : '1px solid #334155',
                          background: lengthMinutes === opt.minutes ? 'rgba(56, 189, 248, 0.18)' : '#090d16',
                          color: lengthMinutes === opt.minutes ? '#38bdf8' : '#cbd5e1',
                          fontWeight: 800,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ fontSize: '9.5px', fontWeight: 600, color: lengthMinutes === opt.minutes ? '#7dd3fc' : '#64748b' }}>
                          {opt.zones}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCompileCampaign}
                  disabled={isCompiling}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background:
                      styleMode === 'CUSTOM_FREEFORM'
                        ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: isCompiling ? 'wait' : 'pointer',
                    boxShadow: '0 12px 30px rgba(99, 102, 241, 0.35)'
                  }}
                >
                  {isCompiling
                    ? `⚙ Compiling ${dimension} ${styleMode === 'CUSTOM_FREEFORM' ? customGenre : styleMode} Campaign via AMD Gemma 4...`
                    : `⚡ Compile ${dimension} ${styleMode === 'CUSTOM_FREEFORM' ? customGenre : ''} Game with Gemma 4 + Godot 4`}
                </button>

                {compileToast && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: compileToast.includes('⚠') ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                      border: compileToast.includes('⚠') ? '1px solid #ef4444' : '1px solid #10b981',
                      color: compileToast.includes('⚠') ? '#fca5a5' : '#6ee7b7',
                      fontSize: '12px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: compileToast.includes('⚠') ? '0 0 15px rgba(239, 68, 68, 0.2)' : '0 0 15px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <span>{compileToast}</span>
                    <button
                      type="button"
                      onClick={() => setCompileToast('')}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* AMD Token Factory Real-Time Connection Card */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.90)',
                    border: amdStatus?.connected ? '1px solid #10b98166' : '1px solid #ef444466',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: amdStatus?.connected ? '#10b981' : '#ef4444',
                          boxShadow: amdStatus?.connected ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                        }}
                      />
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: amdStatus?.connected ? '#34d399' : '#f87171' }}>
                        AMD TOKEN FACTORY: {amdStatus?.connected ? 'ESTABLISHED & VERIFIED' : 'NOT CONNECTED'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchAmdStatus}
                      disabled={isPingingAmd}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#94a3b8',
                        borderRadius: '5px',
                        padding: '3px 8px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isPingingAmd ? 'Pinging...' : '↻ Test Health'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                    <div style={{ background: '#090d16', padding: '6px 8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Active Model</div>
                      <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {amdStatus?.model || 'Gemma-4-31B-IT'}
                      </div>
                    </div>
                    <div style={{ background: '#090d16', padding: '6px 8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Latency</div>
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
                        {amdStatus?.latency_ms ? `${amdStatus.latency_ms} ms` : 'Checking...'}
                      </div>
                    </div>
                    <div style={{ background: '#090d16', padding: '6px 8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: '9.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Local VRAM</div>
                      <div style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: 700 }}>
                        0 MB (Cloud Instinct)
                      </div>
                    </div>
                  </div>
                </div>

                {activeGame && (activeGame.cohort_analysis || activeGame.trend_analysis) && (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #38bdf844',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>
                        🧠 AI DEMOGRAPHIC &amp; TREND RAG ANALYSIS
                      </span>
                      <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 700 }}>
                        Active Build: {activeGame.build_id?.slice(0, 8)}
                      </span>
                    </div>

                    {activeGame.cohort_analysis && (
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
                        <strong style={{ color: '#fbbf24' }}>Cohort Winner:</strong>{' '}
                        {activeGame.cohort_analysis.winning_genre} ({activeGame.cohort_analysis.cohort_age_range} yrs) — {activeGame.cohort_analysis.recommendation_rationale}
                      </div>
                    )}

                    {activeGame.trend_analysis && (
                      <div style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
                        <strong style={{ color: '#f472b6' }}>Social Gaming Trend:</strong>{' '}
                        {activeGame.trend_analysis.trend_summary}
                      </div>
                    )}

                    {activeGame.survey_intent && (
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        <strong style={{ color: '#34d399' }}>Survey Intent Deconstructed:</strong>{' '}
                        "{activeGame.survey_intent}" &rarr; Dual Forge Anvils ($10 vs $2) &amp; D20 Dialogue
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Survey Questions Builder */}
              <div
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '14px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800 }}>Survey Questions ({questions.length})</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                      Deconstructed into D20 Dialogue, Covenant Shrines &amp; Forge Dilemmas
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        {
                          id: `q_${Date.now()}`,
                          question_text: '',
                          target_metric: 'decision_preference',
                          options: ['', '', '']
                        }
                      ])
                    }
                    style={{
                      padding: '6px 12px',
                      borderRadius: '7px',
                      border: '1px solid #38bdf8',
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add Question
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '470px', overflowY: 'auto' }}>
                  {questions.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 20px',
                        background: '#090d16',
                        border: '1px dashed #334155',
                        borderRadius: '10px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                        No Manual Questions Configured
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 14px' }}>
                        Gemma 4 will autonomously decompose your <b>Target Demographic</b> &amp; <b>Survey Intent</b> into relevant in-game economic choices, NPC dialogue dilemmas, and shrine tests without generic filler.
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions([
                            {
                              id: `q_${Date.now()}`,
                              question_text: '',
                              target_metric: 'decision_preference',
                              options: ['', '', '']
                            }
                          ])
                        }
                        style={{
                          background: 'rgba(56, 189, 248, 0.14)',
                          border: '1px solid #38bdf8',
                          color: '#38bdf8',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Add Custom Question
                      </button>
                    </div>
                  ) : (
                    questions.map((q, qIdx) => (
                      <div
                        key={q.id}
                        style={{
                          background: '#090d16',
                          border: '1px solid #1e293b',
                          borderRadius: '10px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8' }}>
                            QUESTION {qIdx + 1} • METRIC: {q.target_metric.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={q.question_text}
                          placeholder="Enter survey question (or leave empty to let Gemma 4 generate from Survey Intent)..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) => prev.map((item, i) => (i === qIdx ? { ...item, question_text: val } : item)));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #334155',
                            background: '#0f172a',
                            color: '#f8fafc',
                            fontSize: '12px',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {q.options.map((opt, oIdx) => (
                            <input
                              key={oIdx}
                              type="text"
                              value={opt}
                              placeholder={`Option ${oIdx + 1}...`}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx
                                      ? { ...item, options: item.options.map((o, oi) => (oi === oIdx ? val : o)) }
                                      : item
                                  )
                                );
                              }}
                              style={{
                                padding: '6px 9px',
                                borderRadius: '5px',
                                border: '1px solid #1e293b',
                                background: '#111827',
                                color: '#cbd5e1',
                                fontSize: '11.5px'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ASSET PACK MANAGER (custom_asset_packs/) */}
          {companyTab === 'assets' && (
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                padding: '24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800 }}>
                    Unified 2D &amp; 3D Asset Pack Registry (<code>custom_asset_packs/</code>)
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                    Incremental scanner preserves all previously ingested packs and merges newly downloaded 3D &amp; 2D packs.
                  </div>
                </div>
                <button
                  onClick={handleScanAssets}
                  disabled={isScanningAssets}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '9px',
                    border: '1px solid #38bdf8',
                    background: 'linear-gradient(135deg, #0284c7, #4f46e5)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: isScanningAssets ? 'wait' : 'pointer'
                  }}
                >
                  {isScanningAssets ? '⚙ Scanning ~/Downloads...' : '🔄 Scan ~/Downloads for New Asset Packs'}
                </button>
              </div>

              {scanToast && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(16, 185, 129, 0.16)',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    color: '#6ee7b7',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    marginBottom: '18px'
                  }}
                >
                  {scanToast}
                </div>
              )}

              {/* Category Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '22px' }}>
                {[
                  { key: 'characters_3d', label: '3D Heroes', icon: '🛡', color: '#38bdf8' },
                  { key: 'enemies_3d', label: '3D Enemies', icon: '💀', color: '#ef4444' },
                  { key: 'weapons_3d', label: '3D Weapons', icon: '⚔️', color: '#f59e0b' },
                  { key: 'environments_3d', label: '3D Dungeon', icon: '🏰', color: '#10b981' },
                  { key: 'animations_3d', label: '3D Anim Packs', icon: '🏃', color: '#a855f7' },
                  { key: 'effects_3d_2d', label: 'VFX & Shaders', icon: '✨', color: '#ec4899' },
                  { key: 'sprites_and_tiles_2d', label: '2D Sprites/Tiles', icon: '🗺', color: '#34d399' }
                ].map((cat) => {
                  const list = assetRegistry?.[cat.key] || [];
                  const active = selectedAssetCat === cat.key;
                  return (
                    <div
                      key={cat.key}
                      onClick={() => setSelectedAssetCat(cat.key)}
                      style={{
                        padding: '14px 12px',
                        borderRadius: '10px',
                        border: active ? `2px solid ${cat.color}` : '1px solid #1e293b',
                        background: active ? `${cat.color}18` : '#090d16',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{cat.icon}</div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc' }}>{list.length}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: cat.color }}>{cat.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Asset Items Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '10px',
                  maxHeight: '420px',
                  overflowY: 'auto'
                }}
              >
                {(assetRegistry?.[selectedAssetCat] || []).slice(0, 60).map((item, idx) => (
                  <div
                    key={`${item.id}_${idx}`}
                    style={{
                      padding: '12px',
                      borderRadius: '9px',
                      background: '#090d16',
                      border: '1px solid #1e293b'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc' }}>{item.id}</span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          background: item.dimension === '2D' ? '#064e3b' : '#1e1b4b',
                          color: item.dimension === '2D' ? '#34d399' : '#a5b4fc'
                        }}
                      >
                        {item.dimension || '3D'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px' }}>{item.pack}</div>
                    {item.right_hand_bone && (
                      <div style={{ fontSize: '10px', color: '#38bdf8' }}>
                        🦴 Bone: <code>{item.right_hand_bone}</code> ({item.bones_count} bones)
                      </div>
                    )}
                    {item.animations?.length > 0 && (
                      <div style={{ fontSize: '10px', color: '#a855f7' }}>
                        🎬 {item.animations.length} Skeletal Clips
                      </div>
                    )}
                    {item.frame_count && (
                      <div style={{ fontSize: '10px', color: '#34d399' }}>
                        🖼 {item.width}x{item.height}px ({item.frame_count} frames)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BEHAVIORAL ANALYTICS DASHBOARD (100% INSIDE THIS TAB ONLY) */}
          {companyTab === 'analytics' && (
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                padding: '24px'
              }}
            >
              <AnalyticsDashboard telemetryEvents={telemetryEvents} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
          VIEW 3: /player — PLAYER GAME LIBRARY STOREFRONT
         ============================================================================ */}
      {route.view === 'player' && (
        <div style={{ maxWidth: '1220px', margin: '0 auto', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 900 }}>
                🎮 Player Game Library
              </h2>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Select any compiled 3D or 2D campaign below to play in 100% Fullscreen or launch directly in Godot 4.
              </div>
            </div>
            <button
              onClick={() => navigate('/company')}
              style={{
                padding: '10px 18px',
                borderRadius: '9px',
                border: '1px solid #6366f1',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              + Compile New Campaign
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
            {gamesList.map((g) => {
              const firstRoom = g.rooms?.[0] || {};
              const torchHex = firstRoom.lighting?.torch_color_hex || '#6366f1';
              const isCustomGenre = Boolean(g.is_custom_genre);
              const styleLabel = isCustomGenre
                ? `✨ ${g.custom_genre || 'CUSTOM GENRE'}`
                : g.style_mode ||
                  (g.genre_mode === 'CRPG_ISOMETRIC'
                    ? 'BALDURS_GATE_CRPG'
                    : g.genre_mode === 'SOULSLIKE_ACTION'
                    ? 'DARK_SOULS_ACTION'
                    : 'ULTIMA_IMMERSIVE_SANDBOX');
              const dimLabel = g.dimension || '3D';

              return (
                <div
                  key={g.build_id}
                  style={{
                    background: '#0f172a',
                    border: isCustomGenre ? '1px solid #ec489966' : '1px solid #1e293b',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
                  }}
                >
                  <div>
                    <div
                      style={{
                        height: '8px',
                        background: isCustomGenre
                          ? 'linear-gradient(90deg, #ec4899, #8b5cf6)'
                          : `linear-gradient(90deg, ${torchHex}, #6366f1)`
                      }}
                    />
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: dimLabel === '2D' ? '#064e3b' : '#1e1b4b',
                            color: dimLabel === '2D' ? '#34d399' : '#818cf8'
                          }}
                        >
                          {dimLabel} ENGINE
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: isCustomGenre ? 'rgba(236, 72, 153, 0.22)' : '#1e293b',
                            color: isCustomGenre ? '#fbcfe8' : '#f8fafc',
                            border: isCustomGenre ? '1px solid #ec489988' : 'none'
                          }}
                        >
                          {styleLabel}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                        {g.campaign_title || 'Compiled Campaign'}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, marginBottom: '10px' }}>
                        By {g.company_name || 'Studio'} • Hero: {g.player_class || 'Knight'}
                      </div>
                      <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
                        {(g.theme_prompt || '').slice(0, 120)}
                      </p>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#cbd5e1' }}>
                        <span>🏰 {g.rooms?.length || 4} Chambers</span>
                        <span>⚔️ {g.weapons?.length || 3} Relics</span>
                        <span>📋 {g.survey_encounters?.length || 2} Quests</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px 20px',
                      background: '#090d16',
                      borderTop: '1px solid #1e293b',
                      display: 'flex',
                      gap: '8px'
                    }}
                  >
                    <button
                      onClick={() => {
                        setActiveGame(g);
                        if (g.weapons?.length > 0) setSelectedWeapon(g.weapons[0]);
                        navigate(`/play/${g.build_id}`);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer'
                      }}
                    >
                      ▶ Play Fullscreen
                    </button>
                    <button
                      onClick={() => handleLaunchNativeGodot(g.build_id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #6366f1',
                        background: '#1e1b4b',
                        color: '#e0e7ff',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      🚀 Godot 4
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
