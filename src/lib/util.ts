// @ts-nocheck

// ---------- utils ----------
export const $ = s => document.querySelector(s);

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export const pad = n => String(n).padStart(2, "0");

export const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export const fromKey = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y, m-1, d, 12); };

export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate()+n); return keyOf(d); };

export const wdOf = k => (fromKey(k).getDay()+6)%7;

// 0 = Mo
export const todayKey = () => keyOf(new Date());

export const uid = () => Math.random().toString(36).slice(2,10);

export const WD = ["Mo","Di","Mi","Do","Fr","Sa","So"];

export const WD_LONG = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

export const MON = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export const MON_S = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

export const NCOL = 6;

export const CHECK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

let toastT: any = null;
export function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, 3200); }
