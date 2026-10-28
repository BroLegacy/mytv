// Relais MyTV : petit serveur de messages (téléphone <-> TV), compatible avec l'API d'ntfy utilisée par l'app.
//   POST /<sujet>            corps = texte de la commande   -> diffusé à tous les clients connectés
//   GET  /<sujet>/ws         WebSocket (?since=<secondes>)  -> rejoue les derniers messages puis diffuse en direct
// Un Durable Object par sujet ; les WebSocket "hibernent" : pas de coût tant qu'aucun message ne circule.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };
const TOPIC = /^[a-z0-9][a-z0-9-]{7,47}$/;

export class Topic {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async hist() { return (await this.ctx.storage.get('h')) || []; }
  async fetch(req) {
    if (req.headers.get('Upgrade') === 'websocket') {
      const since = Math.max(0, Math.min(+new URL(req.url).searchParams.get('since') || 0, 600));
      const pair = new WebSocketPair(), client = pair[0], server = pair[1];
      this.ctx.acceptWebSocket(server);
      const min = Date.now() / 1000 - since;
      (await this.hist()).forEach((m) => { if (m.time >= min) server.send(JSON.stringify(m)); });
      return new Response(null, { status: 101, webSocket: client });
    }
    const now = Date.now();
    const msg = { id: now.toString(36) + Math.random().toString(36).slice(2, 8), time: Math.floor(now / 1000), event: 'message', message: (await req.text()).slice(0, 4096) };
    const h = (await this.hist()).concat([msg]).filter((m) => m.time > now / 1000 - 600).slice(-40);
    await this.ctx.storage.put('h', h);
    const out = JSON.stringify(msg);
    this.ctx.getWebSockets().forEach((w) => { try { w.send(out); } catch (e) {} });
    return new Response(out, { headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  webSocketMessage() {}
  webSocketClose(ws) { try { ws.close(); } catch (e) {} }
  webSocketError(ws) { try { ws.close(); } catch (e) {} }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const parts = new URL(req.url).pathname.split('/').filter(Boolean), topic = parts[0] || '';
    if (!parts.length) return new Response('MyTV relay', { headers: CORS });
    if (!TOPIC.test(topic)) return new Response('sujet invalide', { status: 400, headers: CORS });
    const ws = parts[1] === 'ws';
    if (ws ? req.headers.get('Upgrade') !== 'websocket' : (req.method !== 'POST' && req.method !== 'PUT')) return new Response('méthode non prise en charge', { status: 405, headers: CORS });
    return env.TOPIC.get(env.TOPIC.idFromName(topic)).fetch(req);
  },
};
