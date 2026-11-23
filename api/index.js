import { createService } from '../lib/api.js';
const service = createService();

export function createHandler(handle = request => service.handle(request)) {
  return async request => {
    const url = new URL(request.url);
    const route = url.searchParams.get('route') || url.pathname.slice('/api/'.length);
    if (!['league', 'leagues', 'matches.csv'].includes(route)) {
      return Response.json({ error: 'Ruta no encontrada' }, { status: 404 });
    }
    url.pathname = '/api/' + route;
    url.searchParams.delete('route');
    const response = await handle(new Request(url, { method: request.method }));
    // Best-effort per-instance cache remains in the service. Never imply persistence.
    return response;
  };
}

export default { fetch: createHandler() };
