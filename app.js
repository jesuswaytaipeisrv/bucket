import { firebaseConfig } from "./firebase-config.js";

const TEAM_SIZE = 5;
const TEAM_META = {
  coral: { name: "晨露隊", color: "#e76f51", dark: "#b74733" },
  river: { name: "河浪隊", color: "#277da1", dark: "#15546f" },
  leaf: { name: "嫩芽隊", color: "#43aa8b", dark: "#20745c" }
};
const STORAGE_PREFIX = "water-splash-race";
const query = new URLSearchParams(window.location.search);
const roomCode = (query.get("room") || "WATER2026").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) || "WATER2026";
const isHost = query.get("view") === "host";
const localKey = `${STORAGE_PREFIX}:${roomCode}`;
const playerKey = `${STORAGE_PREFIX}:${roomCode}:player`;

let game = createDefaultState();
let currentPlayer = readCurrentPlayer();
let backend = { type: "demo", channel: null };
let firebaseApi = null;

const elements = {
  connectionBadge: document.querySelector("#connection-badge"), roomLabel: document.querySelector("#room-label"),
  hostView: document.querySelector("#host-view"), playerView: document.querySelector("#player-view"),
  hostHeading: document.querySelector("#host-heading"), hostCopy: document.querySelector("#host-copy"),
  startButton: document.querySelector("#start-button"), autoAssignButton: document.querySelector("#auto-assign-button"), resetButton: document.querySelector("#reset-button"),
  bucketCapacity: document.querySelector("#bucket-capacity"), growthStages: document.querySelector("#growth-stages"), countdownSeconds: document.querySelector("#countdown-seconds"),
  hostScoreboard: document.querySelector("#host-scoreboard"), playerCount: document.querySelector("#player-count"), playerRoster: document.querySelector("#player-roster"),
  joinPanel: document.querySelector("#join-panel"), tapPanel: document.querySelector("#tap-panel"), joinForm: document.querySelector("#join-form"),
  playerName: document.querySelector("#player-name"), joinError: document.querySelector("#join-error"), yourTeamLabel: document.querySelector("#your-team-label"),
  tapHeading: document.querySelector("#tap-heading"), tapCounter: document.querySelector("#tap-counter"), playerProgress: document.querySelector("#player-progress"),
  tapMessage: document.querySelector("#tap-message"), tapButton: document.querySelector("#tap-button"), changeTeamButton: document.querySelector("#change-team-button"),
  winnerOverlay: document.querySelector("#winner-overlay"), winnerTitle: document.querySelector("#winner-title"), winnerCopy: document.querySelector("#winner-copy"), winnerNextButton: document.querySelector("#winner-next-button")
};

function createDefaultState() {
  return {
    version: 3, round: 1, status: "lobby", countdownEndsAt: null, startedAt: null, finishedAt: null, winner: null,
    settings: { bucketCapacity: 24, growthStages: 4, countdownSeconds: 5 },
    teams: Object.fromEntries(Object.keys(TEAM_META).map((teamId) => [teamId, { waterUnits: 0 }])), players: {}
  };
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function normalizeState(value) {
  if (!value || value.version !== 3) return createDefaultState();
  const base = createDefaultState();
  const source = value;
  const players = Object.fromEntries(Object.entries(source.players || {}).filter(([, player]) => player).map(([id, player]) => [id, {
    name: String(player.name || "隊員").slice(0, 16), team: TEAM_META[player.team] ? player.team : null, taps: clampNumber(player.taps, 0, 0, 1000000), joinedAt: clampNumber(player.joinedAt, 0, 0, Number.MAX_SAFE_INTEGER)
  }]));
  return {
    ...base, ...source, version: 3, round: clampNumber(source.round, 1, 1, 100000),
    status: ["lobby", "countdown", "running", "finished"].includes(source.status) ? source.status : "lobby",
    settings: {
      bucketCapacity: clampNumber(source.settings?.bucketCapacity, 24, 5, 100),
      growthStages: clampNumber(source.settings?.growthStages, 4, 1, 8),
      countdownSeconds: clampNumber(source.settings?.countdownSeconds, 5, 1, 20)
    },
    teams: Object.fromEntries(Object.keys(TEAM_META).map((teamId) => [teamId, { waterUnits: clampNumber(source.teams?.[teamId]?.waterUnits, 0, 0, 1000000) }])),
    players, winner: TEAM_META[source.winner] ? source.winner : null
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function readCurrentPlayer() { try { const player = JSON.parse(sessionStorage.getItem(playerKey)); return player?.id ? player : null; } catch { return null; } }
function saveCurrentPlayer(player) { currentPlayer = player; sessionStorage.setItem(playerKey, JSON.stringify(player)); }
function gamePath() { return `${STORAGE_PREFIX}/rooms/${roomCode}`; }
function teamPlayers(teamId) { return Object.values(game.players).filter((player) => player.team === teamId); }

function teamMetrics(teamId) {
  const units = game.teams[teamId].waterUnits;
  const { bucketCapacity, growthStages } = game.settings;
  const deliveredBuckets = Math.floor(units / bucketCapacity);
  const maxGrowth = TEAM_SIZE * growthStages;
  const growthTotal = Math.min(deliveredBuckets, maxGrowth);
  const people = Array.from({ length: TEAM_SIZE }, (_, index) => Math.min(growthStages, Math.floor((growthTotal + TEAM_SIZE - 1 - index) / TEAM_SIZE)));
  return { units, deliveredBuckets, growthTotal, maxGrowth, people, smallFill: Math.round(((units % bucketCapacity) / bucketCapacity) * 100), progress: Math.round((growthTotal / maxGrowth) * 100) };
}

function personMarkup(stage, index, growthStages) {
  const scale = 0.38 + (stage / growthStages) * 0.62;
  const label = stage === growthStages ? "已長大" : `成長 ${stage} / ${growthStages}`;
  return `<div class="tiny-person ${stage === growthStages ? "is-grown" : ""}" style="--person-scale:${scale}" aria-label="第 ${index + 1} 位小人，${label}"><span class="person-head"></span><span class="person-body"></span><span class="person-legs"></span></div>`;
}

function teamBoardMarkup(teamId) {
  const meta = TEAM_META[teamId];
  const metric = teamMetrics(teamId);
  const climb = 12 + metric.smallFill * 0.72;
  const runners = Array.from({ length: TEAM_SIZE }, (_, index) => `<div class="bucket-runner" style="--runner-left:${10 + index * 20}%;--runner-climb:-${climb + (index % 2) * 4}%"><span class="runner-head"></span><span class="runner-body"></span><span class="runner-bucket"></span></div>`).join("");
  const people = metric.people.map((stage, index) => personMarkup(stage, index, game.settings.growthStages)).join("");
  return `<article class="team-board vertical-team" style="--team:${meta.color};--team-dark:${meta.dark};--growth:${metric.progress}%">
    <header class="team-board-header"><div><h3>${meta.name}</h3><span>${teamPlayers(teamId).length} / ${TEAM_SIZE} 位隊員</span></div><strong>${metric.deliveredBuckets} 桶</strong></header>
    <div class="vertical-lane" aria-label="${meta.name}由下往上提水">
      <div class="finish-platform"><span class="finish-label">終點灌溉區</span><div class="tiny-people">${people}</div></div>
      <div class="growth-meter"><span style="height:${metric.progress}%"></span></div>
      <div class="runner-group">${runners}</div>
      <div class="water-well"><span>取水處</span></div>
    </div>
    <footer class="team-board-footer"><span>提水 ${metric.units} 次</span><strong>長大 ${metric.growthTotal} / ${metric.maxGrowth}</strong></footer>
  </article>`;
}

function statusCopy() {
  const seconds = game.countdownEndsAt ? Math.max(0, Math.ceil((game.countdownEndsAt - Date.now()) / 1000)) : 0;
  if (game.status === "countdown") return { title: `${seconds} 秒後開始`, copy: "五位隊員準備提水，讓終點小人長大。" };
  if (game.status === "running") return { title: "全力提水中", copy: "每提滿一桶，就輪流灌溉一位小人。" };
  if (game.status === "finished") return { title: `${TEAM_META[game.winner]?.name || "本回合"}獲勝`, copy: "最先讓五位小人全部長大。" };
  return { title: "等待三隊就位", copy: "每隊最多五位隊員，準備由下往上接力提水。" };
}

function render() {
  const copy = statusCopy();
  const totalPlayers = Object.keys(game.players).length;
  elements.roomLabel.textContent = `房間 ${roomCode}`;
  elements.connectionBadge.textContent = backend.type === "firebase" ? "即時多人模式" : "示範模式";
  elements.connectionBadge.className = `status-badge ${backend.type === "firebase" ? "is-live" : "is-demo"}`;
  elements.hostView.hidden = !isHost; elements.playerView.hidden = isHost;

  if (isHost) {
    const locked = game.status !== "lobby";
    const unassignedCount = Object.values(game.players).filter((player) => !player.team).length;
    elements.hostHeading.textContent = copy.title; elements.hostCopy.textContent = unassignedCount ? `目前有 ${unassignedCount} 人待分隊，請先按「自動分隊」。` : copy.copy;
    elements.startButton.textContent = game.status === "lobby" ? "開始倒數" : game.status === "finished" ? "下一輪" : game.status === "countdown" ? "倒數中" : "進行中";
    elements.startButton.disabled = game.status === "countdown" || game.status === "running" || unassignedCount > 0 || totalPlayers === 0;
    elements.autoAssignButton.disabled = locked || totalPlayers === 0;
    elements.bucketCapacity.value = String(game.settings.bucketCapacity); elements.growthStages.value = String(game.settings.growthStages); elements.countdownSeconds.value = String(game.settings.countdownSeconds);
    [elements.bucketCapacity, elements.growthStages, elements.countdownSeconds].forEach((input) => { input.disabled = locked; });
    elements.hostScoreboard.innerHTML = Object.keys(TEAM_META).map(teamBoardMarkup).join("");
    elements.playerCount.textContent = `${totalPlayers} / ${TEAM_SIZE * Object.keys(TEAM_META).length} 人`;
    const roster = Object.values(game.players).sort((a, b) => a.joinedAt - b.joinedAt);
    elements.playerRoster.innerHTML = roster.length ? roster.map((player) => `<span class="player-pill" style="--team:${TEAM_META[player.team]?.color || "#687d94"}">${escapeHtml(player.name)}${player.team ? "" : "（待分隊）"}</span>`).join("") : '<span class="empty-roster">尚未有人加入</span>';
  } else {
    const joined = Boolean(currentPlayer && game.players[currentPlayer.id]);
    elements.joinPanel.hidden = joined; elements.tapPanel.hidden = !joined;
    if (joined) renderPlayerPanel();
  }

  const showWinner = game.status === "finished" && game.winner;
  elements.winnerOverlay.hidden = !showWinner;
  if (showWinner) { elements.winnerTitle.textContent = `${TEAM_META[game.winner].name}獲勝`; elements.winnerCopy.textContent = "最先讓五位小人全部長大。"; elements.winnerNextButton.hidden = !isHost; }
}

function renderPlayerPanel() {
  const player = game.players[currentPlayer.id];
  if (!player?.team) {
    elements.yourTeamLabel.textContent = "等待分隊"; elements.tapCounter.textContent = "0 次";
    elements.tapHeading.textContent = "等待主持人自動分隊"; elements.tapMessage.textContent = "主持人完成分隊後，這裡會自動顯示你的隊伍。";
    elements.playerProgress.innerHTML = ""; elements.tapButton.disabled = true; return;
  }
  const teamId = player.team; const metric = teamMetrics(teamId);
  const countdownSeconds = game.countdownEndsAt ? Math.max(0, Math.ceil((game.countdownEndsAt - Date.now()) / 1000)) : 0;
  elements.yourTeamLabel.textContent = TEAM_META[teamId].name; elements.tapCounter.textContent = `${Number(player?.taps || 0)} 次`;
  elements.playerProgress.innerHTML = teamBoardMarkup(teamId); elements.tapButton.disabled = game.status !== "running";
  elements.tapHeading.textContent = game.status === "running" ? "快速打水" : game.status === "finished" ? "本回合結束" : game.status === "countdown" ? `${countdownSeconds} 秒後開始` : "準備提水";
  elements.tapMessage.textContent = game.status === "running" ? `隊伍已讓 ${metric.growthTotal} 次成長發生，繼續提水。` : game.status === "finished" ? `${TEAM_META[game.winner]?.name || "本回合"}最先完成灌溉。` : game.status === "countdown" ? "倒數中，先把手指放在按鈕上。" : "等待主持人開始。";
}

function writeLocalState(next) { game = normalizeState(next); localStorage.setItem(localKey, JSON.stringify(game)); backend.channel?.postMessage(game); render(); }
async function mutateGame(mutator) {
  if (backend.type === "firebase") { await firebaseApi.runTransaction(firebaseApi.roomRef, (current) => { const next = normalizeState(current); mutator(next); return next; }); return; }
  const next = clone(game); mutator(next); writeLocalState(next);
}

async function joinGame(event) {
  event.preventDefault();
  const name = elements.playerName.value.trim().replace(/\s+/g, " ").slice(0, 16); elements.joinError.textContent = "";
  if (!name) { elements.playerName.focus(); return; }
  const player = { id: `p_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`, name, team: null };
  try {
    let full = false;
    await mutateGame((state) => {
      if (Object.keys(state.players).length >= TEAM_SIZE * Object.keys(TEAM_META).length) { full = true; return; }
      state.players[player.id] = { name: player.name, team: player.team, taps: 0, joinedAt: Date.now() };
    });
    if (full) { elements.joinError.textContent = "三隊名額皆已滿，無法再加入。"; return; }
    saveCurrentPlayer(player); render();
  } catch (error) { showConnectionProblem(error); }
}

async function sendTap() {
  if (!currentPlayer || game.status !== "running") return;
  try {
    if (backend.type === "firebase") { await firebaseApi.update(firebaseApi.roomRef, { [`teams/${currentPlayer.team}/waterUnits`]: firebaseApi.increment(1), [`players/${currentPlayer.id}/taps`]: firebaseApi.increment(1) }); return; }
    await mutateGame((state) => { if (state.status !== "running") return; state.teams[currentPlayer.team].waterUnits += 1; if (state.players[currentPlayer.id]) state.players[currentPlayer.id].taps += 1; });
  } catch (error) { showConnectionProblem(error); }
}

async function startOrResetRound() {
  try {
    if (game.status === "lobby") { await mutateGame((state) => { if (state.status === "lobby") { state.status = "countdown"; state.countdownEndsAt = Date.now() + state.settings.countdownSeconds * 1000; } }); return; }
    if (game.status === "finished") await prepareNextRound();
  } catch (error) { showConnectionProblem(error); }
}

async function prepareNextRound() {
  await mutateGame((state) => { state.round += 1; state.status = "lobby"; state.countdownEndsAt = null; state.startedAt = null; state.finishedAt = null; state.winner = null; Object.values(state.teams).forEach((team) => { team.waterUnits = 0; }); Object.values(state.players).forEach((player) => { player.taps = 0; }); });
}

async function autoAssignTeams() {
  try {
    await mutateGame((state) => {
      if (state.status !== "lobby") return;
      const players = Object.entries(state.players).sort(([, left], [, right]) => Number(left.joinedAt) - Number(right.joinedAt));
      players.forEach(([, player], index) => { player.team = Object.keys(TEAM_META)[index % Object.keys(TEAM_META).length]; player.taps = 0; });
    });
  } catch (error) { showConnectionProblem(error); }
}

async function updateSetting(event) {
  if (game.status !== "lobby") return;
  const input = event.currentTarget; const setting = input.id === "bucket-capacity" ? "bucketCapacity" : input.id === "growth-stages" ? "growthStages" : "countdownSeconds";
  const value = clampNumber(input.value, game.settings[setting], Number(input.min), Number(input.max)); input.value = String(value);
  try { await mutateGame((state) => { state.settings[setting] = value; }); } catch (error) { showConnectionProblem(error); }
}

function showConnectionProblem(error) { console.error("遊戲同步失敗", error); elements.connectionBadge.textContent = "同步失敗"; elements.connectionBadge.className = "status-badge is-demo"; }
function startNextRoundFromResult() { if (isHost && game.status === "finished") prepareNextRound().catch(showConnectionProblem); }

async function reconcileGameClock() {
  if (!isHost) { render(); return; }
  if (game.status === "countdown" && Date.now() >= game.countdownEndsAt) await mutateGame((state) => { if (state.status === "countdown" && Date.now() >= state.countdownEndsAt) { state.status = "running"; state.startedAt = Date.now(); } });
  if (game.status === "running") {
    const ready = Object.keys(TEAM_META).filter((teamId) => teamMetrics(teamId).growthTotal >= teamMetrics(teamId).maxGrowth);
    if (ready.length) await mutateGame((state) => { if (state.status !== "running") return; const winners = Object.keys(TEAM_META).filter((teamId) => Math.min(Math.floor(state.teams[teamId].waterUnits / state.settings.bucketCapacity), TEAM_SIZE * state.settings.growthStages) >= TEAM_SIZE * state.settings.growthStages); if (winners.length) { winners.sort((left, right) => state.teams[right].waterUnits - state.teams[left].waterUnits || left.localeCompare(right)); state.status = "finished"; state.winner = winners[0]; state.finishedAt = Date.now(); } });
  }
  render();
}

function bindEvents() {
  elements.joinForm.addEventListener("submit", joinGame);
  elements.tapButton.addEventListener("click", sendTap);
  elements.changeTeamButton.addEventListener("click", async () => { if (!currentPlayer) return; const id = currentPlayer.id; try { await mutateGame((state) => { delete state.players[id]; }); sessionStorage.removeItem(playerKey); currentPlayer = null; render(); } catch (error) { showConnectionProblem(error); } });
  elements.startButton.addEventListener("click", startOrResetRound); elements.autoAssignButton.addEventListener("click", autoAssignTeams); elements.winnerNextButton.addEventListener("click", startNextRoundFromResult);
  elements.resetButton.addEventListener("click", () => { if (window.confirm("要重設本回合的提水進度嗎？已加入的玩家會保留。")) prepareNextRound().catch(showConnectionProblem); });
  [elements.bucketCapacity, elements.growthStages, elements.countdownSeconds].forEach((input) => input.addEventListener("change", updateSetting));
}

function connectDemo() {
  try { const stored = localStorage.getItem(localKey); game = stored ? normalizeState(JSON.parse(stored)) : createDefaultState(); localStorage.setItem(localKey, JSON.stringify(game)); } catch { game = createDefaultState(); }
  if ("BroadcastChannel" in window) { backend.channel = new BroadcastChannel(localKey); backend.channel.addEventListener("message", (event) => { game = normalizeState(event.data); render(); }); }
  window.addEventListener("storage", (event) => { if (event.key === localKey && event.newValue) { game = normalizeState(JSON.parse(event.newValue)); render(); } });
}

async function connectFirebase() {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL) return false;
  try {
    const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, { getDatabase, ref, onValue, runTransaction, update, increment }] = await Promise.all([import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"), import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"), import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")]);
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig); await signInAnonymously(getAuth(app)); const roomRef = ref(getDatabase(app), gamePath()); firebaseApi = { roomRef, runTransaction, update, increment };
    await runTransaction(roomRef, (current) => current?.version === 3 ? current : createDefaultState()); onValue(roomRef, (snapshot) => { game = normalizeState(snapshot.val()); render(); }, showConnectionProblem); backend = { type: "firebase", channel: null }; return true;
  } catch (error) { console.warn("Firebase 無法使用，切換為示範模式。", error); return false; }
}

async function initialise() { if (!await connectFirebase()) connectDemo(); bindEvents(); render(); window.setInterval(() => { reconcileGameClock().catch(showConnectionProblem); }, 250); }
window.waterGrowthNextRound = startNextRoundFromResult;
initialise();
