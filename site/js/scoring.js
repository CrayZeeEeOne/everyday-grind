// Підрахунок балів. Та сама логіка є у формулі таблиці (apps-script/Code.gs → scoreFormula).
// Таблиця лишається головним джерелом: тут бали потрібні для демо-режиму та підказки під час вводу.

const SIX = '100|90|75|55|35|15';

// Ті самі значення за замовчуванням, що Code.gs записує у вкладку Config.
export const DEFAULT_GAMES = [
  { id: 'wordle', name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', type: 'table', max: 6, best: 1, hintPenalty: 0, table: SIX, unit: 'спроб', active: true },
  { id: 'globle', name: 'Globle', url: 'https://globle-game.com/', type: 'log', max: 100, best: 1, hintPenalty: 0, table: '', unit: 'спроб', active: true },
  { id: 'angledle', name: 'Angledle', url: 'https://angledle.com/', type: 'linear', max: 100, best: 0, hintPenalty: 0, table: '', unit: '/100', active: true },
  { id: 'krillion', name: 'Krillion', url: 'https://krillion.io/', type: 'linear', max: 700, best: 0, hintPenalty: 0, table: '', unit: 'очок', active: true },
  { id: 'plain', name: 'Plain', url: 'https://playplain.app/', type: 'linear', max: 10000, best: 0, hintPenalty: 0, table: '', unit: 'м', active: true },
  { id: 'chainle', name: 'Chainle', url: 'https://chainle.io/', type: 'linear', max: 5000, best: 0, hintPenalty: 0, table: '', unit: 'очок', active: true },
  { id: 'contexto', name: 'Contexto', url: 'https://contexto.me/', type: 'log', max: 1000, best: 1, hintPenalty: 10, table: '', unit: 'спроб', active: true },
];

export const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;

export function computeScore(game, { value, hints = 0, solved = true }) {
  if (!solved) return 0;
  let base = 0;
  if (game.type === 'table') {
    base = Number(String(game.table).split('|')[value - 1] ?? 0);
  } else if (game.type === 'log') {
    base = 100 * (Math.log(game.max) - Math.log(Math.max(value, game.best))) / (Math.log(game.max) - Math.log(game.best));
  } else {
    base = 100 * value / game.max;
  }
  return round1(Math.max(0, Math.min(100, base - hints * (game.hintPenalty || 0))));
}

// Які значення дозволено вводити для гри.
export function valueLimits(game) {
  if (game.type === 'table') return { min: 1, max: String(game.table).split('|').length };
  if (game.type === 'linear') return { min: 0, max: game.max };
  return { min: 1, max: 100000 };
}

// Одиниця "/100" означає загальний бал, який гра показує з десятими (78.7).
export const allowsTenths = (game) => game.unit === '/100';

export function isValidValue(game, n) {
  const { min, max } = valueLimits(game);
  const scaled = allowsTenths(game) ? n * 10 : n;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9 && n >= min && n <= max;
}

export function describeResult(game, r) {
  if (!r.solved) return 'не пройдено';
  let text = game.type === 'table' ? `${r.value}/${game.max}`
    : allowsTenths(game) ? `${r.value}/100`
    : game.unit === 'м' ? `${r.value} м` : `${game.unit}: ${r.value}`;
  if (game.hintPenalty && r.hints) text += `, підказок: ${r.hints}`;
  return text;
}
