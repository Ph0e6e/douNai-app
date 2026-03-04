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
  }

  let state = getState();

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
    const empty = document.getElementById('emptyTasks');
    const closeCard = document.getElementById('dailyCloseCard');

    if (day.tasks.length === 0) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.style.display = '';
      closeCard.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
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

    // Restore mood
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.mood === day.mood);
    });
    document.getElementById('noteInput').value = day.note || '';
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
      item.innerHTML = `
        <div class="history-date">
          ${date.slice(5).replace('-', '月') + '日'}
          ${day.mood ? `<span class="history-mood">${day.mood}</span>` : ''}
        </div>
        <div class="history-detail">
          ✅ ${done}/${day.tasks.length} 任务 · +${day.earned || 0} 🌸
          ${day.note ? ` · "${escapeHtml(day.note.slice(0, 30))}"` : ''}
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

    // Mood selection
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = getDay(today());
        day.mood = btn.dataset.mood;
        saveState();
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Note
    document.getElementById('noteInput').addEventListener('input', (e) => {
      const day = getDay(today());
      day.note = e.target.value;
      saveState();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
