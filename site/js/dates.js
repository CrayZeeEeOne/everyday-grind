// Усі дні й місяці рахуються за Києвом. Europe/Kiev розуміють і старі браузери.
const TZ = 'Europe/Kiev';
export const todayKyiv = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const noon = (date) => new Date(`${date}T12:00:00Z`);
const fmt = (opts) => new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC', ...opts });
export const longDate = (date) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(noon(date));
export const shortDate = (date) => fmt({ day: 'numeric', month: 'short' }).format(noon(date));
export function monthName(month) {
  const s = fmt({ month: 'long', year: 'numeric' }).format(noon(`${month}-15`)).replace(/\s*р\.$/, '');
  return s[0].toUpperCase() + s.slice(1);
}
export function shiftMonth(month, n) {
  const d = noon(`${month}-15`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export const stamp = (iso) => new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
