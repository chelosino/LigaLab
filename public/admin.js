import { createClient } from './vendor/auth.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let auth, rows = [], editing = null, dirty = false, busy = false;
function message(text, error=false) { $('message').textContent=text; $('message').classList.toggle('error',error); }
async function api(path, body) {
  const { data: { session }, error } = await auth.auth.getSession();
  if (error || !session) throw Error('Inicia sesión nuevamente.');
  const response = await fetch('/api/admin/'+path, { method: body ? 'POST':'GET', cache:'no-store', headers: { Authorization:'Bearer '+session.access_token, 'Content-Type':'application/json' }, body:body?JSON.stringify(body):undefined });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
function cards() {
  $('leagueCards').innerHTML=rows.map(({config:c,revision})=>`<article class="league-card"><span class="tag ${c.enabled?'':'off'}">${c.enabled?'ACTIVA':'DESACTIVADA'}</span><h3>${esc(c.name)}</h3><p>${c.teams} equipos · ida y vuelta · revisión ${revision}</p><div class="zone-chips">${(c.zones||[]).map(z=>`<span class="zone-chip" style="--zone:${esc(z.color)}">${esc(z.name)} · ${z.from}–${z.to}°</span>`).join('')}</div><button class="quiet" data-edit="${esc(c.id)}">Editar configuración →</button></article>`).join('');
}
async function load() {
  const data=await api('leagues'); rows=data.leagues; cards();
  $('identity').textContent='Sesión de '+data.email;
  $('dashboard').hidden=false; $('loginPanel').hidden=true; $('logout').hidden=false;
}
function canDiscard() { return !dirty || window.confirm('Hay cambios sin guardar. ¿Descartarlos?'); }
function zoneRow(z={id:crypto.randomUUID(),name:'',from:1,to:1,color:'#187b46'}) {
  const row=document.createElement('div');row.className='zone-row';row.dataset.id=z.id;
  row.innerHTML=`<label>Nombre<input data-zone="name" value="${esc(z.name)}" required maxlength="60" placeholder="Ej. Clasificación a copas"></label><label>Desde<input data-zone="from" type="number" value="${z.from}" min="1" max="40" required></label><label>Hasta<input data-zone="to" type="number" value="${z.to}" min="1" max="40" required></label><label>Color<input data-zone="color" type="color" value="${esc(z.color)}"></label><button type="button" class="quiet" aria-label="Quitar zona">×</button>`;
  row.querySelector('button').onclick=()=>{row.remove();dirty=true;};$('zoneRows').append(row);
}
function edit(row=null) {
  if (!canDiscard()) return;
  editing=row?structuredClone(row):null;
  const c=row?.config||{id:'',name:'',country:'',slug:'',teams:16,rounds:2,points:{win:3,draw:1},top:3,bottom:2,ties:['pts','gd','gf'],enabled:false,rulesNote:'Zonas exploratorias por posición final. No se modelan definiciones ni cupos dependientes de otras competiciones.',zones:[]};
  for(const key of ['name','country','slug','teams','rounds','top','bottom','rulesNote'])$(key).value=c[key];
  $('leagueId').value=c.id;$('leagueId').readOnly=!!row;$('enabled').value=String(c.enabled);$('win').value=c.points.win;$('draw').value=c.points.draw;$('ties').value=c.ties.join(',');
  $('zoneRows').replaceChildren();(c.zones||[]).forEach(zoneRow);
  $('editorTitle').textContent=row?'Editar '+c.name:'Nueva liga';$('revision').textContent=row?'Revisión '+row.revision+' · '+new Date(row.updated_at).toLocaleString('es-CL'):'Borrador nuevo';
  $('editorPanel').hidden=false;$('sourceCheck').hidden=true;dirty=false;$('editorPanel').scrollIntoView({behavior:'smooth'});
}
function read() {
  return {id:$('leagueId').value.trim(),name:$('name').value.trim(),country:$('country').value.trim(),slug:$('slug').value.trim(),teams:+$('teams').value,rounds:2,top:+$('top').value,bottom:+$('bottom').value,enabled:$('enabled').value==='true',points:{win:+$('win').value,draw:+$('draw').value},ties:$('ties').value.split(','),rulesNote:$('rulesNote').value.trim(),zones:[...$('zoneRows').children].map(row=>({id:row.dataset.id,...Object.fromEntries([...row.querySelectorAll('[data-zone]')].map(i=>[i.dataset.zone,['from','to'].includes(i.dataset.zone)?+i.value:i.value]))}))};
}
function checkReport(check) {
  $('sourceCheck').hidden=false;$('sourceCheck').textContent=`${check.teams} equipos · ${check.matches} partidos · ${check.liveCount} en vivo\n${check.source}\n\n${check.blockers.length?'REQUIERE REVISIÓN\n'+check.blockers.join('\n'):'Fuente compatible con el formato configurado.'}\n${check.warnings.join('\n')}`;
}
async function submit(validate=false) {
  if(busy||!$('leagueForm').reportValidity())return;
  const payload={config:read(),revision:editing?.revision??null};busy=true;$('fields').disabled=true;
  message(validate?'Consultando la fuente…':'Verificando y guardando configuración…');
  try{
    const data=await api(validate?'validate':'leagues',payload);
    if(validate){checkReport(data);message(data.blockers.length?'Revisa los problemas de la fuente antes de activar la liga.':'La fuente respondió correctamente.',!!data.blockers.length);}
    else {dirty=false;await load();edit(data.league);if(data.check)checkReport(data.check);message('Cambios guardados. El catálogo público ya usa esta configuración.');}
  }catch(e){message(e.message,true);}finally{busy=false;$('fields').disabled=false;}
}
$('leagueCards').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)edit(rows.find(r=>r.id===b.dataset.edit));};
$('newLeague').onclick=()=>edit();$('closeEditor').onclick=()=>{if(canDiscard()){dirty=false;$('editorPanel').hidden=true;}};
$('addZone').onclick=()=>{if($('zoneRows').children.length>=10)return message('Máximo 10 zonas por liga.',true);zoneRow();dirty=true;};
$('leagueForm').oninput=()=>{dirty=true;};$('leagueForm').onsubmit=e=>{e.preventDefault();submit();};$('validate').onclick=()=>submit(true);
$('reload').onclick=async()=>{if(!canDiscard())return;try{await load();dirty=false;$('editorPanel').hidden=true;message('Lista actualizada.');}catch(e){message(e.message,true);}};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('login').disabled=true;try{const {error}=await auth.auth.signInWithOtp({email:$('email').value.trim(),options:{emailRedirectTo:location.origin+'/admin'}});if(error)throw error;message('Revisa tu correo y abre el enlace para entrar. Solo las cuentas autorizadas pueden editar.');}catch(e){message(e.message,true);}finally{$('login').disabled=false;}};
$('logout').onclick=async()=>{if(!canDiscard())return;const {error}=await auth.auth.signOut();if(error)return message(error.message,true);dirty=false;location.replace('/admin');};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function init(){
  try{
    const r=await fetch('/api/auth-config',{cache:'no-store'}),c=await r.json();if(!r.ok||!c.configured)throw Error('Administración pendiente de conectar con Supabase.');
    auth=createClient(c.url,c.key,{auth:{storageKey:'ligalab-admin-auth',flowType:'pkce'}});
    const {data:{session},error}=await auth.auth.getSession();if(error)throw error;
    if(session){$('logout').hidden=false;await load();message('Selecciona una liga o añade una nueva.');}
    else{$('loginPanel').hidden=false;message('Inicia sesión con el correo autorizado.');}
  }catch(e){message(e.message,true);if(auth)$('loginPanel').hidden=false;}
}
init();
