// Рейтинги дня й місяця, стріки, рекорди, бейджі.
import { round1 } from './scoring.js';

// Місце = 1 + кількість тих, у кого строго більше очок (однакові суми ділять місце).
function withPlaces(rows, compare) {
  rows.sort(compare);
  rows.forEach((row, i) => {
    row.place = i > 0 && compare(rows[i - 1], row) === 0 ? rows[i - 1].place : i + 1;
  });
  return rows;
}

export function dayStandings(results, date) {
  const byPlayer = new Map();
  for (const r of results) {
    if (r.date !== date) continue;
    const row = byPlayer.get(r.playerId) || { playerId: r.playerId, total: 0, games: {} };
    row.total = round1(row.total + r.score);
    row.games[r.gameId] = r;
    byPlayer.set(r.playerId, row);
  }
  return withPlaces([...byPlayer.values()], (a, b) => b.total - a.total);
}

export const dayWinners = (standings) => standings.filter((s) => s.place === 1 && s.total > 0);

export const allDates = (results) => [...new Set(results.map((r) => r.date))].sort();

export function monthStandings(results, month) {
  const inMonth = results.filter((r) => r.date.startsWith(month));
  const rows = new Map();
  for (const date of allDates(inMonth)) {
    for (const s of dayStandings(inMonth, date)) {
      const row = rows.get(s.playerId) || { playerId: s.playerId, total: 0, wins: 0, days: 0 };
      row.total = round1(row.total + s.total);
      row.days += 1;
      if (s.place === 1 && s.total > 0) row.wins += 1;
      rows.set(s.playerId, row);
    }
  }
  // Спочатку сума балів, при рівності — кількість перемог у днях.
  return withPlaces([...rows.values()], (a, b) => b.total - a.total || b.wins - a.wins);
}

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Поточний стрік живий, якщо гравець грав сьогодні або вчора.
export function streaks(results, playerId, today) {
  const dates = allDates(results.filter((r) => r.playerId === playerId));
  let best = 0, run = 0, prev = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const alive = prev === today || prev === addDays(today, -1);
  return { current: alive ? run : 0, best };
}

// Особистий рекорд: найвищий бал; при рівності — кращий сирий результат.
export function personalBest(results, playerId, game) {
  let best = null;
  for (const r of results) {
    if (r.playerId !== playerId || r.gameId !== game.id || !r.solved) continue;
    const better = !best || r.score > best.score ||
      (r.score === best.score && (game.type === 'linear' ? r.value > best.value : r.value < best.value));
    if (better) best = r;
  }
  return best;
}

export function badges(results, playerId, games) {
  const mine = results.filter((r) => r.playerId === playerId);
  const activeIds = games.filter((g) => g.active).map((g) => g.id);
  const perDay = new Map();
  for (const r of mine) {
    if (!perDay.has(r.date)) perDay.set(r.date, new Set());
    perDay.get(r.date).add(r.gameId);
  }
  const fullDays = [...perDay.values()].filter((set) => activeIds.every((id) => set.has(id))).length;
  const wordleAce = mine.filter((r) => r.gameId === 'wordle' && r.solved && r.value <= 2).length;
  const perfect = mine.filter((r) => r.score === 100).length;
  const contextoClean = mine.filter((r) => r.gameId === 'contexto' && r.solved && !r.hints && r.value <= 20).length;
  const longest = streaks(results, playerId, '9999-12-31').best;
  return [
    { label: 'Повний комплект', hint: 'Усі ігри за один день', count: fullDays },
    { label: 'Сотка', hint: '100 балів в одній грі', count: perfect },
    { label: 'Wordle-снайпер', hint: 'Wordle за 1–2 спроби', count: wordleAce },
    { label: 'Чуйка', hint: 'Contexto до 20 спроб без підказок', count: contextoClean },
    { label: 'Тиждень без пропусків', hint: 'Стрік 7 днів і більше', count: longest >= 7 ? 1 : 0 },
  ].filter((b) => b.count > 0);
}
