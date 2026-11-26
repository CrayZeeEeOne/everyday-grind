// Розбір share-тексту. Формати взяті зі справжніх прикладів (вони є в tests/tests.html).
// Angledle обробляється окремо (parseAngledle): у його тексті немає балів Guess.
export function parseShare(text) {
  const t = String(text).trim();
  let m;

  // Wordle 1 986 5/6
  if ((m = t.match(/^wordle\b[^\n]*?\s([1-6X])\/6/im))) return attempts('wordle', m[1]);

  // Krillion #134 🦐, очки окремим рядком
  if ((m = t.match(/^krillion\s+#\d+[^\n]*\n\s*(\d+)[ \t]*$/im))) return points('krillion', m[1]);

  // Plain Game #034 — ✈️ 4,802 m
  if ((m = t.match(/^plain(?:\s+game)?\s+#\d+\D*?(\d[\d.,\s]*?)\s*m\b/im))) return points('plain', m[1]);

  // Chainle #99 · 2,660 🔗
  if ((m = t.match(/^chainle\s+#\d+\D*?(\d[\d.,  ]*)/im))) return points('chainle', m[1]);

  // I played contexto.me 11/26/2026 and got it in 38 guesses. (з підказками: "... and 2 hints")
  if (/contexto/i.test(t)) {
    const hints = Number(t.match(/(\d+)\s+hints?/i)?.[1] || 0);
    if (/gave up/i.test(t)) return { gameId: 'contexto', value: 0, hints, solved: false };
    if ((m = t.match(/got it in\s+(\d+)\s+guess/i))) return { gameId: 'contexto', value: Number(m[1]), hints, solved: true };
  }

  // Globle: сітка квадратів закінчується "= 20"
  if (/globle/i.test(t) && (m = t.match(/=\s*(\d+)[ \t]*$/m))) return points('globle', m[1]);

  return null;
}

// Прибирає роздільники тисяч: "4,802" → 4802.
function points(gameId, raw) {
  return { gameId, value: Number(raw.replace(/\D/g, '')), hints: 0, solved: true };
}

function attempts(gameId, raw) {
  const failed = raw.toUpperCase() === 'X';
  return { gameId, value: failed ? 0 : Number(raw), hints: 0, solved: !failed };
}

// Angledle: Draw It та Higher or Lower є в тексті, а для Guess — лише номер спроби.
// Точні бали Guess залежать від похибки в градусах, тому їх треба спитати в гравця.
// Виняток — вгадано з першої спроби: тоді за формулою гри це завжди 100.
export function parseAngledle(text) {
  const t = String(text);
  if (!/^\s*angledle\b/im.test(t)) return null;
  const draw = t.match(/^\s*draw it\s+(\d+)\/100/im);
  const higherLower = t.match(/^\s*higher or lower\s+(\d+)\/100/im);
  if (!draw || !higherLower) return null;
  const firstTry = /^\s*guess\s+1\/6/im.test(t);
  return { draw: Number(draw[1]), higherLower: Number(higherLower[1]), guess: firstTry ? 100 : null };
}

// Так само, як на angledle.com: середнє трьох режимів з одним знаком після коми.
export function angledleTotal(guess, draw, higherLower) {
  return Math.round(((guess + draw + higherLower) / 3 + Number.EPSILON) * 10) / 10;
}
