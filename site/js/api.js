// Доступ до даних: або Apps Script, або демо-режим у localStorage.
import { createDemoBackend } from './demo.js';

const apiUrl = (window.EG_CONFIG?.apiUrl || '').trim();
export const isDemo = !apiUrl;
const demo = isDemo ? createDemoBackend() : null;
const CACHE = 'eg.cache';

export function cachedState() {
  if (isDemo) return null;
  try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; }
}

async function request(options) {
  let json;
  try {
    const res = await fetch(apiUrl, { redirect: 'follow', ...options });
    json = await res.json();
  } catch {
    throw new Error('Не вдалося зв’язатися з таблицею. Перевірте інтернет і спробуйте ще раз.');
  }
  if (!json.ok) throw new Error(json.error);
  localStorage.setItem(CACHE, JSON.stringify(json.data));
  return json.data;
}

export const loadState = () => (isDemo ? demo.state() : request());

// text/plain, щоб браузер не робив preflight-запит, який Apps Script не підтримує.
export function send(body) {
  const device = matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer';
  const payload = { ...body, device };
  if (isDemo) return demo.send(payload);
  return request({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
}
