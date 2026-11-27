// Демо-режим: імітує таблицю в localStorage, щоб подивитися сайт до налаштування.
import { DEFAULT_GAMES, computeScore, valueLimits, isValidValue, describeResult } from './scoring.js';
import { monthStandings, addDays } from './stats.js';
import { todayKyiv, shiftMonth } from './dates.js';

const KEY = 'eg.demo.v10';

function championsOf(results, players, month) {
  return monthStandings(results, month).filter((r) => r.place === 1 && r.total > 0)
    .map((r) => ({ month, playerId: r.playerId, name: players.find((p) => p.id === r.playerId).name, total: r.total, wins: r.wins }));
}

function seed() {
  const today = todayKyiv();
  let s = 42;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const players = [1, 2, 3].map((i) => ({ id: `p${i}`, name: `Гравець ${i}`, active: true }));
  const results = [];
  for (let back = 45; back >= 0; back--) {
    const date = addDays(today, -back);
    for (const p of players) {
      if (back === 0 && p.id !== 'p2') continue;
      for (const g of DEFAULT_GAMES) {
        if (rnd() < 0.06) continue;
        let value;
        if (g.type === 'table') value = 1 + Math.floor((rnd() + rnd()) / 2 * valueLimits(g).max);
        else if (g.type === 'linear') value = Math.round(g.max * (0.3 + rnd() * 0.65));
        else value = Math.max(1, Math.round(Math.exp(rnd() * Math.log(g.max / 3))));
        const hints = g.hintPenalty && rnd() < 0.25 ? 1 : 0;
        const r = { date, playerId: p.id, gameId: g.id, value, hints, solved: true };
        results.push({ ...r, score: computeScore(g, r), updatedAt: `${date}T18:00:00.000Z`, updatedBy: p.name });
      }
    }
  }
  const last = shiftMonth(today.slice(0, 7), -1);
  const champions = championsOf(results, players, last);
  return { players, games: DEFAULT_GAMES, results, champions, log: [] };
}

export function createDemoBackend() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) db = seed();
  const snapshot = () => {
    localStorage.setItem(KEY, JSON.stringify(db));
    return structuredClone({ ...db, today: todayKyiv() });
  };

  // Чемпіон завершеного місяця перераховується після кожної зміни.
  const syncChampion = (month, entry) => {
    if (month >= todayKyiv().slice(0, 7)) return;
    const next = championsOf(db.results, db.players, month);
    const names = (list) => list.map((c) => c.name).sort().join(', ');
    const before = names(db.champions.filter((c) => c.month === month)), after = names(next);
    db.champions = [...db.champions.filter((c) => c.month !== month), ...next];
    if (before && before !== after) db.log.unshift({ ...entry, action: 'champion', date: `${month}-01`, playerName: after, gameName: '', before, after });
  };

  return {
    state: async () => snapshot(),
    async send(body) {
      const at = new Date().toISOString();
      const actor = db.players.find((p) => p.id === body.actorId);
      const entry = { at, actorId: actor?.id || '', actorName: actor?.name || 'невідомо', device: body.device === 'phone' ? 'телефон' : 'комп’ютер' };

      if (body.action === 'addPlayer') {
        const name = String(body.name).replace(/\s+/g, ' ').trim();
        if (!name || name.length > 24) throw new Error('Ім’я має бути від 1 до 24 символів');
        if (db.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('Гравець з таким ім’ям уже є. Додайте, наприклад, першу літеру прізвища.');
        db.players.push({ id: `p${db.players.length + 1}`, name, active: true });
        db.log.unshift({ ...entry, action: 'player', date: todayKyiv(), playerName: name, gameName: '', before: '', after: 'новий гравець' });
        return snapshot();
      }

      const game = db.games.find((g) => g.id === body.gameId);
      const player = db.players.find((p) => p.id === body.playerId);
      if (body.date > todayKyiv()) throw new Error('Не можна вносити результати за майбутні дні');
      const index = db.results.findIndex((r) => r.date === body.date && r.playerId === player.id && r.gameId === game.id);
      const old = db.results[index];
      const log = (action, before, after) => db.log.unshift({ ...entry, action, date: body.date, playerName: player.name, gameName: game.name, before, after });

      if (body.action === 'deleteResult') {
        if (old) {
          db.results.splice(index, 1);
          log('delete', describeResult(game, old), '');
          syncChampion(body.date.slice(0, 7), entry);
        }
        return snapshot();
      }
      const solved = body.solved !== false;
      const value = solved ? Number(body.value) : 0;
      const { min, max } = valueLimits(game);
      if (solved && !isValidValue(game, value)) throw new Error(`Результат: потрібне число від ${min} до ${max}`);
      const hints = game.hintPenalty ? Number(body.hints) || 0 : 0;
      if (!Number.isInteger(hints) || hints < 0) throw new Error('Підказки: потрібне ціле невід’ємне число');
      const r = { date: body.date, playerId: player.id, gameId: game.id, value, hints, solved };
      const next = { ...r, score: computeScore(game, r), updatedAt: at, updatedBy: entry.actorName };
      if (old && describeResult(game, old) === describeResult(game, next)) return snapshot();
      if (old) db.results[index] = next; else db.results.push(next);
      log(old ? 'edit' : 'add', old ? describeResult(game, old) : '', describeResult(game, next));
      syncChampion(body.date.slice(0, 7), entry);
      return snapshot();
    },
  };
}
