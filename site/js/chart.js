// Графік накопиченої суми балів за місяць: одна вісь, лінії, перехрестя з підказкою.
import { html, num } from './html.js';
import { shortDate } from './dates.js';

const L = 48, R = 12, T = 12, B = 28, H = 260;

export function drawChart(box, dates, series) {
  const W = Math.max(280, box.clientWidth);
  const top = Math.max(100, ...series.flatMap((s) => s.points));
  const step = [50, 100, 200, 500, 1000, 2000, 5000, 10000].find((s) => top / s <= 4) || 20000;
  const max = Math.ceil(top / step) * step;
  const gap = (W - L - R) / Math.max(1, dates.length - 1);
  const x = (i) => (dates.length < 2 ? L + (W - L - R) / 2 : L + i * gap);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const every = Math.ceil(dates.length / Math.max(2, Math.floor(W / 80)));

  box.innerHTML = String(html`
    <svg width="${W}" height="${H}" role="img" aria-label="Накопичена сума балів за місяць">
      ${ticks.map((t) => html`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`)}
      ${dates.map((d, i) => (i % every === 0 ? html`<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${Number(d.slice(8))}</text>` : ''))}
      <line class="cross" y1="${T}" y2="${H - B}" x1="0" x2="0" visibility="hidden"/>
      ${series.map((s) => html`
        <polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" points="${s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>
        <circle class="dot" r="4" fill="${s.color}" cx="${x(dates.length - 1)}" cy="${y(s.points.at(-1))}"/>`)}
    </svg>
    <div class="tooltip" hidden></div>`);

  const svg = box.querySelector('svg'), cross = box.querySelector('.cross'), tip = box.querySelector('.tooltip');
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  const show = (e) => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(dates.length - 1, Math.round((px - L) / gap)));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    const rows = [...series].sort((a, b) => b.points[i] - a.points[i]);
    tip.innerHTML = String(html`<b>${shortDate(dates[i])}</b>${rows.map((s) => html`<span><i style="background:${s.color}"></i>${s.name}<em>${num(s.points[i])}</em></span>`)}`);
    tip.hidden = false;
    const left = x(i) + 12;
    tip.style.left = `${Math.max(0, left + tip.offsetWidth > W ? x(i) - tip.offsetWidth - 12 : left)}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}
