// Шаблони з автоматичним екрануванням: імена та дані з таблиці не стають HTML.
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const render = (v) => Array.isArray(v) ? v.map(render).join('') : v instanceof Safe ? v.s : v === null || v === undefined || v === false ? '' : escape(v);
export const html = (strings, ...values) => new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ''), ''));
export const num = (n) => Number(n).toLocaleString('uk-UA', { maximumFractionDigits: 1 });
export const safeUrl = (url) => (/^https?:\/\//i.test(url) ? url : '#');
