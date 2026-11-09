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
export const account = { user: null, name: "", sending: false, sent: "", mode: "none" as "none" | "local" | "cloud", confirmWipe: false };

const LOCAL_FLAG = "trackify-local-mode";

export async function boot(){
  if (!supabase){ return startLocal(); }
  const { data } = await supabase.auth.getSession();
  if (data.session) return startCloud(data.session.user);
  let local = false; try { local = localStorage.getItem(LOCAL_FLAG) === "1"; } catch {}
  if (local) return startLocal();
  account.mode = "none"; renderAccountChip(); renderLogin();
  supabase.auth.onAuthStateChange((_e, session) => { if (session && account.mode !== "cloud") startCloud(session.user); });
}

async function startLocal(){
  account.mode = "local"; account.user = null; renderAccountChip();
  await init(new LocalBackend());
}

async function startCloud(user){
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

export function renderLogin(){
  const v = $("#view");
  v.innerHTML = `<div class="card" style="display:flex;flex-direction:column;gap:14px;max-width:460px;margin:24px auto">
    <h2>Willkommen bei Trackify</h2>
    <p class="muted" style="margin:0">Gewohnheiten, Monk Mode, Meditation und Training an einem Ort. Melde dich mit deiner E-Mail an, dann sind deine Daten auf allen Geräten da. Ein Passwort brauchst du nicht.</p>
    ${account.sent ? `<div class="banner" style="margin:0">Wir haben dir einen Anmelde-Link an <b>${esc(account.sent)}</b> geschickt. Öffne ihn in diesem Browser.</div>` : ""}
    <form id="login-form" style="display:flex;flex-direction:column;gap:10px">
      <label class="label" for="login-email">E-Mail</label>
      <input id="login-email" type="email" required autocomplete="email" placeholder="du@beispiel.de" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:10px 12px">
      <button class="btn primary" type="submit" ${account.sending ? "disabled" : ""}>${account.sending ? "Wird gesendet…" : "Anmelde-Link schicken"}</button>
    </form>
    <button class="btn ghost" data-acc="local">Erst mal ohne Konto ausprobieren</button>
  </div>`;
}

export function vAccount(){
  if (account.mode === "none") return "";
  const cloud = account.mode === "cloud";
  return `<h2>Konto</h2>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    ${cloud ? `<p style="margin:0">Angemeldet als <b>${esc(account.user.email || "")}</b></p>
      <div class="field"><label class="label" for="acc-name">Anzeigename</label><div class="row"><input id="acc-name" maxlength="40" value="${esc(account.name)}" style="border:1px solid var(--line);border-radius:8px;background:var(--bg);padding:7px 10px;flex:1;min-width:0"><button class="btn" data-acc="name">Speichern</button></div></div>
      <div class="row"><button class="btn" data-acc="logout">Abmelden</button></div>`
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

export async function accAction(a){
  switch (a){
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

export async function sendLink(email){
  if (!supabase || !email) return;
  account.sending = true; renderLogin();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  account.sending = false;
  if (error){ toast("Der Link konnte nicht gesendet werden: " + error.message); renderLogin(); return; }
  account.sent = email; renderLogin();
}

/** Für den Import eines Backups in ein frisches Konto: alles als geändert markieren. */
export function markAllDirty(){ allDocIds().forEach(id => P.dirty.add(id)); }
export { backupJSON };
