/**
 * Surveytopia - RPG Dialogue, Screener, and Survey Execution System
 */

import { SURVEY_DATA } from '../data/surveys.js';
import { sound } from '../audio.js';
import confetti from 'canvas-confetti';

export class DialogueSystem {
  constructor(player, renderer) {
    this.player = player;
    this.renderer = renderer;
    this.container = document.getElementById('dialogue-modal');
    this.activeSurvey = null;
    this.currentStep = 0; // 0 = greeting/screener, 1..n = questions, n+1 = summary
    this.selectedAnswers = {};
    this.questionStartTime = 0;
    this.isOpen = false;

    this.bindEvents();
  }

  bindEvents() {
    // Close button / backdrop
    document.getElementById('dialogue-close-btn')?.addEventListener('click', () => this.close());
  }

  open(npc) {
    sound.init();
    const surveyId = npc.surveyId;
    const survey = SURVEY_DATA[surveyId];

    if (!survey) {
      console.warn('No survey data for NPC:', npc);
      return;
    }

    // Check if VIP and not unlocked
    if (survey.isVip && !this.player.unlockedVip.includes(surveyId)) {
      sound.playBouncerReject();
      this.renderer.addFloatingText('Access Denied: Pass Screener First!', npc.x, npc.y - 20, '#ef4444');
      return;
    }

    this.activeNpc = npc;
    this.activeSurvey = survey;
    this.currentStep = 0;
    this.selectedAnswers = {};
    this.isOpen = true;

    this.container.classList.remove('hidden');
    sound.playDialogueBlip();
    this.renderStep();
  }

  close() {
    this.isOpen = false;
    this.container.classList.add('hidden');
    this.activeSurvey = null;
    this.activeNpc = null;
  }

  renderStep() {
    const s = this.activeSurvey;
    const npc = this.activeNpc;
    const body = document.getElementById('dialogue-body');
    const header = document.getElementById('dialogue-header');

    if (!body || !header) return;

    // Header info
    header.innerHTML = `
      <div class="dialogue-npc-meta">
        <div class="dialogue-avatar">${s.avatar || '👤'}</div>
        <div>
          <h3 class="dialogue-npc-name">${s.npcName}</h3>
          <p class="dialogue-npc-role">${s.role}</p>
        </div>
      </div>
      <div class="dialogue-bounty-badge">
        ${s.isBouncer ? '🛡️ Screener Check' : s.isAttentionTrap ? '⚡ Integrity Trap' : `💰 +${s.rewardCoins} Coins • +${s.rewardGems} Gems`}
      </div>
    `;

    // 1. BOUNCER SCREENER LOGIC
    if (s.isBouncer) {
      this.renderBouncerScreener(body, s);
      return;
    }

    // 2. STANDARD SURVEY GREETING (Step 0)
    if (this.currentStep === 0) {
      const alreadyDone = this.player.completedSurveys.includes(s.id);
      body.innerHTML = `
        <div class="dialogue-speech-box">
          <p class="dialogue-text">"${s.greeting}"</p>
          <div class="dialogue-survey-preview">
            <div class="preview-item"><span>📋 Topic:</span> <strong>${s.title}</strong></div>
            <div class="preview-item"><span>⏱️ Est. Time:</span> <strong>${s.estimatedTime || '2 min'}</strong></div>
            <div class="preview-item"><span>🏆 Rewards:</span> <strong>+${s.rewardCoins} Coins, +${s.rewardGems} Gems, +${s.rewardXp} XP</strong></div>
          </div>
          ${alreadyDone ? '<p class="already-completed-tag">✅ You have already completed this survey quest! You can review or take it again for half XP.</p>' : ''}
        </div>
        <div class="dialogue-actions">
          <button id="dialogue-start-btn" class="rpg-btn primary">Begin Survey Quest ➔</button>
          <button id="dialogue-cancel-btn" class="rpg-btn secondary">Maybe Later</button>
        </div>
      `;

      document.getElementById('dialogue-start-btn')?.addEventListener('click', () => {
        sound.playSelect();
        this.currentStep = 1;
        this.renderStep();
      });
      document.getElementById('dialogue-cancel-btn')?.addEventListener('click', () => this.close());
      return;
    }

    // 3. SURVEY QUESTIONS (Step 1 .. n)
    const qIndex = this.currentStep - 1;
    const questions = s.questions;

    if (qIndex < questions.length) {
      this.questionStartTime = Date.now();
      const q = questions[qIndex];
      this.renderQuestion(body, q, qIndex, questions.length);
      return;
    }

    // 4. SURVEY COMPLETION SUMMARY
    this.renderCompletion(body, s);
  }

  renderBouncerScreener(body, s) {
    const screener = s.screenerQuestion;
    const isAlreadyUnlocked = this.player.unlockedVip.includes(s.vipSurveyId);

    if (isAlreadyUnlocked) {
      body.innerHTML = `
        <div class="dialogue-speech-box">
          <p class="dialogue-text">"You've already passed this screener, VIP! The velvet rope is down. Head right into the VIP venue for high-paying research!"</p>
        </div>
        <div class="dialogue-actions">
          <button id="dialogue-close-btn2" class="rpg-btn primary">Got it, thanks!</button>
        </div>
      `;
      document.getElementById('dialogue-close-btn2')?.addEventListener('click', () => this.close());
      return;
    }

    body.innerHTML = `
      <div class="dialogue-speech-box">
        <p class="dialogue-text">"${screener.text}"</p>
        <p class="screener-hint">💡 Market research demographic screener: Answer accurately to qualify for the VIP high-yield survey.</p>
        <div class="dialogue-options-list">
          ${screener.options.map((opt, i) => `
            <button class="option-btn" data-index="${i}">
              <span class="option-key">${i + 1}</span>
              <span class="option-label">${opt.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const opt = screener.options[idx];
        this.handleScreenerAnswer(opt, s);
      });
    });
  }

  handleScreenerAnswer(option, s) {
    const body = document.getElementById('dialogue-body');
    const screener = s.screenerQuestion;

    if (option.qualifies) {
      // QUALIFIED!
      sound.playVipFanfare();
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      this.player.unlockedVip.push(s.vipSurveyId);
      this.player.saveState();
      this.renderer.addFloatingText('✨ VIP ACCESS UNLOCKED!', this.activeNpc.x, this.activeNpc.y - 30, '#10b981');

      body.innerHTML = `
        <div class="dialogue-speech-box success-banner">
          <div class="screener-result-badge qualify">🎉 QUALIFIED FOR VIP LOUNGE!</div>
          <p class="dialogue-text">"${screener.qualifyMessage}"</p>
          <div class="vip-unlocked-box">
            <p><strong>Velvet Rope Lowered:</strong> Walk past the stanchions to meet the VIP research sponsor!</p>
          </div>
        </div>
        <div class="dialogue-actions">
          <button id="dialogue-vip-enter-btn" class="rpg-btn primary">Enter VIP Venue ➔</button>
        </div>
      `;
      document.getElementById('dialogue-vip-enter-btn')?.addEventListener('click', () => this.close());
    } else {
      // DISQUALIFIED / SCREENED OUT
      sound.playBouncerReject();
      this.player.coins += s.consolationCoins;
      this.player.saveState();
      this.renderer.addFloatingText(`+${s.consolationCoins} Consolation Coins`, this.activeNpc.x, this.activeNpc.y - 20, '#f59e0b');

      body.innerHTML = `
        <div class="dialogue-speech-box disqualify-banner">
          <div class="screener-result-badge disqualify">❌ DEMOGRAPHIC QUOTA FULL</div>
          <p class="dialogue-text">"${screener.disqualifyMessage}"</p>
          <div class="consolation-reward-box">
            <span class="coin-icon">🪙</span>
            <div>
              <strong>+${s.consolationCoins} Consolation Coins Awarded</strong>
              <p>Even when you screen out, Surveytopia respects your time!</p>
            </div>
          </div>
        </div>
        <div class="dialogue-actions">
          <button id="dialogue-dq-btn" class="rpg-btn secondary">Explore Other Streets</button>
        </div>
      `;
      document.getElementById('dialogue-dq-btn')?.addEventListener('click', () => this.close());
    }
  }

  renderQuestion(body, q, qIndex, totalQuestions) {
    const isTrap = q.type === 'attention_check';

    body.innerHTML = `
      <div class="dialogue-question-header">
        <div class="dialogue-progress-track">
          <div class="dialogue-progress-fill" style="width: ${((qIndex + 1) / totalQuestions) * 100}%"></div>
        </div>
        <div class="dialogue-step-count">Question ${qIndex + 1} of ${totalQuestions}</div>
      </div>

      <div class="dialogue-speech-box">
        <p class="dialogue-q-text">${isTrap ? '⚠️ ' : ''}${q.text}</p>

        ${q.type === 'single' || q.type === 'attention_check' ? `
          <div class="dialogue-options-list">
            ${q.options.map((opt, i) => `
              <button class="option-btn" data-value="${opt.value}">
                <span class="option-key">${i + 1}</span>
                <span class="option-label">${opt.text}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        ${q.type === 'multi' ? `
          <div class="dialogue-multi-list">
            ${q.options.map((opt, i) => `
              <label class="multi-option-item">
                <input type="checkbox" name="multi_q" value="${opt.value}">
                <span class="checkbox-custom"></span>
                <span class="multi-text">${opt.text}</span>
              </label>
            `).join('')}
          </div>
          <div class="dialogue-actions">
            <button id="multi-submit-btn" class="rpg-btn primary" disabled>Select at least 1 option ➔</button>
          </div>
        ` : ''}

        ${q.type === 'rating' ? `
          <div class="dialogue-rating-container">
            <div class="rating-stars">
              ${[1, 2, 3, 4, 5].map(star => `
                <button class="star-btn" data-star="${star}">★</button>
              `).join('')}
            </div>
            <div class="rating-labels">
              <span>${q.labels?.[0] || 'Poor'}</span>
              <span>${q.labels?.[1] || 'Average'}</span>
              <span>${q.labels?.[2] || 'Excellent'}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Event handlers for options
    if (q.type === 'single' || q.type === 'attention_check') {
      body.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.handleAnswerChoice(q, btn.dataset.value);
        });
      });
    } else if (q.type === 'multi') {
      const checkboxes = body.querySelectorAll('input[name="multi_q"]');
      const submitBtn = document.getElementById('multi-submit-btn');

      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
          if (selected.length > 0) {
            submitBtn.removeAttribute('disabled');
            submitBtn.textContent = `Continue (${selected.length} selected) ➔`;
          } else {
            submitBtn.setAttribute('disabled', 'true');
            submitBtn.textContent = 'Select at least 1 option ➔';
          }
        });
      });

      submitBtn?.addEventListener('click', () => {
        const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
        this.handleAnswerChoice(q, selected);
      });
    } else if (q.type === 'rating') {
      body.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const star = parseInt(btn.dataset.star, 10);
          this.handleAnswerChoice(q, star);
        });
      });
    }
  }

  handleAnswerChoice(question, value) {
    const elapsedMs = Date.now() - this.questionStartTime;

    // Speed check anti-fraud warning
    if (elapsedMs < 350) {
      sound.playError();
      this.renderer.addFloatingText('⚠️ Reading too fast!', this.player.x, this.player.y - 25, '#f59e0b');
    }

    // Attention check validation (Honesty Shield)
    if (question.type === 'attention_check') {
      if (value === question.targetValue) {
        // Passed trap!
        sound.playSuccess();
        this.player.adjustTrust(+5);
        this.renderer.addFloatingText('🛡️ Trap Deflected! Trust +5%', this.player.x, this.player.y - 25, '#10b981');
      } else {
        // Failed trap!
        sound.playError();
        this.player.adjustTrust(-15);
        this.renderer.addFloatingText('❌ Trap Triggered! Trust -15%', this.player.x, this.player.y - 25, '#ef4444');
      }
    } else {
      sound.playSelect();
    }

    this.selectedAnswers[question.id] = value;
    this.currentStep++;
    this.renderStep();
  }

  renderCompletion(body, s) {
    const isTrap = s.isAttentionTrap;
    const isAlreadyCompleted = this.player.completedSurveys.includes(s.id);

    // Calculate payouts
    const coinReward = isAlreadyCompleted ? Math.floor(s.rewardCoins * 0.5) : s.rewardCoins;
    const gemReward = isAlreadyCompleted ? 1 : s.rewardGems;
    const xpReward = isAlreadyCompleted ? Math.floor(s.rewardXp * 0.5) : s.rewardXp;

    // Apply player state
    if (!isAlreadyCompleted) {
      this.player.completedSurveys.push(s.id);
    }
    this.player.addRewards(coinReward, gemReward, xpReward, true);

    // Confetti celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    this.renderer.addFloatingText(`+${coinReward} Coins!`, this.player.x, this.player.y - 20, '#fbbf24');
    this.renderer.addFloatingText(`+${xpReward} XP!`, this.player.x, this.player.y - 35, '#38bdf8');

    const completionMsg = isTrap
      ? (this.player.trustScore >= 70 ? s.passText : s.failText)
      : s.completionText;

    body.innerHTML = `
      <div class="dialogue-speech-box completion-box">
        <div class="completion-crown">🎉 QUEST COMPLETED!</div>
        <p class="dialogue-text">"${completionMsg}"</p>

        <div class="reward-card-grid">
          <div class="reward-card">
            <span class="reward-icon">🪙</span>
            <div class="reward-val">+${coinReward}</div>
            <div class="reward-lbl">Coins</div>
          </div>
          <div class="reward-card">
            <span class="reward-icon">💎</span>
            <div class="reward-val">+${gemReward}</div>
            <div class="reward-lbl">Gems</div>
          </div>
          <div class="reward-card">
            <span class="reward-icon">⚡</span>
            <div class="reward-val">+${xpReward}</div>
            <div class="reward-lbl">Surveyor XP</div>
          </div>
        </div>

        <p class="cashout-hint">💡 Visit the <strong>Town Bank</strong> in Central Plaza to withdraw your coins into real gift cards or PayPal!</p>
      </div>

      <div class="dialogue-actions">
        <button id="dialogue-finish-btn" class="rpg-btn primary">Claim Bounty & Return ➔</button>
      </div>
    `;

    document.getElementById('dialogue-finish-btn')?.addEventListener('click', () => {
      sound.playCoin();
      this.close();
    });
  }
}
