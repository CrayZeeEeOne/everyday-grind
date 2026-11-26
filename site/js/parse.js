// Розбір share-тексту. Формати взяті зі справжніх прикладів (вони є в tests/tests.html).
export function parseShare(text) {
  const t = String(text).trim();
  let m;

  // Wordle 1 986 5/6
  if ((m = t.match(/^wordle\b[^\n]*?\s([1-6X])\/6/im))) return attempts('wordle', m[1]);

  // Angledle #1790, а далі "Guess 6/6 ...". Інші міні-ігри з цього тексту не враховуються.
  if (/^angledle\b/im.test(t) && (m = t.match(/^guess\s+([1-6X])\/6/im))) return attempts('angledle', m[1]);

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

// Усі результати з одного тексту: Angledle ділиться одразу трьома режимами.
export function parseShareAll(text) {
  const main = parseShare(text);
  const found = main ? [main] : [];
  const t = String(text);
  if (/^\s*angledle\b/im.test(t)) {
    for (const [gameId, line] of [['angledraw', /^\s*draw it\s+(\d+)\/100/im], ['anglehl', /^\s*higher or lower\s+(\d+)\/100/im]]) {
      const m = t.match(line);
      if (m) found.push(points(gameId, m[1]));
    }
  }
  return found;
}
