// DouNai 🌸 — Exploration Motivation Engine
// All state in localStorage, no backend needed

(function () {
  'use strict';

  // ===== Default Rewards =====
  const DEFAULT_REWARDS = [
    // Tier 1 (1🌸)
    { id: 'r1a', name: '点杯奶茶/咖啡', emoji: '☕', cost: 1 },
    { id: 'r1b', name: '泡澡 / 敷面膜', emoji: '🛁', cost: 1 },
    { id: 'r1c', name: '心安理得看一集剧', emoji: '📺', cost: 1 },
    { id: 'r1d', name: '买一份甜品', emoji: '🍰', cost: 1 },
    // Tier 3 (3🌸)
    { id: 'r3a', name: '去公园走走', emoji: '🌿', cost: 3 },
    { id: 'r3b', name: '去想吃的店', emoji: '🍜', cost: 3 },
    { id: 'r3c', name: '出门拍10张照片', emoji: '📷', cost: 3 },
    { id: 'r3d', name: '给自己买个小东西', emoji: '🛍️', cost: 3 },
    // Tier 7 (7🌸)
    { id: 'r7a', name: '鸡鸣寺看樱花', emoji: '🌸', cost: 7 },
    { id: 'r7b', name: '紫金山半日徒步', emoji: '🏔️', cost: 7 },
    { id: 'r7c', name: '去看场电影', emoji: '🎬', cost: 7 },
    { id: 'r7d', name: '约朋友吃一顿好的', emoji: '🍽️', cost: 7 },
    // Tier 15 (15🌸)
    { id: 'r15a', name: '南京一日深度游', emoji: '🗺️', cost: 15 },
    { id: 'r15b', name: '做一次SPA/按摩', emoji: '💆', cost: 15 },
    { id: 'r15c', name: '买个一直想要的东西', emoji: '🎁', cost: 15 },
    { id: 'r15d', name: '周边城市一日游', emoji: '🚄', cost: 15 },
    // Tier 30 (30🌸)
    { id: 'r30a', name: '安排一次真正的旅行', emoji: '✈️', cost: 30 },
    { id: 'r30b', name: '你来定！', emoji: '🎉', cost: 30 },
  ];

  // ===== State Management =====
  function getState() {
    const raw = localStorage.getItem('douNai_state');
    if (raw) return JSON.parse(raw);
    return {
      points: 0,
      streak: 0,
      maxStreak: 0,
      totalTasksDone: 0,
      totalDays: 0,
      totalRewardsRedeemed: 0,
      rewards: [...DEFAULT_REWARDS],
      redeemed: [],     // { id, name, emoji, cost, date }
      days: {},         // { '2026-03-04': { tasks: [...], mood, note, settled, earned } }
      lastActiveDate: null,
    };
  }

  function saveState() {
    localStorage.setItem('douNai_state', JSON.stringify(state));
    // Auto cloud backup (debounced)
    scheduleCloudBackup();
  }

  let state = getState();

  // ===== Cloud Sync =====
  const SYNC_CONFIG_KEY = 'douNai_sync';
  let syncTimer = null;

  function getSyncConfig() {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
    return { enabled: false, serverUrl: '', token: '', lastSync: null };
  }

  function saveSyncConfig(cfg) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
  }

  function scheduleCloudBackup() {
    const cfg = getSyncConfig();
    if (!cfg.enabled || !cfg.serverUrl) return;
    // Debounce: wait 3 seconds after last change
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => cloudBackup(cfg), 3000);
  }

  async function cloudBackup(cfg) {
    if (!cfg) cfg = getSyncConfig();
    if (!cfg.enabled || !cfg.serverUrl) return;
    try {
      const res = await fetch(cfg.serverUrl + '/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.token
        },
        body: JSON.stringify(state)
      });
      if (res.ok) {
        cfg.lastSync = new Date().toISOString();
        saveSyncConfig(cfg);
        updateSyncStatus();
      }
    } catch (e) {
      console.warn('Cloud backup failed:', e);
    }
  }

  async function cloudRestore() {
    const cfg = getSyncConfig();
    if (!cfg.enabled || !cfg.serverUrl) return false;
    try {
      const res = await fetch(cfg.serverUrl + '/api/backup', {
        headers: { 'Authorization': 'Bearer ' + cfg.token }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.points !== undefined) {
          state = data;
          localStorage.setItem('douNai_state', JSON.stringify(state));
          return true;
        }
      }
    } catch (e) {
      console.warn('Cloud restore failed:', e);
    }
    return false;
  }

  function updateSyncStatus() {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const cfg = getSyncConfig();
    if (!cfg.enabled) {
      el.textContent = '未开启';
      el.className = 'sync-status off';
    } else if (cfg.lastSync) {
      const t = new Date(cfg.lastSync);
      el.textContent = `已同步 ${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
      el.className = 'sync-status on';
    } else {
      el.textContent = '已开启，等待首次同步';
      el.className = 'sync-status on';
    }
  }

  // ===== Utilities =====
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function todayDisplay() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 ${'日一二三四五六'[d.getDay()]}`;
  }

  function getDay(date) {
    if (!state.days[date]) {
      state.days[date] = { tasks: [], mood: null, note: '', settled: false, earned: 0 };
    }
    return state.days[date];
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function showCelebration(emoji, text) {
    document.getElementById('celebrationEmoji').textContent = emoji;
    document.getElementById('celebrationText').innerHTML = text;
    document.getElementById('celebration').classList.add('show');
  }

  window.closeCelebration = function () {
    document.getElementById('celebration').classList.remove('show');
  };

  // ===== Journal Evaluation Engine =====
  function evaluateJournal(text) {
    const result = { stars: 0, total: 0, breakdown: [] };
    const len = text.replace(/\s/g, '').length; // non-whitespace chars

    // 1. Word count (max 2 stars)
    if (len >= 300) {
      result.breakdown.push({ icon: '✍️', label: '字数充足 (300+)', stars: 2, earned: true });
      result.stars += 2;
    } else if (len >= 100) {
      result.breakdown.push({ icon: '✍️', label: '字数达标 (100+)', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '✍️', label: `字数不足 (${len}/100)`, stars: 0, earned: false });
    }

    // 2. Reflection depth (1 star)
    const reflectWords = ['因为', '所以', '发现', '意识到', '原来', '明白了', '理解了', '感受到',
      '反思', '思考', '领悟', '觉悟', '认识到', '想到了', '意味着', '说明',
      '之所以', '根本原因', '本质上', '实际上', '深层'];
    const hasReflection = reflectWords.some(w => text.includes(w));
    if (hasReflection) {
      result.breakdown.push({ icon: '🔍', label: '包含反思分析', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '🔍', label: '缺少反思分析', stars: 0, earned: false,
        hint: '试试用"因为""发现""意识到"' });
    }

    // 3. Action planning (1 star)
    const actionWords = ['下次', '以后', '打算', '计划', '明天', '接下来', '要做', '准备',
      '目标', '改进', '调整', '尝试', '第一步', '具体来说', '行动'];
    const hasAction = actionWords.some(w => text.includes(w));
    if (hasAction) {
      result.breakdown.push({ icon: '🎯', label: '包含行动计划', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '🎯', label: '缺少行动计划', stars: 0, earned: false,
        hint: '试试写"下次我要""计划"' });
    }

    // 4. Self-questioning (1 star)
    const hasQuestion = text.includes('？') || text.includes('?');
    if (hasQuestion) {
      result.breakdown.push({ icon: '❓', label: '有自我提问', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '❓', label: '缺少自我提问', stars: 0, earned: false,
        hint: '问问自己为什么？' });
    }

    result.total = result.stars;
    result.points = result.stars * 0.5; // each star = 0.5 🌸
    return result;
  }

  // ===== Streak Calculation =====
  function updateStreak() {
    const t = today();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (state.lastActiveDate === t) return; // already counted today
    if (state.lastActiveDate === yesterday) {
      state.streak += 1;
    } else if (state.lastActiveDate !== t) {
      state.streak = 1;
    }

    state.lastActiveDate = t;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    saveState();
  }

  // ===== Render Functions =====
  function renderHeader() {
    document.getElementById('totalPoints').textContent = state.points;
    document.getElementById('streakCount').textContent = state.streak;
    document.getElementById('rewardPoints').textContent = state.points;

    // Next reward calculation
    const tiers = [1, 3, 7, 15, 30];
    const tierNames = ['小确幸 ☕', '小奖励 🌿', '中奖励 🌸', '大奖励 🗺️', '终极奖励 ✈️'];
    let nextTier = tiers[tiers.length - 1];
    let nextName = tierNames[tierNames.length - 1];

    for (let i = 0; i < tiers.length; i++) {
      if (state.points < tiers[i]) {
        nextTier = tiers[i];
        nextName = tierNames[i];
        break;
      }
    }

    const pct = Math.min((state.points / nextTier) * 100, 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('nextRewardName').textContent = nextName;
    const needed = nextTier - state.points;
    document.getElementById('progressText').textContent =
      needed > 0 ? `还需 ${needed} 🌸` : '可以兑换啦！🎉';
  }

  function renderTasks() {
    const day = getDay(today());
    const list = document.getElementById('taskList');
    const closeCard = document.getElementById('dailyCloseCard');

    // Always update diary date first (before any early return)
    const now = new Date();
    document.getElementById('diaryMonth').textContent = now.getMonth() + 1;
    document.getElementById('diaryDay').textContent = now.getDate();
    document.getElementById('diaryWeekday').textContent = '星期' + '日一二三四五六'[now.getDay()];

    if (day.tasks.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <p>还没有今日任务</p>
          <p class="empty-sub">添加你今天打算做的事吧</p>
        </div>
      `;
      closeCard.style.display = 'none';
      return;
    }

    list.innerHTML = '';

    day.tasks.forEach((task, i) => {
      const div = document.createElement('div');
      div.className = 'task-item';
      div.innerHTML = `
        <div class="task-checkbox ${task.done ? 'checked' : ''}" data-idx="${i}"></div>
        <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
        <button class="task-delete" data-idx="${i}">✕</button>
      `;
      list.appendChild(div);
    });

    // Show daily close if there are completed tasks and not yet settled
    const doneCount = day.tasks.filter(t => t.done).length;
    if (doneCount > 0 && !day.settled) {
      closeCard.style.display = '';
      document.getElementById('closeDone').textContent = doneCount;
      document.getElementById('closeTotal').textContent = day.tasks.length;

      // Calculate potential earnings
      let earned = 0;
      if (doneCount === day.tasks.length && day.tasks.length > 0) earned = 1;
      else if (doneCount >= day.tasks.length * 0.5) earned = 1; // at least half

      // Streak bonus (preview)
      const potentialStreak = state.lastActiveDate === today() ? state.streak : (
        state.lastActiveDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? state.streak + 1 : 1
      );
      if (potentialStreak >= 7) earned += 3;
      else if (potentialStreak >= 3) earned += 1;

      document.getElementById('closeEarned').textContent = earned;
    } else {
      closeCard.style.display = 'none';
    }

    // (diary date already updated at top of renderTasks)

    // Restore mood & weather
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood === day.mood);
    });
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.weather === day.weather);
    });

    const journalInput = document.getElementById('journalInput');
    const journalSubmitBtn = document.getElementById('journalSubmitBtn');
    const journalSubmitted = document.getElementById('journalSubmitted');
    const journalEval = document.getElementById('journalEval');

    journalInput.value = day.journal || day.note || '';
    updateWordCount();

    if (day.journalSubmitted) {
      journalInput.readOnly = true;
      journalInput.style.opacity = '0.7';
      journalSubmitBtn.style.display = 'none';
      journalSubmitted.style.display = '';
      // Show eval
      if (day.journalEval) {
        showEvaluation(day.journalEval);
        journalEval.style.display = '';
      }
    } else {
      journalInput.readOnly = false;
      journalInput.style.opacity = '1';
      journalSubmitBtn.style.display = '';
      journalSubmitted.style.display = 'none';
      journalEval.style.display = 'none';
    }
  }

  function renderRewards() {
    const tiers = { 1: 'tier1Rewards', 3: 'tier3Rewards', 7: 'tier7Rewards', 15: 'tier15Rewards', 30: 'tier30Rewards' };

    for (const [cost, containerId] of Object.entries(tiers)) {
      const container = document.getElementById(containerId);
      const rewards = state.rewards.filter(r => r.cost === Number(cost));
      container.innerHTML = '';

      rewards.forEach(r => {
        const affordable = state.points >= r.cost;
        const card = document.createElement('div');
        card.className = `reward-card ${affordable ? 'affordable' : ''}`;
        card.innerHTML = `
          <span class="reward-emoji">${r.emoji}</span>
          <div class="reward-name">${escapeHtml(r.name)}</div>
        `;
        card.addEventListener('click', () => redeemReward(r));
        container.appendChild(card);
      });
    }

    // Redeemed list
    const redeemed = document.getElementById('redeemedList');
    if (state.redeemed.length === 0) {
      redeemed.innerHTML = `<div class="empty-state"><p>还没有兑换过奖励</p><p class="empty-sub">攒够🌸就来挑一个吧！</p></div>`;
    } else {
      redeemed.innerHTML = '';
      [...state.redeemed].reverse().forEach(r => {
        const item = document.createElement('div');
        item.className = 'redeemed-item';
        item.innerHTML = `
          <span class="ri-emoji">${r.emoji}</span>
          <span class="ri-name">${escapeHtml(r.name)}</span>
          <span class="ri-date">${r.date}</span>
        `;
        redeemed.appendChild(item);
      });
    }
  }

  function renderHistory() {
    // Stats
    document.getElementById('statTotalDays').textContent = state.totalDays;
    document.getElementById('statTotalTasks').textContent = state.totalTasksDone;
    document.getElementById('statMaxStreak').textContent = state.maxStreak;
    document.getElementById('statTotalRewards').textContent = state.totalRewardsRedeemed;

    // Heatmap (last 28 days)
    const heatmap = document.getElementById('heatmap');
    heatmap.innerHTML = '';
    for (let i = 27; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const day = state.days[d];
      let level = 0;
      if (day && day.settled) {
        const done = day.tasks.filter(t => t.done).length;
        if (done >= 4) level = 4;
        else if (done >= 3) level = 3;
        else if (done >= 2) level = 2;
        else if (done >= 1) level = 1;
      }
      const cell = document.createElement('div');
      cell.className = `heatmap-cell level-${level}`;
      const dateDisplay = d.slice(5);
      cell.title = `${dateDisplay}: ${day && day.settled ? day.tasks.filter(t => t.done).length + '/' + day.tasks.length + ' 任务' : '无记录'}`;
      heatmap.appendChild(cell);
    }

    // History list (sorted desc)
    const historyList = document.getElementById('historyList');
    const sortedDays = Object.keys(state.days).sort().reverse();

    if (sortedDays.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><p>还没有记录</p><p class="empty-sub">完成第一天就有了～</p></div>`;
      return;
    }

    historyList.innerHTML = '';
    sortedDays.slice(0, 14).forEach(date => {
      const day = state.days[date];
      const done = day.tasks.filter(t => t.done).length;
      const item = document.createElement('div');
      item.className = 'history-item';
      const journalLen = day.journal ? day.journal.replace(/\s/g, '').length : 0;
      const journalStars = day.journalEval ? '★'.repeat(day.journalEval.stars) + '☆'.repeat(5 - day.journalEval.stars) : '';
      const submitTime = day.journalSubmitTime ? new Date(day.journalSubmitTime) : null;
      const timeStr = submitTime ? `${submitTime.getHours().toString().padStart(2,'0')}:${submitTime.getMinutes().toString().padStart(2,'0')}` : '';
      item.innerHTML = `
        <div class="history-date">
          ${date.slice(5).replace('-', '月') + '日'}
          ${timeStr ? `<span class="history-time">${timeStr}</span>` : ''}
          ${day.weather ? `<span class="history-weather">${day.weather}</span>` : ''}
          ${day.mood ? `<span class="history-mood">${day.mood}</span>` : ''}
        </div>
        <div class="history-detail">
          ✅ ${done}/${day.tasks.length} 任务 · +${(day.earned || 0) + (day.journalPoints || 0)} 🌸
          ${journalStars ? ` · 📝${journalStars}` : ''}
          ${day.journal ? ` · "${escapeHtml(day.journal.slice(0, 30))}..."` : ''}
        </div>
      `;
      historyList.appendChild(item);
    });
  }

  function renderAll() {
    renderHeader();
    renderTasks();
    renderRewards();
    renderHistory();
  }

  // ===== Actions =====
  function addTask(text) {
    if (!text.trim()) return;
    const day = getDay(today());
    day.tasks.push({ text: text.trim(), done: false });
    saveState();
    renderTasks();
    renderHeader();
  }

  function toggleTask(idx) {
    const day = getDay(today());
    if (idx >= 0 && idx < day.tasks.length) {
      day.tasks[idx].done = !day.tasks[idx].done;
      saveState();
      renderTasks();

      if (day.tasks[idx].done) {
        showToast('✅ 做得好！');
      }
    }
  }

  function deleteTask(idx) {
    const day = getDay(today());
    if (idx >= 0 && idx < day.tasks.length) {
      day.tasks.splice(idx, 1);
      saveState();
      renderTasks();
    }
  }

  function settleDay() {
    const day = getDay(today());
    if (day.settled) return;

    const done = day.tasks.filter(t => t.done).length;
    const total = day.tasks.length;
    if (total === 0) return;

    let earned = 0;
    if (done >= total * 0.5) earned = 1; // at least half done

    // Update streak
    updateStreak();

    // Streak bonus
    if (state.streak >= 7) earned += 3;
    else if (state.streak >= 3) earned += 1;

    day.earned = earned;
    day.settled = true;
    state.points += earned;
    state.totalTasksDone += done;
    state.totalDays += 1;
    saveState();
    renderAll();

    // Celebration
    let msg = `今天完成了 ${done}/${total} 个任务！<br>获得 ${earned} 🌸`;
    if (state.streak >= 7) msg += `<br><br>🔥 连续${state.streak}天！额外+3🌸`;
    else if (state.streak >= 3) msg += `<br><br>🔥 连续${state.streak}天！额外+1🌸`;

    showCelebration('🌸', msg);
  }

  function redeemReward(reward) {
    if (state.points < reward.cost) {
      showToast(`还差 ${reward.cost - state.points} 🌸 才能兑换哦`);
      return;
    }

    if (!confirm(`确定要用 ${reward.cost} 🌸 兑换「${reward.name}」吗？`)) return;

    state.points -= reward.cost;
    state.totalRewardsRedeemed += 1;
    state.redeemed.push({
      id: reward.id,
      name: reward.name,
      emoji: reward.emoji,
      cost: reward.cost,
      date: today()
    });
    saveState();
    renderAll();

    showCelebration(reward.emoji, `兑换成功！<br><br>「${reward.name}」<br><br>记得去享受哦，<br>奖励自己也是任务的一部分 💕`);
  }

  function updateWordCount() {
    const text = document.getElementById('journalInput').value;
    const len = text.replace(/\s/g, '').length;
    const el = document.getElementById('wordCount');
    el.textContent = len + ' 字';

    if (len >= 300) {
      el.className = 'word-count good';
    } else if (len >= 100) {
      el.className = 'word-count active';
    } else {
      el.className = 'word-count';
    }

    // Live star preview
    const evalResult = evaluateJournal(text);
    const stars = document.querySelectorAll('#journalStars .star');
    stars.forEach((s, i) => {
      s.textContent = i < evalResult.stars ? '★' : '☆';
      s.classList.toggle('filled', i < evalResult.stars);
    });

    // Hint
    const hint = document.getElementById('journalHint');
    if (len === 0) {
      hint.textContent = '';
    } else if (len < 100) {
      hint.textContent = `再写 ${100 - len} 字解锁评估`;
    } else if (evalResult.stars < 5) {
      const missed = evalResult.breakdown.find(b => !b.earned && b.hint);
      hint.textContent = missed ? missed.hint : '';
    } else {
      hint.textContent = '满分！🌟';
    }
  }

  function showEvaluation(evalResult) {
    const container = document.getElementById('evalBreakdown');
    document.getElementById('evalPoints').textContent = `+${evalResult.points} 🌸`;
    container.innerHTML = '';

    evalResult.breakdown.forEach(item => {
      const div = document.createElement('div');
      div.className = 'eval-item';
      div.innerHTML = `
        <span class="eval-icon">${item.icon}</span>
        <span class="eval-label">${item.label}</span>
        <span class="eval-score ${item.earned ? 'earned' : 'missed'}">${item.earned ? '★'.repeat(item.stars) : '☆'}</span>
      `;
      container.appendChild(div);
    });
  }

  function submitJournal() {
    const day = getDay(today());
    const text = document.getElementById('journalInput').value;
    const len = text.replace(/\s/g, '').length;

    if (len < 10) {
      showToast('写多一点再提交吧～');
      return;
    }

    const evalResult = evaluateJournal(text);
    day.journal = text;
    day.journalSubmitted = true;
    day.journalSubmitTime = new Date().toISOString();
    day.journalEval = evalResult;
    day.journalPoints = evalResult.points;

    // Award points
    state.points += evalResult.points;
    saveState();

    // Show evaluation
    showEvaluation(evalResult);
    document.getElementById('journalEval').style.display = '';
    document.getElementById('journalSubmitBtn').style.display = 'none';
    document.getElementById('journalSubmitted').style.display = '';
    document.getElementById('journalInput').readOnly = true;
    document.getElementById('journalInput').style.opacity = '0.7';

    renderHeader();

    if (evalResult.stars >= 4) {
      showCelebration('🌟', `思考深度 ${evalResult.stars}/5 星！<br>获得额外 ${evalResult.points} 🌸<br><br>深度反思是最好的成长方式 💕`);
    } else if (evalResult.points > 0) {
      showToast(`📝 +${evalResult.points} 🌸 感想奖励！`);
    }
  }

  function editJournal() {
    const day = getDay(today());
    // Refund old points
    if (day.journalPoints) {
      state.points -= day.journalPoints;
    }
    day.journalSubmitted = false;
    day.journalEval = null;
    day.journalPoints = 0;
    saveState();

    document.getElementById('journalInput').readOnly = false;
    document.getElementById('journalInput').style.opacity = '1';
    document.getElementById('journalSubmitBtn').style.display = '';
    document.getElementById('journalSubmitted').style.display = 'none';
    document.getElementById('journalEval').style.display = 'none';
    document.getElementById('journalInput').focus();
    renderHeader();
  }

  function addCustomReward() {
    const name = document.getElementById('customRewardName').value.trim();
    const cost = Number(document.getElementById('customRewardCost').value);
    let emoji = document.getElementById('customRewardEmoji').value.trim() || '🎁';

    if (!name) {
      showToast('请输入奖励名称');
      return;
    }

    const id = 'custom_' + Date.now();
    state.rewards.push({ id, name, emoji, cost });
    saveState();
    renderRewards();
    showToast('✅ 奖励已添加');

    document.getElementById('customRewardName').value = '';
    document.getElementById('customRewardEmoji').value = '';
  }

  // ===== Event Listeners =====
  function initEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });

    // Add task
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      const input = document.getElementById('taskInput');
      addTask(input.value);
      input.value = '';
      input.focus();
    });

    document.getElementById('taskInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addTask(e.target.value);
        e.target.value = '';
      }
    });

    // Task checkbox + delete (delegation)
    document.getElementById('taskList').addEventListener('click', (e) => {
      const checkbox = e.target.closest('.task-checkbox');
      if (checkbox) {
        toggleTask(Number(checkbox.dataset.idx));
        return;
      }
      const del = e.target.closest('.task-delete');
      if (del) {
        deleteTask(Number(del.dataset.idx));
      }
    });

    // Settle day
    document.getElementById('closeBtn').addEventListener('click', settleDay);

    // Weather selection
    const weatherLabels = {
      '☀️': '晴朗的一天',
      '⛅': '多云天气',
      '🌧️': '下雨了',
      '❄️': '下雪啦',
      '🌫️': '雾蒙蒙的'
    };
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = getDay(today());
        day.weather = btn.dataset.weather;
        saveState();
        document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = 'scale(1.1)'; }, 150);
        showToast(`${btn.dataset.weather} ${weatherLabels[btn.dataset.weather] || ''}`);
      });
    });

    // Mood selection
    const moodLabels = {
      '😊': '心情不错！',
      '😐': '平平淡淡～',
      '😫': '辛苦了，抱抱',
      '💪': '今天很有干劲！',
      '😴': '累了就休息一下～'
    };
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = getDay(today());
        day.mood = btn.dataset.mood;
        saveState();
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // Bounce animation
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = 'scale(1.1)'; }, 150);
        // Feedback toast
        const label = moodLabels[btn.dataset.mood] || '已记录';
        showToast(`${btn.dataset.mood} ${label}`);
      });
    });

    // Journal
    document.getElementById('journalInput').addEventListener('input', (e) => {
      const day = getDay(today());
      day.journal = e.target.value;
      saveState();
      updateWordCount();
    });

    document.getElementById('journalSubmitBtn').addEventListener('click', submitJournal);
    document.getElementById('journalEditBtn').addEventListener('click', editJournal);

    // Sync settings
    const syncCfg = getSyncConfig();
    document.getElementById('syncServer').value = syncCfg.serverUrl || '';
    document.getElementById('syncToken').value = syncCfg.token || '';
    if (syncCfg.enabled) {
      document.getElementById('syncEnableBtn').style.display = 'none';
      document.getElementById('syncDisableBtn').style.display = '';
    }
    updateSyncStatus();

    document.getElementById('syncEnableBtn').addEventListener('click', () => {
      const url = document.getElementById('syncServer').value.trim().replace(/\/$/, '');
      const token = document.getElementById('syncToken').value.trim();
      if (!url || !token) { showToast('请填写服务器地址和密钥'); return; }
      const cfg = { enabled: true, serverUrl: url, token: token, lastSync: null };
      saveSyncConfig(cfg);
      cloudBackup(cfg);
      document.getElementById('syncEnableBtn').style.display = 'none';
      document.getElementById('syncDisableBtn').style.display = '';
      showToast('☁️ 云端同步已开启');
      updateSyncStatus();
    });

    document.getElementById('syncDisableBtn').addEventListener('click', () => {
      const cfg = getSyncConfig();
      cfg.enabled = false;
      saveSyncConfig(cfg);
      document.getElementById('syncEnableBtn').style.display = '';
      document.getElementById('syncDisableBtn').style.display = 'none';
      showToast('云端同步已关闭');
      updateSyncStatus();
    });

    document.getElementById('syncRestoreBtn').addEventListener('click', async () => {
      const url = document.getElementById('syncServer').value.trim().replace(/\/$/, '');
      const token = document.getElementById('syncToken').value.trim();
      if (!url || !token) { showToast('请先填写服务器和密钥'); return; }
      saveSyncConfig({ enabled: true, serverUrl: url, token: token, lastSync: null });
      showToast('正在从云端恢复...');
      const ok = await cloudRestore();
      if (ok) {
        renderAll();
        showCelebration('☁️', '数据已从云端恢复！');
      } else {
        showToast('❌ 恢复失败，云端可能没有备份');
      }
    });

    // Custom reward
    document.getElementById('addRewardBtn').addEventListener('click', addCustomReward);

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `douNai-backup-${today()}.json`;
      a.click();
      showToast('📤 数据已导出');
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported.points !== undefined) {
            state = imported;
            saveState();
            renderAll();
            showToast('📥 数据已导入');
          } else {
            showToast('❌ 文件格式不对');
          }
        } catch {
          showToast('❌ 导入失败');
        }
      };
      reader.readAsText(file);
    });
  }

  // ===== Floating Petals =====
  function createPetals() {
    const container = document.getElementById('petals');
    for (let i = 0; i < 8; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.style.left = Math.random() * 100 + '%';
      petal.style.animationDuration = (8 + Math.random() * 12) + 's';
      petal.style.animationDelay = (Math.random() * 10) + 's';
      petal.style.width = (8 + Math.random() * 8) + 'px';
      petal.style.height = petal.style.width;
      container.appendChild(petal);
    }
  }

  // ===== Helpers =====
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Init =====
  function init() {
    document.getElementById('todayDate').textContent = todayDisplay();
    createPetals();
    initEvents();
    renderAll();
  }

  // Re-render when page becomes visible again (fixes stale date in PWA / background tabs)
  let lastDate = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = today();
      if (now !== lastDate) {
        lastDate = now;
        document.getElementById('todayDate').textContent = todayDisplay();
      }
      renderAll();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
