// Розбір share-тексту. Тут лише формати, які мають чіткий і впізнаваний вигляд.
// Щоб додати гру, потрібен справжній приклад її share-тексту.
export function parseShare(text) {
  const t = String(text).trim();
  let m;

  // Wordle 1,621 3/6*   |   Wordle 1 621 X/6
  if ((m = t.match(/\bwordle\b[^\n]*?\s([1-6X])\/6/i))) return attempts('wordle', m[1]);

  if ((m = t.match(/angledle[^\n]*?\s([1-6X])\/6/i))) return attempts('angledle', m[1]);

  if ((m = t.match(/minecraftle[\s\S]*?\b(10|[1-9]|X)\/10/i))) return attempts('minecraftle', m[1]);

  // I played contexto.me #650 and got it in 23 guesses and 2 hints.
  if (/contexto/i.test(t)) {
    const hints = Number(t.match(/(\d+)\s+hints?/i)?.[1] || 0);
    if (/gave up/i.test(t)) return { gameId: 'contexto', value: 0, hints, solved: false };
    if ((m = t.match(/got it in\s+(\d+)\s+guess/i))) return { gameId: 'contexto', value: Number(m[1]), hints, solved: true };
  }

  // Globle: рядок "... = 7"
  if (/globle/i.test(t) && (m = t.match(/=\s*(\d+)\s*$/m))) return { gameId: 'globle', value: Number(m[1]), hints: 0, solved: true };

  return null;
}

function attempts(gameId, raw) {
  const failed = raw.toUpperCase() === 'X';
  return { gameId, value: failed ? 0 : Number(raw), hints: 0, solved: !failed };
}
