// DouNai 🌸 — Exploration Motivation Engine (v0.2 Bingo Edition)
// All state in localStorage, no backend needed

(function () {
  'use strict';

  // ===== Constants =====
  const DEFAULT_REWARDS = [
    { id: 'r1a', name: '点杯奶茶/咖啡', emoji: '☕', cost: 1 },
    { id: 'r1b', name: '泡澡 / 敷面膜', emoji: '🛁', cost: 1 },
    { id: 'r1c', name: '心安理得看一集剧', emoji: '📺', cost: 1 },
    { id: 'r1d', name: '买一份甜品', emoji: '🍰', cost: 1 },
    { id: 'r3a', name: '去公园走走', emoji: '🌿', cost: 3 },
    { id: 'r3b', name: '去想吃的店', emoji: '🍜', cost: 3 },
    { id: 'r3c', name: '出门拍10张照片', emoji: '📷', cost: 3 },
    { id: 'r3d', name: '给自己买个小东西', emoji: '🛍️', cost: 3 },
    { id: 'r7a', name: '鸡鸣寺看樱花', emoji: '🌸', cost: 7 },
    { id: 'r7b', name: '紫金山半日徒步', emoji: '🏔️', cost: 7 },
    { id: 'r7c', name: '去看场电影', emoji: '🎬', cost: 7 },
    { id: 'r7d', name: '约朋友吃一顿好的', emoji: '🍽️', cost: 7 },
    { id: 'r15a', name: '南京一日深度游', emoji: '🗺️', cost: 15 },
    { id: 'r15b', name: '做一次SPA/按摩', emoji: '💆', cost: 15 },
    { id: 'r15c', name: '买个一直想要的东西', emoji: '🎁', cost: 15 },
    { id: 'r15d', name: '周边城市一日游', emoji: '🚄', cost: 15 },
    { id: 'r30a', name: '安排一次真正的旅行', emoji: '✈️', cost: 30 },
    { id: 'r30b', name: '你来定！', emoji: '🎉', cost: 30 },
  ];

  const SYSTEM_TASKS = [
    '喝一杯水', '站起来走走', '深呼吸10次', '伸个懒腰',
    '整理桌面', '看窗外1分钟', '听一首歌', '给朋友发条消息',
    '刷牙洗脸', '吃早餐', '散步15分钟', '看10页书',
    '整理一个抽屉', '运动15分钟', '写3句话', '做一顿饭',
    '打扫一小块地方', '拍一张照片', '学习30分钟', '浇花',
    '涂个防晒', '吃个水果', '记一笔账', '泡杯茶',
    '做个拉伸', '收拾书包', '扔掉一件不需要的东西',
    '看一个短视频学点东西', '给家人打个电话', '画个小涂鸦',
    '整理手机相册', '列个明日计划',
  ];

  // 12 possible lines: 5 rows + 5 cols + 2 diagonals
  const BINGO_LINES = [
    [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
    [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
    [0,6,12,18,24], [4,8,12,16,20],
  ];

  const FREE_INDEX = 12;

  // ===== State Management =====
  function getState() {
    const raw = localStorage.getItem('douNai_state');
    if (raw) {
      const s = JSON.parse(raw);
      // Migration: add taskPool if missing
      if (!s.taskPool) s.taskPool = [];
      return s;
    }
    return {
      points: 0,
      streak: 0,
      maxStreak: 0,
      totalTasksDone: 0,
      totalDays: 0,
      totalRewardsRedeemed: 0,
      rewards: [...DEFAULT_REWARDS],
      redeemed: [],
      days: {},
      lastActiveDate: null,
      taskPool: [], // { id, text }
    };
  }

  function saveState() {
    localStorage.setItem('douNai_state', JSON.stringify(state));
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
          if (!state.taskPool) state.taskPool = [];
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
      state.days[date] = {
        bingo: null,
        mood: null,
        weather: null,
        journal: '',
        journalSubmitted: false,
        journalEval: null,
        journalPoints: 0,
        // Legacy compat
        tasks: [],
        settled: false,
        earned: 0,
      };
    }
    return state.days[date];
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function showCelebration(emoji, text) {
    document.getElementById('celebrationEmoji').textContent = emoji;
    document.getElementById('celebrationText').innerHTML = text;
    document.getElementById('celebration').classList.add('show');
  }

  window.closeCelebration = function () {
    document.getElementById('celebration').classList.remove('show');
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Journal Evaluation Engine =====
  function evaluateJournal(text) {
    const result = { stars: 0, total: 0, breakdown: [] };
    const len = text.replace(/\s/g, '').length;

    if (len >= 300) {
      result.breakdown.push({ icon: '✍️', label: '字数充足 (300+)', stars: 2, earned: true });
      result.stars += 2;
    } else if (len >= 100) {
      result.breakdown.push({ icon: '✍️', label: '字数达标 (100+)', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '✍️', label: `字数不足 (${len}/100)`, stars: 0, earned: false });
    }

    const reflectWords = ['因为', '所以', '发现', '意识到', '原来', '明白了', '理解了', '感受到',
      '反思', '思考', '领悟', '觉悟', '认识到', '想到了', '意味着', '说明',
      '之所以', '根本原因', '本质上', '实际上', '深层'];
    if (reflectWords.some(w => text.includes(w))) {
      result.breakdown.push({ icon: '🔍', label: '包含反思分析', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '🔍', label: '缺少反思分析', stars: 0, earned: false,
        hint: '试试用"因为""发现""意识到"' });
    }

    const actionWords = ['下次', '以后', '打算', '计划', '明天', '接下来', '要做', '准备',
      '目标', '改进', '调整', '尝试', '第一步', '具体来说', '行动'];
    if (actionWords.some(w => text.includes(w))) {
      result.breakdown.push({ icon: '🎯', label: '包含行动计划', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '🎯', label: '缺少行动计划', stars: 0, earned: false,
        hint: '试试写"下次我要""计划"' });
    }

    if (text.includes('？') || text.includes('?')) {
      result.breakdown.push({ icon: '❓', label: '有自我提问', stars: 1, earned: true });
      result.stars += 1;
    } else {
      result.breakdown.push({ icon: '❓', label: '缺少自我提问', stars: 0, earned: false,
        hint: '问问自己为什么？' });
    }

    result.total = result.stars;
    result.points = result.stars * 0.5;
    return result;
  }

  // ===== Streak Calculation =====
  function updateStreak() {
    const t = today();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (state.lastActiveDate === t) return;
    if (state.lastActiveDate === yesterday) {
      state.streak += 1;
    } else if (state.lastActiveDate !== t) {
      state.streak = 1;
    }

    state.lastActiveDate = t;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    saveState();
  }

  // ===== Bingo Logic =====

  // Get task text by ID
  function getTaskText(taskId) {
    if (taskId === 'FREE') return '🌸';
    // Check user pool
    const userTask = state.taskPool.find(t => t.id === taskId);
    if (userTask) return userTask.text;
    // Check system tasks
    if (taskId.startsWith('sys_')) {
      const idx = parseInt(taskId.slice(4));
      if (idx >= 0 && idx < SYSTEM_TASKS.length) return SYSTEM_TASKS[idx];
    }
    return '???';
  }

  // Shuffle array (Fisher-Yates)
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Generate today's bingo grid
  function generateBingo() {
    // Collect all available task IDs
    const userIds = state.taskPool.map(t => t.id);
    const sysIds = SYSTEM_TASKS.map((_, i) => `sys_${i}`);

    // Combine: user tasks first, then system to fill
    let pool = [...userIds];
    // Add system tasks not already represented
    for (const sid of sysIds) {
      if (pool.length >= 24) break;
      pool.push(sid);
    }

    // If still not enough, duplicate some
    while (pool.length < 24) {
      pool.push(sysIds[pool.length % sysIds.length]);
    }

    // Shuffle and pick 24
    const picked = shuffle(pool).slice(0, 24);

    // Insert FREE at center (index 12)
    const grid = [...picked.slice(0, 12), 'FREE', ...picked.slice(12)];

    return {
      grid: grid,
      completed: [FREE_INDEX], // FREE is auto-completed
      awardedLines: 0,
      pending: [],
      streakCounted: false,
    };
  }

  // Ensure today has a bingo
  function ensureTodayBingo() {
    const day = getDay(today());
    if (!day.bingo) {
      day.bingo = generateBingo();
      saveState();
    }
    return day;
  }

  // Count completed lines
  function countLines(completed) {
    const set = new Set(completed);
    let count = 0;
    for (const line of BINGO_LINES) {
      if (line.every(i => set.has(i))) count++;
    }
    return count;
  }

  // Get indices of cells that are part of completed lines
  function getLineCells(completed) {
    const set = new Set(completed);
    const lineCells = new Set();
    for (const line of BINGO_LINES) {
      if (line.every(i => set.has(i))) {
        line.forEach(i => lineCells.add(i));
      }
    }
    return lineCells;
  }

  // UI state for pending replacement
  let selectedPendingId = null;

  // ===== Render Functions =====

  function renderHeader() {
    document.getElementById('totalPoints').textContent = state.points;
    document.getElementById('streakCount').textContent = state.streak;
    document.getElementById('rewardPoints').textContent = state.points;

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

  function renderBingo() {
    const day = ensureTodayBingo();
    const bingo = day.bingo;
    const grid = document.getElementById('bingoGrid');
    const lineCells = getLineCells(bingo.completed);
    const completedSet = new Set(bingo.completed);

    grid.innerHTML = '';

    bingo.grid.forEach((taskId, idx) => {
      const cell = document.createElement('div');
      const isFree = idx === FREE_INDEX;
      const isCompleted = completedSet.has(idx);
      const isInLine = lineCells.has(idx);

      cell.className = 'bingo-cell';
      if (isFree) cell.classList.add('free');
      if (isCompleted) cell.classList.add('completed');
      if (isInLine) cell.classList.add('in-line');
      if (selectedPendingId) cell.classList.add('replace-target');

      cell.dataset.idx = idx;

      const text = getTaskText(taskId);
      cell.innerHTML = `<span class="cell-text">${escapeHtml(text)}</span>`;

      grid.appendChild(cell);
    });

    // Render pending chips
    const pendingContainer = document.getElementById('bingoPending');
    pendingContainer.innerHTML = '';
    if (bingo.pending && bingo.pending.length > 0) {
      bingo.pending.forEach(taskId => {
        const chip = document.createElement('div');
        chip.className = 'pending-chip' + (selectedPendingId === taskId ? ' selected' : '');
        chip.dataset.taskId = taskId;
        const text = getTaskText(taskId);
        chip.innerHTML = `${escapeHtml(text)} <span class="chip-remove" data-task-id="${taskId}">✕</span>`;
        pendingContainer.appendChild(chip);
      });
    }

    // Stats
    const completedCount = bingo.completed.length;
    const lines = countLines(bingo.completed);
    document.getElementById('bingoCompleted').textContent = completedCount;
    document.getElementById('bingoLines').textContent = lines;
    document.getElementById('bingoEarned').textContent = bingo.awardedLines || 0;

    // Update diary date
    const now = new Date();
    document.getElementById('diaryMonth').textContent = now.getMonth() + 1;
    document.getElementById('diaryDay').textContent = now.getDate();
    document.getElementById('diaryWeekday').textContent = '星期' + '日一二三四五六'[now.getDay()];

    // Restore mood & weather
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood === day.mood);
    });
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.weather === day.weather);
    });

    // Journal
    const journalInput = document.getElementById('journalInput');
    const journalSubmitBtn = document.getElementById('journalSubmitBtn');
    const journalSubmitted = document.getElementById('journalSubmitted');
    const journalEval = document.getElementById('journalEval');

    journalInput.value = day.journal || '';
    updateWordCount();

    if (day.journalSubmitted) {
      journalInput.readOnly = true;
      journalInput.style.opacity = '0.7';
      journalSubmitBtn.style.display = 'none';
      journalSubmitted.style.display = '';
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
      if (day) {
        if (day.bingo) {
          // Bingo day: level by lines
          const lines = countLines(day.bingo.completed);
          if (lines >= 8) level = 4;
          else if (lines >= 5) level = 3;
          else if (lines >= 2) level = 2;
          else if (lines >= 1) level = 1;
        } else if (day.settled) {
          // Legacy task day
          const done = day.tasks.filter(t => t.done).length;
          if (done >= 4) level = 4;
          else if (done >= 3) level = 3;
          else if (done >= 2) level = 2;
          else if (done >= 1) level = 1;
        }
      }
      const cell = document.createElement('div');
      cell.className = `heatmap-cell level-${level}`;
      const dateDisplay = d.slice(5);
      if (day && day.bingo) {
        const lines = countLines(day.bingo.completed);
        cell.title = `${dateDisplay}: ${day.bingo.completed.length}格 ${lines}条线`;
      } else if (day && day.settled) {
        cell.title = `${dateDisplay}: ${day.tasks.filter(t => t.done).length}/${day.tasks.length} 任务`;
      } else {
        cell.title = `${dateDisplay}: 无记录`;
      }
      heatmap.appendChild(cell);
    }

    // History list
    const historyList = document.getElementById('historyList');
    const sortedDays = Object.keys(state.days).sort().reverse();

    if (sortedDays.length === 0) {
      historyList.innerHTML = `<div class="empty-state"><p>还没有记录</p><p class="empty-sub">完成第一天就有了～</p></div>`;
      return;
    }

    historyList.innerHTML = '';
    sortedDays.slice(0, 14).forEach(date => {
      const day = state.days[date];
      const item = document.createElement('div');
      item.className = 'history-item';

      let taskInfo = '';
      let earned = 0;
      if (day.bingo) {
        const lines = countLines(day.bingo.completed);
        const completed = day.bingo.completed.length;
        taskInfo = `🎲 ${completed}格 · ${lines}条线 · +${day.bingo.awardedLines || 0} 🌸`;
        earned = (day.bingo.awardedLines || 0) + (day.journalPoints || 0);
      } else {
        const done = day.tasks ? day.tasks.filter(t => t.done).length : 0;
        const total = day.tasks ? day.tasks.length : 0;
        taskInfo = `✅ ${done}/${total} 任务 · +${(day.earned || 0) + (day.journalPoints || 0)} 🌸`;
      }

      const journalStars = day.journalEval ? '★'.repeat(day.journalEval.stars) + '☆'.repeat(5 - day.journalEval.stars) : '';

      item.innerHTML = `
        <div class="history-date">
          ${date.slice(5).replace('-', '月') + '日'}
          ${day.weather ? `<span class="history-weather">${day.weather}</span>` : ''}
          ${day.mood ? `<span class="history-mood">${day.mood}</span>` : ''}
        </div>
        <div class="history-detail">
          ${taskInfo}
          ${journalStars ? ` · 📝${journalStars}` : ''}
          ${day.journal ? ` · "${escapeHtml(day.journal.slice(0, 30))}${day.journal.length > 30 ? '...' : ''}"` : ''}
        </div>
      `;
      historyList.appendChild(item);
    });
  }

  function renderTaskPool() {
    const list = document.getElementById('taskPoolList');
    if (!list) return;

    if (state.taskPool.length === 0) {
      list.innerHTML = '<div class="pool-empty">还没有自定义任务<br>添加后会出现在每天的Bingo里</div>';
      return;
    }

    list.innerHTML = '';
    state.taskPool.forEach(task => {
      const item = document.createElement('div');
      item.className = 'pool-task-item';
      item.innerHTML = `
        <span>${escapeHtml(task.text)}</span>
        <button class="pool-task-delete" data-id="${task.id}">✕</button>
      `;
      list.appendChild(item);
    });
  }

  function renderAll() {
    renderHeader();
    renderBingo();
    renderRewards();
    renderHistory();
    renderTaskPool();
  }

  // ===== Bingo Actions =====

  function toggleBingoCell(idx) {
    const day = getDay(today());
    if (!day.bingo) return;
    if (idx === FREE_INDEX) return; // Can't toggle FREE

    const bingo = day.bingo;
    const completedSet = new Set(bingo.completed);

    if (completedSet.has(idx)) {
      // Uncomplete
      bingo.completed = bingo.completed.filter(i => i !== idx);
    } else {
      // Complete
      bingo.completed.push(idx);

      // First completion today? Update streak
      if (!bingo.streakCounted) {
        updateStreak();
        bingo.streakCounted = true;

        // Streak bonus
        let streakBonus = 0;
        if (state.streak >= 7) streakBonus = 3;
        else if (state.streak >= 3) streakBonus = 1;

        if (streakBonus > 0) {
          state.points += streakBonus;
          showToast(`🔥 连续${state.streak}天！额外+${streakBonus}🌸`);
        }

        state.totalDays += 1;
      }

      state.totalTasksDone += 1;
    }

    // Check for new lines
    const newLineCount = countLines(bingo.completed);
    const newLines = newLineCount - (bingo.awardedLines || 0);

    if (newLines > 0) {
      // Award points for new lines
      state.points += newLines;
      bingo.awardedLines = newLineCount;

      if (newLines === 1) {
        showToast('🎉 连线！+1 🌸');
      } else {
        showToast(`🎉 ${newLines}条新连线！+${newLines} 🌸`);
      }

      // Flash line cells
      setTimeout(() => {
        const lineCells = getLineCells(bingo.completed);
        document.querySelectorAll('.bingo-cell').forEach(cell => {
          if (lineCells.has(Number(cell.dataset.idx))) {
            cell.classList.add('line-flash');
          }
        });
      }, 50);
    } else if (!completedSet.has(idx)) {
      // Just completed a cell, no line yet
      // Animate the cell
      setTimeout(() => {
        const cell = document.querySelector(`.bingo-cell[data-idx="${idx}"]`);
        if (cell) cell.classList.add('just-completed');
      }, 50);
    }

    // Handle line loss when uncompleting
    if (completedSet.has(idx)) {
      // Uncompleted a cell, might lose lines
      const lostLines = (bingo.awardedLines || 0) - newLineCount;
      if (lostLines > 0) {
        state.points = Math.max(0, state.points - lostLines);
        bingo.awardedLines = newLineCount;
        showToast(`连线断了 -${lostLines} 🌸`);
      }
    }

    saveState();
    renderBingo();
    renderHeader();
  }

  function addTaskToPool(text) {
    if (!text.trim()) return null;
    const id = 'usr_' + Date.now();
    const task = { id, text: text.trim() };
    state.taskPool.push(task);
    saveState();
    return task;
  }

  function removeTaskFromPool(taskId) {
    state.taskPool = state.taskPool.filter(t => t.id !== taskId);
    saveState();
    renderTaskPool();
  }

  function addPendingTask(text) {
    const task = addTaskToPool(text);
    if (!task) return;

    const day = getDay(today());
    if (!day.bingo) return;

    day.bingo.pending = day.bingo.pending || [];
    day.bingo.pending.push(task.id);
    saveState();
    renderBingo();
    renderTaskPool();
    showToast('✨ 点击黄色标签，再点格子替换');
  }

  function replaceBingoCell(idx, newTaskId) {
    const day = getDay(today());
    if (!day.bingo) return;
    if (idx === FREE_INDEX) return; // Can't replace FREE

    const bingo = day.bingo;
    const oldTaskId = bingo.grid[idx];

    // Replace
    bingo.grid[idx] = newTaskId;

    // Remove from completed if it was completed
    bingo.completed = bingo.completed.filter(i => i !== idx);

    // Remove from pending
    bingo.pending = (bingo.pending || []).filter(id => id !== newTaskId);

    // Recalculate lines (might have lost some)
    const newLineCount = countLines(bingo.completed);
    const lostLines = (bingo.awardedLines || 0) - newLineCount;
    if (lostLines > 0) {
      state.points = Math.max(0, state.points - lostLines);
      bingo.awardedLines = newLineCount;
    }

    selectedPendingId = null;
    saveState();
    renderBingo();
    renderHeader();
    showToast('🔄 已替换');
  }

  // ===== Other Actions =====

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

    const evalResult = evaluateJournal(text);
    const stars = document.querySelectorAll('#journalStars .star');
    stars.forEach((s, i) => {
      s.textContent = i < evalResult.stars ? '★' : '☆';
      s.classList.toggle('filled', i < evalResult.stars);
    });

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

    state.points += evalResult.points;
    saveState();

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

    // Add task (bingo pending)
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      const input = document.getElementById('taskInput');
      addPendingTask(input.value);
      input.value = '';
      input.focus();
    });

    document.getElementById('taskInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addPendingTask(e.target.value);
        e.target.value = '';
      }
    });

    // Bingo grid clicks
    document.getElementById('bingoGrid').addEventListener('click', (e) => {
      const cell = e.target.closest('.bingo-cell');
      if (!cell) return;
      const idx = Number(cell.dataset.idx);

      if (selectedPendingId) {
        // Replace mode: replace this cell with pending task
        replaceBingoCell(idx, selectedPendingId);
      } else {
        // Toggle complete
        toggleBingoCell(idx);
      }
    });

    // Pending chip clicks
    document.getElementById('bingoPending').addEventListener('click', (e) => {
      // Remove button
      const removeBtn = e.target.closest('.chip-remove');
      if (removeBtn) {
        const taskId = removeBtn.dataset.taskId;
        const day = getDay(today());
        if (day.bingo) {
          day.bingo.pending = (day.bingo.pending || []).filter(id => id !== taskId);
          saveState();
        }
        if (selectedPendingId === taskId) selectedPendingId = null;
        renderBingo();
        return;
      }

      // Select/deselect chip
      const chip = e.target.closest('.pending-chip');
      if (!chip) return;
      const taskId = chip.dataset.taskId;

      if (selectedPendingId === taskId) {
        selectedPendingId = null; // Deselect
      } else {
        selectedPendingId = taskId; // Select
      }
      renderBingo();
    });

    // Weather selection
    const weatherLabels = {
      '☀️': '晴朗的一天', '⛅': '多云天气', '🌧️': '下雨了', '❄️': '下雪啦', '🌫️': '雾蒙蒙的'
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
      '😊': '心情不错！', '😐': '平平淡淡～', '😫': '辛苦了，抱抱',
      '💪': '今天很有干劲！', '😴': '累了就休息一下～'
    };
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = getDay(today());
        day.mood = btn.dataset.mood;
        saveState();
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = 'scale(1.1)'; }, 150);
        showToast(`${btn.dataset.mood} ${moodLabels[btn.dataset.mood] || '已记录'}`);
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

    // Task pool management (Settings)
    const addPoolBtn = document.getElementById('addPoolTaskBtn');
    const poolInput = document.getElementById('poolTaskInput');
    if (addPoolBtn) {
      addPoolBtn.addEventListener('click', () => {
        const text = poolInput.value.trim();
        if (!text) return;
        addTaskToPool(text);
        poolInput.value = '';
        renderTaskPool();
        showToast('✅ 已添加到任务池');
      });
    }
    if (poolInput) {
      poolInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const text = e.target.value.trim();
          if (!text) return;
          addTaskToPool(text);
          e.target.value = '';
          renderTaskPool();
          showToast('✅ 已添加到任务池');
        }
      });
    }

    // Task pool delete (delegation)
    const taskPoolList = document.getElementById('taskPoolList');
    if (taskPoolList) {
      taskPoolList.addEventListener('click', (e) => {
        const del = e.target.closest('.pool-task-delete');
        if (del) {
          removeTaskFromPool(del.dataset.id);
        }
      });
    }

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
            if (!state.taskPool) state.taskPool = [];
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

  // ===== Init =====
  function init() {
    document.getElementById('todayDate').textContent = todayDisplay();
    createPetals();
    initEvents();
    renderAll();
  }

  // Re-render when page becomes visible (fixes stale date in PWA)
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
