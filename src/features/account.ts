// @ts-nocheck
import { supabase } from "../lib/supabase";
import { $, esc, toast } from "../lib/util";
import { S, ui } from "../state";
import { LocalBackend } from "../storage/local";
import { SupabaseBackend } from "../storage/supabase";
import { init, allDocIds, P } from "../storage/persist";
import { render } from "../views/render";
import { backupJSON } from "./import";

/** Angemeldeter Nutzer (null im lokalen Modus). */
export const account = {
  user: null, name: "", busy: false, info: "", email: "",
  screen: "login" as "login" | "signup" | "reset" | "link",
  recovery: false,
  mode: "none" as "none" | "local" | "cloud", confirmWipe: false,
};

const MIN_PW = 8;
const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, "E-Mail oder Passwort ist falsch."],
  [/email not confirmed/i, "Bestätige zuerst deine E-Mail über den Link, den wir dir geschickt haben."],
  [/already registered|already been registered/i, "Für diese E-Mail gibt es schon ein Konto. Melde dich an oder setz dein Passwort zurück."],
  [/should be different/i, "Das neue Passwort muss sich vom alten unterscheiden."],
  [/at least|weak password|password should/i, `Das Passwort ist zu schwach. Nimm mindestens ${MIN_PW} Zeichen.`],
  [/rate limit|too many/i, "Zu viele Versuche. Warte kurz und probier es dann nochmal."],
];
const authMsg = (e) => { const m = String(e?.message || e || ""); const hit = AUTH_ERRORS.find(([re]) => re.test(m)); return hit ? hit[1] : "Das hat nicht geklappt: " + m; };
const redirectTo = () => location.origin + location.pathname;

const LOCAL_FLAG = "trackify-local-mode";

export async function boot(){
  if (!supabase){ return startLocal(); }
  listenAuth();
  const { data } = await supabase.auth.getSession();
  if (data.session) return startCloud(data.session.user);
  let local = false; try { local = localStorage.getItem(LOCAL_FLAG) === "1"; } catch {}
  if (local) return startLocal();
  account.mode = "none"; renderAccountChip(); renderLogin();
}

// Einmal registrieren: Login über einen anderen Tab, Passwort-Zurücksetzen per Link, Abmeldung
let listening = false;
function listenAuth(){
  if (listening || !supabase) return; listening = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY"){ account.recovery = true; location.hash = "konto"; }
    if (session && account.mode !== "cloud") startCloud(session.user);
    else if (event === "PASSWORD_RECOVERY") render();
  });
}

async function startLocal(){
  account.mode = "local"; account.user = null; renderAccountChip();
  await init(new LocalBackend());
}

async function startCloud(user){
  // Beim Laden melden sich getSession() und onAuthStateChange gleichzeitig. Nur einmal starten.
  if (account.mode === "cloud" && account.user?.id === user.id) return;
  account.mode = "cloud"; account.user = user;
  try { localStorage.removeItem(LOCAL_FLAG); } catch {}
  // Login-Parameter (?code=…) aus der Adresse entfernen, die Ansicht im Hash bleibt
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  if (!prof) await supabase.from("profiles").insert({ id: user.id, display_name: (user.email || "").split("@")[0] });
  account.name = prof?.display_name || (user.email || "").split("@")[0];
  renderAccountChip();
  await init(new SupabaseBackend(supabase, user.id));
}

function renderAccountChip(){
  const el = $("#account"); if (!el) return;
  el.hidden = account.mode === "none";
  el.textContent = account.mode === "cloud" ? (account.name || "Konto").slice(0, 18) : "Ohne Konto";
}

const inputStyle = "border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:10px 12px";

export function renderLogin(){
  const v = $("#view"), sc = account.screen, busy = account.busy;
  const email = `<label class="label" for="login-email">E-Mail</label><input id="login-email" name="email" type="email" required autocomplete="email" value="${esc(account.email)}" placeholder="du@beispiel.de" style="${inputStyle}">`;
  const forms = {
    login: `<form data-accform="login" style="display:flex;flex-direction:column;gap:10px">${email}
        <label class="label" for="login-pw">Passwort</label><input id="login-pw" name="password" type="password" required autocomplete="current-password" style="${inputStyle}">
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Anmelden…" : "Anmelden"}</button></form>
      <div class="row" style="justify-content:space-between"><button class="btn ghost" data-acc="screen" data-a="reset">Passwort vergessen?</button><button class="btn ghost" data-acc="screen" data-a="link">Mit E-Mail-Link anmelden</button></div>
      <p class="cap" style="margin:0">Noch kein Konto? <button class="btn ghost" style="padding:2px 6px" data-acc="screen" data-a="signup">Jetzt registrieren</button></p>`,
    signup: `<form data-accform="signup" style="display:flex;flex-direction:column;gap:10px">${email}
        <label class="label" for="login-pw">Passwort (mindestens ${MIN_PW} Zeichen)</label><input id="login-pw" name="password" type="password" required minlength="${MIN_PW}" autocomplete="new-password" style="${inputStyle}">
        <label class="label" for="login-pw2">Passwort wiederholen</label><input id="login-pw2" name="password2" type="password" required minlength="${MIN_PW}" autocomplete="new-password" style="${inputStyle}">
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Wird angelegt…" : "Konto anlegen"}</button></form>
      <button class="btn ghost" data-acc="screen" data-a="login">Ich habe schon ein Konto</button>`,
    reset: `<p class="cap" style="margin:0">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst. Das funktioniert auch, wenn du bisher nur mit E-Mail-Link angemeldet warst.</p>
      <form data-accform="reset" style="display:flex;flex-direction:column;gap:10px">${email}
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Wird gesendet…" : "Link zum Zurücksetzen schicken"}</button></form>
      <button class="btn ghost" data-acc="screen" data-a="login">Zurück zur Anmeldung</button>`,
    link: `<form data-accform="link" style="display:flex;flex-direction:column;gap:10px">${email}
        <button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Wird gesendet…" : "Anmelde-Link schicken"}</button></form>
      <button class="btn ghost" data-acc="screen" data-a="login">Mit Passwort anmelden</button>`,
  };
  v.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:14px;max-width:460px;margin:24px auto">
    <h2>${sc === "signup" ? "Konto anlegen" : sc === "reset" ? "Passwort zurücksetzen" : "Willkommen bei Trackify"}</h2>
    ${sc === "login" ? `<p class="muted" style="margin:0">Gewohnheiten, Monk Mode, Meditation und Training an einem Ort. Mit Konto sind deine Daten auf allen Geräten da.</p>` : ""}
    ${account.info ? `<div class="banner" style="margin:0">${account.info}</div>` : ""}
    ${forms[sc]}
    <button class="btn ghost" data-acc="local">Erst mal ohne Konto ausprobieren</button>
  </div>`;
}

/** Formulare der Anmeldung und des Passwort-Wechsels. */
export async function accSubmit(form){
  if (!supabase) return;
  const f = new FormData(form), kind = form.dataset.accform;
  const email = String(f.get("email") || "").trim(), pw = String(f.get("password") || ""), pw2 = String(f.get("password2") || "");
  if (email) account.email = email;
  if ((kind === "signup" || kind === "newpw") && pw !== pw2){ toast("Die Passwörter stimmen nicht überein."); return; }
  if ((kind === "signup" || kind === "newpw") && pw.length < MIN_PW){ toast(`Nimm mindestens ${MIN_PW} Zeichen.`); return; }
  account.busy = true; account.info = ""; kind === "newpw" ? render() : renderLogin();
  let error = null;
  if (kind === "login") ({ error } = await supabase.auth.signInWithPassword({ email, password: pw }));
  else if (kind === "signup"){
    const r = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: redirectTo() } });
    error = r.error;
    if (!error && !r.data.session) account.info = `Fast geschafft: Wir haben dir an <b>${esc(email)}</b> einen Link geschickt. Bestätige damit einmal deine E-Mail, danach meldest du dich mit E-Mail und Passwort an.`;
  }
  else if (kind === "reset"){
    ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }));
    if (!error) account.info = `Wir haben dir an <b>${esc(email)}</b> einen Link geschickt. Öffne ihn und leg dort dein neues Passwort fest.`;
  }
  else if (kind === "link"){
    ({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } }));
    if (!error) account.info = `Wir haben dir einen Anmelde-Link an <b>${esc(email)}</b> geschickt. Öffne ihn in diesem Browser.`;
  }
  else if (kind === "newpw"){
    ({ error } = await supabase.auth.updateUser({ password: pw }));
    if (!error){ account.recovery = false; toast("Passwort gespeichert. Ab jetzt meldest du dich mit E-Mail und Passwort an."); }
  }
  account.busy = false;
  if (error) toast(authMsg(error));
  if (kind === "newpw") render(); else if (account.mode === "none") renderLogin();
}

export function vAccount(){
  if (account.mode === "none") return "";
  const cloud = account.mode === "cloud";
  return `<h2>Konto</h2>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    ${cloud ? `<p style="margin:0">Angemeldet als <b>${esc(account.user.email || "")}</b></p>
      <div class="field"><label class="label" for="acc-name">Anzeigename</label><div class="row"><input id="acc-name" maxlength="40" value="${esc(account.name)}" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px;flex:1;min-width:0"><button class="btn" data-acc="name">Speichern</button></div></div>
      <div class="row"><button class="btn" data-acc="logout">Abmelden</button></div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px${account.recovery ? ";border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)" : ""}">
      <h3>${account.recovery ? "Neues Passwort festlegen" : "Passwort"}</h3>
      <p class="cap" style="margin:0">${account.recovery ? "Du hast den Link zum Zurücksetzen geöffnet. Leg jetzt dein neues Passwort fest." : "Leg ein Passwort fest oder ändere es. Danach kannst du dich mit E-Mail und Passwort anmelden statt mit einem Link."}</p>
      <form data-accform="newpw" style="display:flex;flex-direction:column;gap:10px;max-width:360px">
        <input type="email" name="email" value="${esc(account.user.email || "")}" autocomplete="username" hidden>
        <label class="label" for="acc-pw">Neues Passwort (mindestens ${MIN_PW} Zeichen)</label><input id="acc-pw" name="password" type="password" required minlength="${MIN_PW}" autocomplete="new-password" style="${inputStyle}">
        <label class="label" for="acc-pw2">Passwort wiederholen</label><input id="acc-pw2" name="password2" type="password" required minlength="${MIN_PW}" autocomplete="new-password" style="${inputStyle}">
        <div class="row"><button class="btn primary" type="submit" ${account.busy ? "disabled" : ""}>${account.busy ? "Wird gespeichert…" : "Passwort speichern"}</button></div>
      </form>`
    : `<p style="margin:0">Du nutzt Trackify ohne Konto. Deine Daten liegen nur in diesem Browser.</p>
      ${supabase ? `<div class="row"><button class="btn primary" data-acc="tologin">Konto anlegen oder anmelden</button></div><p class="cap" style="margin:0">Tipp: Mach vorher unter Import &amp; Backup ein Backup. Nach der Anmeldung kannst du es dort wieder importieren.</p>` : ""}`}
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <h3>Deine Daten</h3>
    <p class="cap" style="margin:0">${cloud ? "Deine Daten liegen in einer Datenbank, auf die nur dein Konto Zugriff hat." : ""} Als JSON-Datei kannst du alles jederzeit mitnehmen.</p>
    <div class="row"><button class="btn" data-export>Backup speichern</button>
    ${account.confirmWipe ? `<span class="muted" style="font-size:13px">Wirklich alles löschen? Das lässt sich nicht rückgängig machen.</span><button class="btn danger" data-acc="wipeok">Endgültig löschen</button><button class="btn ghost" data-acc="wipeno">Abbrechen</button>` : `<button class="btn danger" data-acc="wipe">Alle Daten löschen</button>`}</div>
  </div>`;
}

export async function accAction(a, arg){
  switch (a){
    case "screen": account.screen = arg || "login"; account.info = ""; { const em = $("#login-email"); if (em) account.email = em.value.trim(); } return renderLogin();
    case "local": try { localStorage.setItem(LOCAL_FLAG, "1"); } catch {} location.hash = "heute"; return startLocal();
    case "tologin": try { localStorage.removeItem(LOCAL_FLAG); } catch {} account.mode = "none"; S.loaded = false; renderAccountChip(); return renderLogin();
    case "logout": await supabase.auth.signOut(); location.reload(); return;
    case "name": {
      const v = ($("#acc-name").value || "").trim().slice(0, 40); if (!v) return;
      const { error } = await supabase.from("profiles").update({ display_name: v }).eq("id", account.user.id);
      if (error){ toast("Name konnte nicht gespeichert werden."); return; }
      account.name = v; renderAccountChip(); toast("Gespeichert."); return;
    }
    case "wipe": account.confirmWipe = true; return render();
    case "wipeno": account.confirmWipe = false; return render();
    case "wipeok": {
      account.confirmWipe = false;
      if (account.mode === "cloud"){
        const { error } = await supabase.from("docs").delete().eq("user_id", account.user.id);
        if (error){ toast("Löschen fehlgeschlagen."); return; }
      } else { try { localStorage.removeItem("trackify-docs-v1"); } catch {} }
      location.reload(); return;
    }
  }
}

/** Für den Import eines Backups in ein frisches Konto: alles als geändert markieren. */
export function markAllDirty(){ allDocIds().forEach(id => P.dirty.add(id)); }
export { backupJSON };
