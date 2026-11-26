// Розмітка сторінок. Дані приходять у ctx, події обробляє app.js.
import { html, num, safeUrl } from './html.js';
import { valueLimits, allowsTenths, describeResult } from './scoring.js';
import { dayStandings, dayWinners, monthStandings, allDates, addDays, streaks, personalBest, badges } from './stats.js';
import { longDate, shortDate, monthName, shiftMonth, stamp } from './dates.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const place = (n, total) => (total > 0 && n <= 3 ? html`<span class="medal">${MEDALS[n - 1]}</span>` : html`<span class="place">${n}</span>`);
export const dot = (ctx, id) => html`<i class="dot-p" style="background:${ctx.color(id)}"></i>`;
const who = (ctx, id) => html`<span class="who">${dot(ctx, id)}${ctx.name(id)}</span>`;
const empty = (text) => html`<p class="empty">${text}</p>`;

function pager(prev, label, next, extra) {
  return html`<div class="pager">
    <a class="btn ghost" href="${prev}" aria-label="Назад">‹</a>
    <h1>${label}</h1>
    ${next ? html`<a class="btn ghost" href="${next}" aria-label="Вперед">›</a>` : html`<span class="btn ghost off">›</span>`}
    ${extra}
  </div>`;
}

export function dayView(ctx, date) {
  const { state, today, me } = ctx;
  const standings = dayStandings(state.results, date);
  const winners = dayWinners(standings);
  const games = state.games.filter((g) => g.active || state.results.some((r) => r.date === date && r.gameId === g.id));
  const isToday = date === today;

  return html`
    ${pager(`#/day/${addDays(date, -1)}`, longDate(date), date < today ? `#/day/${addDays(date, 1)}` : null, html`
      <input type="date" class="date-jump" value="${date}" max="${today}" aria-label="Обрати день">
      ${!isToday && html`<a class="btn" href="#/">Сьогодні</a>`}`)}
    <div class="columns">
      <section class="panel">
        <div class="panel-head">
          <h2>${isToday ? 'Лідерборд дня' : 'Підсумок дня'}</h2>
          ${winners.length > 0 && html`<span class="tag">${isToday ? 'Веде' : 'Переможець'}: ${winners.map((w) => ctx.name(w.playerId)).join(', ')}</span>`}
        </div>
        ${standings.length === 0 ? empty('За цей день ще ніхто нічого не вніс.') : html`
        <ol class="board">${standings.map((s) => html`
          <li class="${s.place === 1 && s.total > 0 ? 'first' : ''}">
            ${place(s.place, s.total)}${who(ctx, s.playerId)}
            <span class="played">ігор: ${Object.keys(s.games).length}/${games.length}</span>
            <strong>${num(s.total)}</strong>
            <span class="bar"><span style="width:${Math.min(100, s.total / (games.length || 1))}%;background:${ctx.color(s.playerId)}"></span></span>
          </li>`)}
        </ol>
        <div class="scroll"><table class="matrix">
          <thead><tr><th>Гра</th>${standings.map((s) => html`<th>${who(ctx, s.playerId)}</th>`)}</tr></thead>
          <tbody>${games.map((g) => {
            const best = Math.max(0, ...standings.map((s) => s.games[g.id]?.score ?? 0));
            return html`<tr><th>${g.name}</th>${standings.map((s) => {
              const r = s.games[g.id];
              return r ? html`<td class="${best > 0 && r.score === best ? 'best' : ''}" title="Змінено ${stamp(r.updatedAt)} (вніс: ${r.updatedBy})"><b>${num(r.score)}</b><small>${describeResult(g, r)}</small></td>` : html`<td class="none">—</td>`;
            })}</tr>`;
          })}</tbody>
        </table></div>`}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2>${me ? html`Результати: ${ctx.name(me)}` : 'Мої результати'}</h2>
          ${me && html`<button class="btn" data-action="paste">Вставити share-текст</button>`}
        </div>
        ${!me ? html`<p class="empty">Спершу оберіть, хто ви.</p><button class="btn primary" data-action="who">Обрати гравця</button>` : html`
        <div class="cards">${state.games.filter((g) => g.active).map((g) => gameCard(ctx, g, date))}</div>`}
      </section>
    </div>`;
}

function gameCard(ctx, g, date) {
  const r = ctx.state.results.find((x) => x.date === date && x.playerId === ctx.me && x.gameId === g.id);
  const { min, max } = valueLimits(g);
  const draft = ctx.drafts.get(`${date}|${ctx.me}|${g.id}`) || {};
  const value = draft.value ?? (r?.solved ? r.value : '');
  const hints = draft.hints ?? (r?.hints || '');
  const measure = g.unit === 'м' ? 'Метри' : allowsTenths(g) ? 'Загальний бал' : 'Очки';
  const label = g.type === 'linear' ? `${measure} (0–${num(max)})` : g.type === 'table' ? `Спроба (${min}–${max})` : 'Спроби';
  // Для десяткових значень поле текстове: так приймаються і "78.7", і "78,7".
  const kind = allowsTenths(g) ? html`type="text" inputmode="decimal"` : html`type="number" inputmode="numeric"`;
  const busy = ctx.busy.has(g.id);
  return html`<form class="card ${r ? 'done' : ''}" data-game="${g.id}" novalidate>
    <div class="card-head">
      <a href="${safeUrl(g.url)}" target="_blank" rel="noopener">${g.name} <span aria-hidden="true">↗</span></a>
      ${r ? html`<span class="score">${num(r.score)}</span>` : html`<span class="score none">—</span>`}
    </div>
    <p class="card-note">${r ? html`${describeResult(g, r)} · ${stamp(r.updatedAt)}` : 'ще не внесено'}</p>
    <div class="fields">
      <label><span>${label}</span><input name="value" ${kind} min="${min}" max="${max}" step="1" value="${value}"></label>
      ${g.hintPenalty > 0 && html`<label class="narrow"><span>Підказки</span><input name="hints" type="number" inputmode="numeric" min="0" step="1" value="${hints}" placeholder="0"></label>`}
    </div>
    <p class="preview" aria-live="polite"></p>
    <div class="actions">
      <button class="btn primary" ${busy ? 'disabled' : ''}>${busy ? 'Зберігаю…' : 'Зберегти'}</button>
      ${g.type !== 'linear' && html`<button type="button" class="btn" data-action="fail" ${busy ? 'disabled' : ''}>${g.id === 'contexto' ? 'Здаюся' : 'Не пройшов'}</button>`}
      ${r && html`<button type="button" class="btn ghost danger" data-action="delete" ${busy ? 'disabled' : ''}>Видалити</button>`}
    </div>
  </form>`;
}

export function monthSeries(ctx, month) {
  const results = ctx.state.results.filter((r) => r.date.startsWith(month));
  const dates = allDates(results);
  const perDay = dates.map((d) => dayStandings(results, d));
  const series = monthStandings(results, month).slice(0, 8).map((row) => {
    let sum = 0;
    return {
      id: row.playerId, name: ctx.name(row.playerId), color: ctx.color(row.playerId),
      points: perDay.map((day) => (sum = Math.round((sum + (day.find((s) => s.playerId === row.playerId)?.total || 0)) * 10) / 10)),
    };
  });
  return { dates, series };
}

export function monthView(ctx, month) {
  const rows = monthStandings(ctx.state.results, month);
  const current = ctx.today.slice(0, 7);
  const champs = ctx.state.champions.filter((c) => c.month === month);
  const lead = rows.filter((r) => r.place === 1 && r.total > 0);
  const { series } = monthSeries(ctx, month);
  const hero = champs.length > 0
    ? html`<div class="hero"><span>🏆 Чемпіон місяця</span><strong>${champs.map((c) => c.name).join(', ')}</strong><small>балів: ${num(champs[0].total)} · перемог у днях: ${champs[0].wins}</small></div>`
    : lead.length > 0 && html`<div class="hero"><span>${month === current ? 'Зараз веде' : 'Перше місце (ще не зафіксовано)'}</span><strong>${lead.map((r) => ctx.name(r.playerId)).join(', ')}</strong>
        <small>${rows[lead.length] ? `відрив: ${num(lead[0].total - rows[lead.length].total)}` : `балів: ${num(lead[0].total)}`}${month === current ? ' · чемпіона зафіксують 1-го числа' : ''}</small></div>`;

  return html`
    ${pager(`#/month/${shiftMonth(month, -1)}`, monthName(month), month < current ? `#/month/${shiftMonth(month, 1)}` : null)}
    ${hero}
    ${rows.length === 0 ? html`<section class="panel">${empty('За цей місяць даних немає.')}</section>` : html`
    <section class="panel"><h2>Таблиця місяця</h2><div class="scroll"><table class="list">
      <thead><tr><th>#</th><th>Гравець</th><th class="n">Бали</th><th class="n">Перемоги</th><th class="n">Днів</th><th class="n">У середньому</th>${month === current && html`<th class="n">Стрік</th>`}</tr></thead>
      <tbody>${rows.map((r) => html`<tr><td>${place(r.place, r.total)}</td><td>${who(ctx, r.playerId)}</td><td class="n"><b>${num(r.total)}</b></td><td class="n">${r.wins}</td><td class="n">${r.days}</td><td class="n">${num(r.total / r.days)}</td>${month === current && html`<td class="n">🔥 ${streaks(ctx.state.results, r.playerId, ctx.today).current}</td>`}</tr>`)}</tbody>
    </table></div></section>
    <section class="panel"><h2>Гонка за місяць</h2>
      <div class="legend">${series.map((s) => html`<span>${dot(ctx, s.id)}${s.name}</span>`)}</div>
      <div id="chart" class="chart"></div>
    </section>`}`;
}

export function historyView(ctx) {
  const dates = allDates(ctx.state.results).reverse();
  let lastMonth = '';
  return html`<h1>Історія</h1>
    ${dates.length === 0 && empty('Тут з’являться зіграні дні.')}
    <div class="days">${dates.slice(0, ctx.historyLimit).map((d) => {
      const standings = dayStandings(ctx.state.results, d);
      const head = d.slice(0, 7) !== lastMonth && html`<h2>${monthName(d.slice(0, 7))}</h2>`;
      lastMonth = d.slice(0, 7);
      return html`${head}<a class="day" href="#/day/${d}"><span class="when">${shortDate(d)}</span>
        <span class="chips">${standings.map((s) => html`<span class="chip ${s.place === 1 && s.total > 0 ? 'win' : ''}">${who(ctx, s.playerId)}<b>${num(s.total)}</b></span>`)}</span></a>`;
    })}</div>
    ${dates.length > ctx.historyLimit && html`<button class="btn" data-action="more">Показати ще</button>`}`;
}

export function hallView(ctx) {
  const { state, today } = ctx;
  const months = [...new Set(state.champions.map((c) => c.month))].sort().reverse();
  const players = state.players.filter((p) => state.results.some((r) => r.playerId === p.id));
  return html`<h1>Зала слави</h1>
    <section class="panel"><h2>Чемпіони місяців</h2>
      ${months.length === 0 ? empty('Перший чемпіон з’явиться 1-го числа наступного місяця.') : html`<div class="champs">${months.map((m) => {
        const list = state.champions.filter((c) => c.month === m);
        return html`<a class="champ" href="#/month/${m}"><span>🏆 ${monthName(m)}</span><strong>${list.map((c) => c.name).join(', ')}</strong><small>балів: ${num(list[0].total)} · перемог: ${list[0].wins}</small></a>`;
      })}</div>`}
    </section>
    ${players.length > 0 && html`
    <section class="panel"><h2>Гравці</h2><div class="profiles">${players.map((p) => {
      const s = streaks(state.results, p.id, today);
      const titles = state.champions.filter((c) => c.playerId === p.id).length;
      return html`<div class="profile"><h3>${who(ctx, p.id)}</h3>
        <div class="stats"><span><b>${titles}</b>титулів</span><span><b>${s.current}</b>стрік зараз</span><span><b>${s.best}</b>найкращий стрік</span></div>
        <ul class="badges">${badges(state.results, p.id, state.games).map((b) => html`<li title="${b.hint}">${b.label}${b.count > 1 && html` <em>×${b.count}</em>`}</li>`)}</ul></div>`;
    })}</div></section>
    <section class="panel"><h2>Особисті рекорди</h2><div class="scroll"><table class="matrix">
      <thead><tr><th>Гра</th>${players.map((p) => html`<th>${who(ctx, p.id)}</th>`)}</tr></thead>
      <tbody>${state.games.filter((g) => g.active).map((g) => html`<tr><th>${g.name}</th>${players.map((p) => {
        const r = personalBest(state.results, p.id, g);
        return r ? html`<td><b>${describeResult(g, r)}</b><small>${shortDate(r.date)}</small></td>` : html`<td class="none">—</td>`;
      })}</tr>`)}</tbody>
    </table></div></section>`}`;
}

const ACTIONS = { add: 'додано', edit: 'змінено', delete: 'видалено', player: 'гравець', champion: 'новий чемпіон' };

export function logView(ctx) {
  const { actor, onlyEdits } = ctx.logFilter;
  const rows = ctx.state.log.filter((l) => (!actor || l.actorId === actor) && (!onlyEdits || l.action === 'edit' || l.action === 'delete'));
  return html`<h1>Журнал змін</h1>
    <section class="panel">
      <div class="filters">
        <label>Хто вносив <select data-filter="actor"><option value="">усі</option>${ctx.state.players.map((p) => html`<option value="${p.id}" ${p.id === actor ? 'selected' : ''}>${p.name}</option>`)}</select></label>
        <label class="check"><input type="checkbox" data-filter="onlyEdits" ${onlyEdits ? 'checked' : ''}> лише виправлення та видалення</label>
      </div>
      ${rows.length === 0 ? empty('Записів немає.') : html`<div class="scroll"><table class="list log">
        <thead><tr><th>Коли</th><th>Хто вносив</th><th>Дія</th><th>За кого, день, гра</th><th>Було → стало</th></tr></thead>
        <tbody>${rows.slice(0, 200).map((l) => html`<tr class="${l.action !== 'champion' && l.actorName !== l.playerName ? 'other' : ''}">
          <td>${stamp(l.at)}</td><td>${l.actorName}<small>${l.device}</small></td>
          <td><span class="act ${l.action}">${ACTIONS[l.action] || l.action}</span></td>
          <td>${l.playerName}<small>${l.action === 'champion' ? monthName(String(l.date).slice(0, 7)) : shortDate(String(l.date))}${l.gameName && ` · ${l.gameName}`}</small></td>
          <td>${l.before && html`<s>${l.before}</s> → `}${l.after || 'порожньо'}</td></tr>`)}</tbody>
      </table></div><p class="hint">Жовта смужка зліва: зміну за гравця вніс хтось інший. Час київський.</p>`}
    </section>`;
}
