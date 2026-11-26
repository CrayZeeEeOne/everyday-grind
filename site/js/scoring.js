// Підрахунок балів. Та сама логіка є у формулі таблиці (apps-script/Code.gs → scoreFormula).
// Таблиця лишається головним джерелом: тут бали потрібні для демо-режиму та підказки під час вводу.

const SIX = '100|90|75|55|35|15';

// Ті самі значення за замовчуванням, що Code.gs записує у вкладку Config.
export const DEFAULT_GAMES = [
  { id: 'wordle', name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', type: 'table', max: 6, best: 1, hintPenalty: 0, table: SIX, unit: 'спроб', active: true },
  { id: 'globle', name: 'Globle', url: 'https://globle-game.com/', type: 'log', max: 100, best: 1, hintPenalty: 0, table: '', unit: 'спроб', active: true },
  { id: 'angledle', name: 'Angledle', url: 'https://angledle.com/', type: 'table', max: 6, best: 1, hintPenalty: 0, table: SIX, unit: 'спроб', active: true },
  { id: 'minecraftle', name: 'Minecraftle', url: 'https://minecraftle.zachmanson.com/', type: 'table', max: 10, best: 1, hintPenalty: 0, table: '100|90|80|70|60|50|40|30|20|10', unit: 'спроб', active: true },
  { id: 'krillion', name: 'Krillion', url: 'https://krillion.io/', type: 'linear', max: 700, best: 0, hintPenalty: 0, table: '', unit: 'очок', active: true },
  { id: 'plain', name: 'Plain', url: 'https://playplain.app/', type: 'linear', max: 1000, best: 0, hintPenalty: 0, table: '', unit: 'очок', active: true },
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

export function describeResult(game, r) {
  if (!r.solved) return 'не пройдено';
  let text = game.type === 'table' ? `${r.value}/${game.max}` : `${game.unit}: ${r.value}`;
  if (game.hintPenalty && r.hints) text += `, підказок: ${r.hints}`;
  return text;
}
