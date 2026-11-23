import { sourceURL, normalize, toCSV } from './provider.js';
import { createCatalog, validateLeague, HttpError } from './catalog.js';
export function createService({ fetcher = fetch, now = () => Date.now(), ttl = 25000, catalog = createCatalog() } = {}) {
  const cache = new Map(), inflight = new Map();
  async function get(id, config) {
    config ??= (await catalog.list()).find(c => c.id === id);
    if (!config) throw new HttpError(404, 'Liga no disponible.');
    const key = JSON.stringify(config), old = cache.get(key);
    if (old && now()-old.checkedAt < ttl) return old.result;
    if (inflight.has(key)) return inflight.get(key);
    const task = (async () => {
      try {
        const response = await fetcher(sourceURL(config), { headers: { Accept: 'application/json', 'User-Agent': 'LigaLab/3.0' }, signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw Error(`LiveScore respondió HTTP ${response.status}.`);
        const result = { ...normalize(await response.json(), config), fetchedAt: new Date(now()).toISOString(), stale: false };
        if (cache.size > 100) cache.clear();
        cache.set(key, { checkedAt: now(), result });
        return result;
      } catch (e) {
        if (old) {
          const result = { ...old.result, stale: true, error: 'No se pudo actualizar LiveScore. Se muestran los últimos datos recibidos.', lastAttemptAt: new Date(now()).toISOString() };
          cache.set(key, { checkedAt: now(), result });
          return result;
        }
        throw new HttpError(502, `No fue posible cargar LiveScore: ${e.message}`);
      } finally { inflight.delete(key); }
    })();
    inflight.set(key, task);
    return task;
  }
  async function body(request) {
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Se requiere JSON.');
    const text = await request.text();
    if (text.length > 30000) throw new HttpError(413, 'Configuración demasiado grande.');
    try { return JSON.parse(text); } catch { throw new HttpError(400, 'JSON inválido.'); }
  }
  async function handle(request) {
    const url = new URL(request.url), path = url.pathname;
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const json = (data, status = 200) => Response.json(data, { status, headers });
    try {
      if (path === '/api/auth-config' && request.method === 'GET') return json(catalog.publicAuth());
      if (path.startsWith('/api/admin/')) {
        const { token, email } = await catalog.authorize(request);
        if (path === '/api/admin/leagues' && request.method === 'GET') return json({ email, leagues: await catalog.rows(token) });
        if (['/api/admin/leagues', '/api/admin/validate'].includes(path) && request.method === 'POST') {
          const input = await body(request), config = validateLeague(input.config);
          let check;
          if (config.enabled || path.endsWith('/validate')) {
            const data = await get(config.id, config);
            check = { matches: data.matches.length, teams: data.table.length, liveCount: data.liveCount, warnings: data.warnings, blockers: data.blockers, source: data.source };
            if (data.stale) throw new HttpError(502, 'No se pudo verificar la fuente con datos nuevos.');
            if (path.endsWith('/validate')) return json(check);
            // Data blockers pause forecasts, not publication of a valid league catalog entry.
          }
          return json({ league: await catalog.save(config, input.revision, token), check });
        }
        throw new HttpError(405, 'Método o ruta de administración no permitido.');
      }
      if (request.method !== 'GET') throw new HttpError(405, 'Método no permitido.');
      if (path === '/api/leagues') return json(await catalog.list());
      if (!['/api/league', '/api/matches.csv'].includes(path)) throw new HttpError(404, 'Ruta no encontrada.');
      const id = url.searchParams.get('league') || 'chile', result = await get(id);
      if (path.endsWith('.csv')) return new Response('\uFEFF'+toCSV(result), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="matches_${id}.csv"`, 'X-Data-Stale': String(result.stale), 'X-Data-Fetched-At': result.fetchedAt } });
      return json(result);
    } catch (e) { return json({ error: e.status ? e.message : 'No se pudo completar la solicitud.' }, e.status || 500); }
  }
  return { get, handle };
}
