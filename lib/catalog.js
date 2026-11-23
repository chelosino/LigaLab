import { LEAGUES } from './provider.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function validateLeague(input) {
  const bad = message => { throw new HttpError(400, message); };
  if (!input || typeof input !== 'object') bad('Configuración inválida.');
  const slug = (value, label) => {
    if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 80) bad(`${label}: usa letras minúsculas, números y guiones.`);
    return value;
  };
  const string = (value, label, max = 120) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) bad(`${label} es obligatorio (máximo ${max} caracteres).`);
    return value.trim();
  };
  const integer = (value, label, min, max) => {
    if (!Number.isInteger(value) || value < min || value > max) bad(`${label}: entero entre ${min} y ${max}.`);
    return value;
  };
  const teams = integer(input.teams, 'Equipos', 2, 40);
  if (input.rounds !== 2) bad('Por ahora se admite una tabla única con partidos de ida y vuelta.');
  if (typeof input.enabled !== 'boolean') bad('Disponibilidad inválida.');
  if (!Array.isArray(input.ties) || input.ties.length !== 3 || input.ties[0] !== 'pts' || new Set(input.ties).size !== 3 || input.ties.some(x => !['pts','gd','gf'].includes(x))) bad('Desempates: puntos primero, luego diferencia y goles a favor en el orden elegido.');
  if (!Array.isArray(input.zones) || input.zones.length > 10) bad('Máximo 10 zonas.');
  const seen = new Set();
  const zones = input.zones.map(z => {
    const id = slug(z.id, 'ID de zona');
    if (seen.has(id)) bad('Los identificadores de zonas deben ser únicos.');
    seen.add(id);
    const from = integer(z.from, 'Desde posición', 1, teams), to = integer(z.to, 'Hasta posición', from, teams);
    if (!/^#[0-9a-fA-F]{6}$/.test(z.color)) bad('Color de zona inválido.');
    return { id, name: string(z.name, 'Nombre de zona', 60), from, to, color: z.color };
  });
  return {
    id: slug(input.id, 'ID de liga'), name: string(input.name, 'Nombre'),
    country: slug(input.country, 'País en LiveScore'), slug: slug(input.slug, 'Liga en LiveScore'),
    enabled: input.enabled, teams, rounds: 2,
    top: integer(input.top, 'Top predeterminado', 1, teams), bottom: integer(input.bottom, 'Zona baja predeterminada', 1, teams),
    points: { win: integer(input.points?.win, 'Puntos por victoria', 1, 10), draw: integer(input.points?.draw, 'Puntos por empate', 0, 9) },
    ties: input.ties, zones, rulesNote: string(input.rulesNote, 'Nota de reglas', 1500)
  };
}
export const defaultLeagues = () => Object.values(LEAGUES).map(c => ({ ...c, enabled: true, zones: [
  { id: 'top', name: `Top ${c.top}`, from: 1, to: c.top, color: '#187b46' },
  { id: 'bottom', name: `Últimos ${c.bottom}`, from: c.teams-c.bottom+1, to: c.teams, color: '#b04636' }
]}));

export function createCatalog({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, fetcher = fetch } = {}) {
  const configured = !!(url && key);
  async function request(path, { token, method = 'GET', body, prefer } = {}) {
    if (!configured) throw new HttpError(503, 'Administración pendiente de conectar con Supabase.');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const response = await fetcher(`${url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      if (response.status === 401) throw new HttpError(401, 'La sesión venció. Vuelve a entrar.');
      if (response.status === 403) throw new HttpError(403, 'Tu cuenta no tiene permiso de administración.');
      if (response.status === 409) throw new HttpError(409, 'Ya existe una liga con ese identificador.');
      throw new HttpError(503, 'No se pudo acceder a la configuración. Inténtalo nuevamente.');
    }
    return response.status === 204 ? null : response.json();
  }
  async function authorize(requestObject) {
    const match = /^Bearer ([^\s]+)$/.exec(requestObject.headers.get('Authorization') || '');
    if (!match) throw new HttpError(401, 'Inicia sesión para administrar.');
    const token = match[1];
    const user = await request('/auth/v1/user', { token });
    if (!user.email_confirmed_at || !await request('/rest/v1/rpc/ligalab_is_admin', { token, method: 'POST', body: {} })) throw new HttpError(403, 'Tu cuenta no tiene permiso de administración.');
    return { token, email: user.email };
  }
  async function rows(token) {
    if (!configured) return defaultLeagues().map(config => ({ id: config.id, config, revision: 0 }));
    return request('/rest/v1/ligalab_leagues?select=id,config,revision,updated_at&order=id', { token });
  }
  return {
    configured, publicAuth: () => ({ configured, url: configured ? url : null, key: configured ? key : null }), authorize, rows,
    async list() { return (await rows()).map(r => r.config).filter(c => c.enabled); },
    async save(config, revision, token) {
      const fresh = revision === null;
      if (!fresh && (!Number.isInteger(revision) || revision < 1)) throw new HttpError(400, 'Revisión inválida.');
      const result = await request('/rest/v1/ligalab_leagues' + (fresh ? '' : `?id=eq.${encodeURIComponent(config.id)}&revision=eq.${revision}`), {
        token, method: fresh ? 'POST' : 'PATCH', body: fresh ? { id: config.id, config } : { config }, prefer: 'return=representation'
      });
      if (!result?.length) throw new HttpError(409, 'Otra sesión modificó esta liga. Recarga la lista antes de guardar.');
      return result[0];
    }
  };
}
