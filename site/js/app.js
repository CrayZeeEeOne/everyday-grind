// Стан, маршрути та обробка подій.
import { loadState, send, cachedState, isDemo } from './api.js';
import { todayKyiv } from './dates.js';
import { html } from './html.js';
import { computeScore, valueLimits, describeResult } from './scoring.js';
import { parseShareAll } from './parse.js';
import { drawChart } from './chart.js';
import { dayView, monthView, monthSeries, historyView, hallView, logView, dot } from './views.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
// Порядок кольорів фіксований: колір закріплений за гравцем, а не за місцем.
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];

const ctx = {
  state: null, today: todayKyiv(), me: localStorage.getItem('eg.me'),
  drafts: new Map(), busy: new Set(), historyLimit: 40, logFilter: { actor: '', onlyEdits: false },
  name: (id) => ctx.state.players.find((p) => p.id === id)?.name || id,
  color: (id) => COLORS[Math.max(0, ctx.state.players.findIndex((p) => p.id === id)) % COLORS.length],
};

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'month') return { tab: 'month', month: /^\d{4}-(0[1-9]|1[0-2])$/.test(arg) ? arg : ctx.today.slice(0, 7) };
  if (page === 'history' || page === 'hall' || page === 'log') return { tab: page };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(arg) && !Number.isNaN(Date.parse(arg)) && arg <= ctx.today ? arg : ctx.today;
  return { tab: 'day', date, past: date !== ctx.today };
}

function render() {
  ctx.today = todayKyiv();
  const r = route();
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (r.past ? 'history' : r.tab)));
  if (!ctx.state) return;
  if (ctx.me && !ctx.state.players.some((p) => p.id === ctx.me)) ctx.me = null;
  $('#me').innerHTML = String(ctx.me ? html`${dot(ctx, ctx.me)}${ctx.name(ctx.me)}` : html`Хто ви?`);

  const pages = { day: () => dayView(ctx, r.date), month: () => monthView(ctx, r.month), history: () => historyView(ctx), hall: () => hallView(ctx), log: () => logView(ctx) };
  view.innerHTML = String(pages[r.tab]());
  const chart = $('#chart');
  if (chart) {
    const { dates, series } = monthSeries(ctx, r.month);
    drawChart(chart, dates, series);
  }
}

let toastTimer;
function toast(message, isError) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), isError ? 6000 : 2500);
}

async function save(gameId, body, date, okText, player = ctx.me) {
  ctx.busy.add(gameId);
  render();
  try {
    ctx.state = await send({ ...body, gameId, date, playerId: player, actorId: player });
    ctx.drafts.delete(`${date}|${player}|${gameId}`);
    toast(okText);
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  } finally {
    ctx.busy.delete(gameId);
    render();
  }
}

// badInput: браузер повертає порожнє значення, якщо введено не число.
function formResult(form) {
  const { value, hints } = form.elements;
  return { value: value.value, hints: hints?.value || 0, bad: value.validity.badInput || Boolean(hints?.validity.badInput) };
}

view.addEventListener('input', (e) => {
  const form = e.target.closest('form.card');
  if (!form) return;
  const game = ctx.state.games.find((g) => g.id === form.dataset.game);
  const { value, hints } = formResult(form);
  ctx.drafts.set(`${route().date}|${ctx.me}|${game.id}`, { value, hints });
  const n = Number(value), { min, max } = valueLimits(game);
  const ok = value !== '' && Number.isInteger(n) && n >= min && n <= max;
  form.querySelector('.preview').textContent = ok ? `Балів буде: ${computeScore(game, { value: n, hints: Number(hints) })}` : '';
});

view.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const { value, hints, bad } = formResult(form);
  if (bad || value === '') return toast('Введіть результат числом', true);
  save(form.dataset.game, { action: 'saveResult', value: Number(value), hints: Number(hints), solved: true }, route().date, 'Збережено');
});

view.addEventListener('change', (e) => {
  if (e.target.matches('.date-jump') && e.target.value) location.hash = `#/day/${e.target.value}`;
  const key = e.target.dataset.filter;
  if (key) {
    ctx.logFilter[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    render();
  }
});

view.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const form = button.closest('form.card');
  if (action === 'who') openWho();
  if (action === 'paste') openPaste();
  if (action === 'more') { ctx.historyLimit += 40; render(); }
  if (action === 'fail') save(form.dataset.game, { action: 'saveResult', solved: false, hints: Number(formResult(form).hints) }, route().date, 'Записано: не пройдено');
  if (action === 'delete' && confirm('Видалити цей результат? Запис про це залишиться в журналі.')) {
    save(form.dataset.game, { action: 'deleteResult' }, route().date, 'Видалено');
  }
});

/* ---------- Вибір гравця ---------- */

const whoDialog = $('#who-dialog');
function openWho() {
  if (!ctx.state) return;
  $('#who-list').innerHTML = String(html`${ctx.state.players.filter((p) => p.active).map((p) => html`
    <button type="button" class="btn ${p.id === ctx.me ? 'primary' : ''}" data-player="${p.id}">${dot(ctx, p.id)}${p.name}</button>`)}`);
  $('#who-error').textContent = '';
  if (!whoDialog.open) whoDialog.showModal();
}
function choose(id) {
  ctx.me = id;
  localStorage.setItem('eg.me', id);
  whoDialog.close();
  render();
}
$('#me').addEventListener('click', openWho);
$('#who-list').addEventListener('click', (e) => {
  const button = e.target.closest('[data-player]');
  if (button) choose(button.dataset.player);
});
$('#add-player').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target, submit = form.querySelector('button');
  const name = form.elements.name.value.replace(/\s+/g, ' ').trim();
  if (!name) return;
  submit.disabled = true;
  try {
    ctx.state = await send({ action: 'addPlayer', name, actorId: ctx.me });
    form.reset();
    choose(ctx.state.players.find((p) => p.name === name).id);
    toast(`Гравця ${name} додано`);
  } catch (err) {
    $('#who-error').textContent = err.message;
  } finally {
    submit.disabled = false;
  }
});

/* ---------- Share-текст ---------- */

const pasteDialog = $('#paste-dialog');
let parsed = [];
function openPaste() {
  parsed = [];
  pasteDialog.querySelector('textarea').value = '';
  $('#paste-info').textContent = '';
  $('#paste-save').disabled = true;
  pasteDialog.showModal();
}
pasteDialog.querySelector('textarea').addEventListener('input', (e) => {
  const gameOf = (r) => ctx.state.games.find((g) => g.id === r.gameId && g.active);
  parsed = parseShareAll(e.target.value).filter((r) => {
    const game = gameOf(r);
    if (!game) return false;
    const { min, max } = valueLimits(game);
    return !r.solved || (r.value >= min && r.value <= max);
  });
  $('#paste-info').textContent = parsed.length
    ? parsed.map((r) => `${gameOf(r).name}: ${describeResult(gameOf(r), r)}. Балів: ${computeScore(gameOf(r), r)}`).join('\n')
    : e.target.value.trim() ? 'Не вдалося розпізнати. Введіть результат у картці гри вручну.' : '';
  $('#paste-save').disabled = !parsed.length;
});
$('#paste-save').addEventListener('click', async () => {
  const list = parsed, date = route().date, player = ctx.me;
  pasteDialog.close();
  for (const { gameId, ...result } of list) {
    // Після першої помилки зупиняємось, щоб повідомлення про неї не зникло.
    if (!(await save(gameId, { action: 'saveResult', ...result }, date, 'Збережено', player))) break;
  }
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

/* ---------- Запуск і оновлення ---------- */

// Не перемальовуємо сторінку, поки людина щось вводить.
const typing = () => document.activeElement?.matches('#view input, #view select') || ctx.busy.size > 0;

async function refresh(quiet) {
  try {
    const next = await loadState();
    const first = !ctx.state;
    // Якщо під час завантаження щось зберігали, ця відповідь могла застаріти.
    if (ctx.busy.size > 0) return;
    ctx.state = next;
    if (first || !typing()) render();
    if (first && !ctx.me) openWho();
  } catch (e) {
    if (!quiet) toast(e.message, true);
    if (!ctx.state) view.innerHTML = String(html`<p class="empty">${e.message}</p><button class="btn" onclick="location.reload()">Спробувати ще раз</button>`);
  }
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
let resizeTimer, width = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth !== width && !typing()) render();
    width = window.innerWidth;
  }, 200);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
setInterval(() => { if (!document.hidden && !isDemo) refresh(true); }, 60000);

$('#demo-banner').hidden = !isDemo;
ctx.state = cachedState();
if (ctx.state) { render(); if (!ctx.me) openWho(); }
refresh(false);
