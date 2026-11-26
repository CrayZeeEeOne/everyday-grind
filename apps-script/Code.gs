/**
 * Everyday Grind: Google Sheet як база даних + API для сайту.
 * Перший запуск: оберіть функцію setup і натисніть "Run".
 */

// Europe/Kiev — стара назва Europe/Kyiv, її гарантовано розуміє Apps Script.
var TZ = 'Europe/Kiev';
var LOG_LIMIT = 300;

var SHEETS = {
  Players: ['id', 'name', 'active', 'createdAt'],
  Config: ['id', 'name', 'url', 'type', 'max', 'best', 'hintPenalty', 'table', 'unit', 'active'],
  Results: ['key', 'date', 'playerId', 'gameId', 'value', 'hints', 'solved', 'score', 'createdAt', 'updatedAt', 'updatedBy'],
  Log: ['at', 'actorId', 'actorName', 'device', 'action', 'date', 'playerName', 'gameName', 'before', 'after'],
  Daily: ['date', 'playerId', 'rawTotal', 'games', 'name', 'total', 'place', 'month', 'win'],
  Monthly: ['month', 'playerId', 'total', 'dayWins', 'days', 'name'],
  Champions: ['month', 'playerId', 'name', 'total', 'dayWins', 'recordedAt']
};

// Колонки, які таблиця не повинна перетворювати на дати чи числа.
var TEXT_COLUMNS = {
  Players: ['A', 'B', 'D'],
  Config: ['A', 'H'],
  Results: ['A', 'B', 'C', 'D', 'I', 'J', 'K'],
  Log: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  Champions: ['A', 'B', 'C', 'F']
};

var SIX = '100|90|75|55|35|15';
var DEFAULT_CONFIG = [
  ['wordle', 'Wordle', 'https://www.nytimes.com/games/wordle/index.html', 'table', 6, 1, 0, SIX, 'спроб', true],
  ['globle', 'Globle', 'https://globle-game.com/', 'log', 100, 1, 0, '', 'спроб', true],
  ['angledle', 'Angledle', 'https://angledle.com/', 'linear', 100, 0, 0, '', '/100', true],
  ['krillion', 'Krillion', 'https://krillion.io/', 'linear', 700, 0, 0, '', 'очок', true],
  ['plain', 'Plain', 'https://playplain.app/', 'linear', 10000, 0, 0, '', 'м', true],
  ['chainle', 'Chainle', 'https://chainle.io/', 'linear', 5000, 0, 0, '', 'очок', true],
  ['contexto', 'Contexto', 'https://contexto.me/', 'minus', 101, 1, 10, '', 'спроб', true],
  ['sizeitup', 'Size It Up', 'https://magnitudle.com/size-it-up', 'linear', 500, 0, 0, '', 'очок', true]
];

/* ---------- Налаштування ---------- */

// Безпечно запускати повторно: наявні дані не стираються.
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone(TZ);

  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    (TEXT_COLUMNS[name] || []).forEach(function (col) {
      sh.getRange(col + ':' + col).setNumberFormat('@');
    });
  });

  var config = ss.getSheetByName('Config');
  if (config.getLastRow() < 2) {
    config.getRange(2, 1, DEFAULT_CONFIG.length, DEFAULT_CONFIG[0].length).setValues(DEFAULT_CONFIG);
  }

  setupFormulas_(ss);
  refreshResultFormulas_();

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monthlyChampionJob') ScriptApp.deleteTrigger(t);
  });
  // 1-го числа кожного місяця приблизно о 00:05 за Києвом.
  ScriptApp.newTrigger('monthlyChampionJob').timeBased()
    .onMonthDay(1).atHour(0).nearMinute(5).inTimezone(TZ).create();
}

// Оновлює формули балів у вже внесених результатах після змін у коді.
function refreshResultFormulas_() {
  var sh = sheet_('Results');
  readTable_('Results').forEach(function (r) {
    sh.getRange(r._row, 8).setFormula(scoreFormula_(r._row));
  });
}

function setupFormulas_(ss) {
  var daily = ss.getSheetByName('Daily');
  daily.getRange('A2:I').clearContent();
  daily.getRange('A2').setFormula(
    '=IFERROR(QUERY({Results!A2:K}, "select Col2, Col3, sum(Col8), count(Col4) where Col2 is not null ' +
    'group by Col2, Col3 order by Col2 desc, sum(Col8) desc label sum(Col8) \'\', count(Col4) \'\'", 0), "")');
  daily.getRange('E2').setFormula('=ARRAYFORMULA(IF(B2:B="", , IFERROR(VLOOKUP(B2:B, Players!A:B, 2, FALSE), B2:B)))');
  daily.getRange('F2').setFormula('=ARRAYFORMULA(IF(B2:B="", , IFERROR(ROUND(C2:C, 1), 0)))');
  daily.getRange('G2').setFormula('=ARRAYFORMULA(IF(B2:B="", , COUNTIFS(A2:A, A2:A, F2:F, ">"&F2:F) + 1))');
  daily.getRange('H2').setFormula('=ARRAYFORMULA(IF(B2:B="", , LEFT(A2:A, 7)))');
  daily.getRange('I2').setFormula('=ARRAYFORMULA(IF(B2:B="", , IF((G2:G=1) * (F2:F>0), 1, 0)))');

  var monthly = ss.getSheetByName('Monthly');
  monthly.getRange('A2:F').clearContent();
  monthly.getRange('A2').setFormula(
    '=IFERROR(QUERY({Daily!H2:H, Daily!B2:B, Daily!F2:F, Daily!I2:I}, "select Col1, Col2, sum(Col3), sum(Col4), count(Col3) ' +
    'where Col2 is not null group by Col1, Col2 order by Col1 desc, sum(Col3) desc, sum(Col4) desc ' +
    'label sum(Col3) \'\', sum(Col4) \'\', count(Col3) \'\'", 0), "")');
  monthly.getRange('F2').setFormula('=ARRAYFORMULA(IF(B2:B="", , IFERROR(VLOOKUP(B2:B, Players!A:B, 2, FALSE), B2:B)))');
}

// Бал за один результат (0–100). Параметри беруться з вкладки Config.
function scoreFormula_(r) {
  return ('=IF($G{r}<>TRUE, 0, LET(' +
    'cfg, MATCH($D{r}, Config!$A:$A, 0), ' +
    'kind, INDEX(Config!$D:$D, cfg), ' +
    'top, INDEX(Config!$E:$E, cfg), ' +
    'low, INDEX(Config!$F:$F, cfg), ' +
    'penalty, N(INDEX(Config!$G:$G, cfg)), ' +
    'points, IF(kind="table", IFERROR(INDEX(SPLIT(INDEX(Config!$H:$H, cfg), "|"), 1, $E{r}), 0), ' +
    'IF(kind="log", 100*(LN(top)-LN(MAX($E{r}, low)))/(LN(top)-LN(low)), ' +
    'IF(kind="minus", top-$E{r}, 100*$E{r}/top))), ' +
    'ROUND(MAX(0, MIN(100, points - $F{r}*penalty)), 1)))').replace(/\{r\}/g, r);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Everyday Grind')
    .addItem('Записати чемпіонів за минулі місяці', 'monthlyChampionJob')
    .addItem('Перерахувати чемпіона минулого місяця', 'recalculateLastMonth')
    .addToUi();
}

/* ---------- Чемпіон місяця ---------- */

// Записує чемпіона за кожен завершений місяць, якого ще немає в Champions.
// Уже записаних не чіпає, тому повторний запуск безпечний.
function monthlyChampionJob() {
  withLock_(function () {
    var current = today_().slice(0, 7);
    var results = readTable_('Results');
    var done = {};
    readTable_('Champions').forEach(function (c) { done[c.month] = true; });
    var months = {};
    results.forEach(function (r) {
      var m = String(r.date).slice(0, 7);
      if (m < current && !done[m]) months[m] = true;
    });
    Object.keys(months).sort().forEach(function (m) { syncChampion_(m, SHEET_ACTOR); });
  });
}

// Потрібно лише після ручних правок у самій таблиці: зміни з сайту враховуються автоматично.
function recalculateLastMonth() {
  withLock_(function () {
    var d = new Date(today_().slice(0, 7) + '-01T12:00:00Z');
    d.setUTCDate(0);
    syncChampion_(d.toISOString().slice(0, 7), SHEET_ACTOR);
  });
}

var SHEET_ACTOR = { id: '', name: 'таблиця', device: '' };

function monthStandings_(results, month) {
  var days = {};
  results.forEach(function (r) {
    var date = String(r.date);
    if (date.slice(0, 7) !== month) return;
    days[date] = days[date] || {};
    days[date][r.playerId] = (days[date][r.playerId] || 0) + Number(r.score || 0);
  });
  var rows = {};
  Object.keys(days).forEach(function (date) {
    var totals = days[date];
    var ids = Object.keys(totals);
    var max = Math.max.apply(null, ids.map(function (id) { return round1_(totals[id]); }));
    ids.forEach(function (id) {
      var row = rows[id] || (rows[id] = { playerId: id, total: 0, wins: 0 });
      row.total = round1_(row.total + round1_(totals[id]));
      if (max > 0 && round1_(totals[id]) === max) row.wins++;
    });
  });
  return Object.keys(rows).map(function (id) { return rows[id]; })
    .sort(function (a, b) { return b.total - a.total || b.wins - a.wins; });
}

// Приводить записи про чемпіона завершеного місяця у відповідність до результатів.
function syncChampion_(month, actor) {
  if (month >= today_().slice(0, 7)) return;
  SpreadsheetApp.flush(); // нові формули мають порахуватися до читання
  var table = monthStandings_(readTable_('Results'), month);
  // Повна нічия (і бали, і перемоги) дає кількох чемпіонів.
  var winners = !table.length || table[0].total <= 0 ? [] :
    table.filter(function (r) { return r.total === table[0].total && r.wins === table[0].wins; });
  var old = readTable_('Champions').filter(function (c) { return c.month === month; });

  var signature = function (id, total, wins) { return id + '|' + total + '|' + wins; };
  var was = old.map(function (c) { return signature(c.playerId, Number(c.total), Number(c.dayWins)); }).sort().join();
  var will = winners.map(function (w) { return signature(w.playerId, w.total, w.wins); }).sort().join();
  if (was === will) return;

  var sh = sheet_('Champions');
  for (var i = old.length - 1; i >= 0; i--) sh.deleteRow(old[i]._row);
  var names = playerNames_();
  var now = new Date().toISOString();
  var newNames = winners.map(function (w) { return names[w.playerId] || w.playerId; });
  winners.forEach(function (w, i) {
    appendRow_('Champions', [month, w.playerId, newNames[i], w.total, w.wins, now]);
  });

  // Якщо титул перейшов до іншого гравця, це має бути видно в журналі.
  var before = old.map(function (c) { return c.name; }).sort().join(', ');
  var after = newNames.slice().sort().join(', ');
  if (old.length && before !== after) log_(actor, 'champion', month + '-01', after, '', before, after);
}

/* ---------- API ---------- */

function doGet() {
  return respond_(function () { return state_(); });
}

function doPost(e) {
  return respond_(function () {
    var body = JSON.parse(e.postData.contents);
    var handlers = { saveResult: saveResult_, deleteResult: deleteResult_, addPlayer: addPlayer_ };
    if (!handlers.hasOwnProperty(body.action)) throw new Error('Невідома дія');
    withLock_(function () { handlers[body.action](body); });
    return state_();
  });
}

function respond_(fn) {
  var out;
  try {
    out = { ok: true, data: fn() };
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function state_() {
  SpreadsheetApp.flush(); // щоб формули встигли порахувати бали
  var strip = function (rows) {
    return rows.map(function (r) { delete r._row; return r; });
  };
  return {
    today: today_(),
    players: strip(readTable_('Players')).map(function (p) {
      return { id: p.id, name: p.name, active: isTrue_(p.active) };
    }),
    games: strip(readTable_('Config')).map(function (g) {
      g.max = Number(g.max); g.best = Number(g.best); g.hintPenalty = Number(g.hintPenalty);
      g.table = String(g.table); g.active = isTrue_(g.active);
      return g;
    }),
    results: strip(readTable_('Results')).map(function (r) {
      return {
        date: String(r.date), playerId: r.playerId, gameId: r.gameId,
        value: Number(r.value), hints: Number(r.hints), solved: isTrue_(r.solved),
        score: Number(r.score) || 0, updatedAt: r.updatedAt, updatedBy: r.updatedBy
      };
    }),
    champions: strip(readTable_('Champions')).map(function (c) {
      return { month: c.month, playerId: c.playerId, name: c.name, total: Number(c.total), wins: Number(c.dayWins) };
    }),
    log: strip(readTable_('Log')).slice(-LOG_LIMIT).reverse()
  };
}

function saveResult_(body) {
  var game = findById_('Config', body.gameId, 'Невідома гра');
  var player = findById_('Players', body.playerId, 'Невідомий гравець');
  var date = checkDate_(body.date);
  var solved = body.solved !== false;
  var hints = Number(game.hintPenalty) > 0 ? checkInt_(body.hints || 0, 0, 1000, 'Підказки') : 0;
  var value = 0;
  if (solved) {
    var min = game.type === 'linear' ? 0 : 1;
    var max = game.type === 'table' ? String(game.table).split('|').length
      : game.type === 'linear' ? Number(game.max) : 100000;
    // Одиниця "/100" означає загальний бал із десятими (78.7).
    value = game.unit === '/100' ? checkTenths_(body.value, min, max, 'Результат') : checkInt_(body.value, min, max, 'Результат');
  }

  var key = date + '|' + player.id + '|' + game.id;
  var sh = sheet_('Results');
  var old = readTable_('Results').filter(function (r) { return r.key === key; })[0];
  var before = old ? describe_(game, old) : '';
  var after = describe_(game, { value: value, hints: hints, solved: solved });
  if (old && before === after) return;

  var now = new Date().toISOString();
  var actor = actor_(body);
  var row = old ? old._row : sh.getLastRow() + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
  sh.getRange(row, 1, 1, 7).setValues([[key, date, player.id, game.id, value, hints, solved]]);
  sh.getRange(row, 8).setFormula(scoreFormula_(row));
  sh.getRange(row, 9, 1, 3).setValues([[old ? old.createdAt : now, now, actor.name]]);

  log_(actor, old ? 'edit' : 'add', date, player.name, game.name, before, after);
  syncChampion_(date.slice(0, 7), actor);
}

function deleteResult_(body) {
  var game = findById_('Config', body.gameId, 'Невідома гра');
  var player = findById_('Players', body.playerId, 'Невідомий гравець');
  var date = checkDate_(body.date);
  var key = date + '|' + player.id + '|' + game.id;
  var old = readTable_('Results').filter(function (r) { return r.key === key; })[0];
  if (!old) return;
  sheet_('Results').deleteRow(old._row);
  var actor = actor_(body);
  log_(actor, 'delete', date, player.name, game.name, describe_(game, old), '');
  syncChampion_(date.slice(0, 7), actor);
}

function addPlayer_(body) {
  var name = String(body.name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 24) throw new Error("Ім'я має бути від 1 до 24 символів");
  // Такий початок таблиця сприйняла б як формулу.
  if (/^[=+\-@']/.test(name)) throw new Error("Ім'я не може починатися з = + - @ '");
  var players = readTable_('Players');
  var lower = name.toLowerCase();
  if (players.some(function (p) { return String(p.name).toLowerCase() === lower; })) {
    throw new Error('Гравець з таким ім\'ям уже є. Додайте, наприклад, першу літеру прізвища.');
  }
  var next = players.reduce(function (m, p) { return Math.max(m, Number(String(p.id).slice(1)) || 0); }, 0) + 1;
  var id = 'p' + next;
  appendRow_('Players', [id, name, true, new Date().toISOString()]);
  var actor = actor_(body);
  log_(actor.id ? actor : { id: id, name: name, device: actor.device }, 'player', today_(), name, '', '', 'новий гравець');
}

/* ---------- Допоміжне ---------- */

function describe_(game, r) {
  if (!isTrue_(r.solved)) return 'не пройдено';
  var text = game.type === 'table' ? r.value + '/' + game.max
    : game.unit === '/100' ? r.value + '/100'
    : game.unit === 'м' ? r.value + ' м' : game.unit + ': ' + r.value;
  if (Number(game.hintPenalty) && Number(r.hints)) text += ', підказок: ' + r.hints;
  return text;
}

function actor_(body) {
  var id = String(body.actorId || '');
  var names = playerNames_();
  var known = names.hasOwnProperty(id);
  return {
    id: known ? id : '',
    name: known ? names[id] : 'невідомо',
    device: body.device === 'phone' ? 'телефон' : 'комп\'ютер'
  };
}

function log_(actor, action, date, playerName, gameName, before, after) {
  appendRow_('Log', [new Date().toISOString(), actor.id, actor.name, actor.device, action, date, playerName, gameName, before, after]);
}

function playerNames_() {
  var names = {};
  readTable_('Players').forEach(function (p) { names[p.id] = p.name; });
  return names;
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Немає вкладки ' + name + '. Запустіть функцію setup.');
  return sh;
}

function readTable_(name) {
  var values = sheet_(name).getDataRange().getValues();
  var head = values.shift();
  var rows = [];
  values.forEach(function (v, i) {
    if (v[0] === '') return;
    var row = { _row: i + 2 };
    head.forEach(function (h, j) { if (h) row[h] = v[j]; });
    rows.push(row);
  });
  return rows;
}

function findById_(sheetName, id, message) {
  var found = readTable_(sheetName).filter(function (r) { return r.id === id; })[0];
  if (!found) throw new Error(message);
  return found;
}

function checkDate_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) {
    throw new Error('Неправильна дата');
  }
  if (date > today_()) throw new Error('Не можна вносити результати за майбутні дні');
  return date;
}

function checkTenths_(raw, min, max, label) {
  var n = Number(raw);
  if (raw === '' || raw === null || !isFinite(n) || Math.abs(n * 10 - Math.round(n * 10)) > 1e-9 || n < min || n > max) {
    throw new Error(label + ': потрібне число від ' + min + ' до ' + max + ', щонайбільше з одним знаком після коми');
  }
  return n;
}

function checkInt_(raw, min, max, label) {
  var n = Number(raw);
  if (raw === '' || raw === null || !isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
    throw new Error(label + ': потрібне ціле число від ' + min + ' до ' + max);
  }
  return n;
}

function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function round1_(n) { return Math.round((n + 1e-9) * 10) / 10; }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    fn();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// appendRow може перетворити "2026-10" чи "3/6" на дату, тому спершу задаємо формат.
function appendRow_(name, values) {
  var sh = sheet_(name);
  var row = sh.getLastRow() + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
  (TEXT_COLUMNS[name] || []).forEach(function (col) {
    sh.getRange(col + row).setNumberFormat('@');
  });
  sh.getRange(row, 1, 1, values.length).setValues([values]);
}
