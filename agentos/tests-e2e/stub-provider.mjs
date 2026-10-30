/**
 * PROTOCOL STUB — NOT AN AI AGENT.
 *
 * A local HTTP server speaking the documented Responses wire format, used by
 * the acceptance test to drive AgentOS's real HTTP adapter path (request
 * building, bearer auth, parsing, error mapping, redaction) without provider
 * credentials. Every reply says it came from this stub.
 *
 *   /hermes/v1/responses  accepts Bearer STUB_HERMES_KEY, returns a canned answer
 *   /openai/v1/responses  always answers 401 with a key echo, like a real
 *                         provider rejecting a bad key
 */
import http from 'node:http';

export const STUB_HERMES_KEY = 'stub-hermes-key-0123456789';

export function startStub(port) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.method === 'POST' && req.url === '/hermes/v1/responses') {
        if (req.headers.authorization !== `Bearer ${STUB_HERMES_KEY}`) return send(401, { error: { message: 'invalid API key' } });
        const body = JSON.parse(raw || '{}');
        const input = String(body.input ?? '');
        const text = input.includes('AGENTOS_CONNECTION_OK')
          ? 'AGENTOS_CONNECTION_OK'
          : `[PROTOCOL STUB — not Hermes, not an AI] Received ${input.length} characters for model "${body.model}". A real Hermes Agent answer would appear here.`;
        return send(200, {
          id: `resp_stub_${Date.now()}`,
          object: 'response',
          status: 'completed',
          model: body.model,
          output: [
            { type: 'function_call', status: 'completed', name: 'terminal', arguments: '{}', call_id: 'c1' },
            { type: 'function_call_output', status: 'completed', call_id: 'c1', output: 'ignored' },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
          ],
          usage: { input_tokens: 42, output_tokens: 17, total_tokens: 59 },
        });
      }
      if (req.method === 'POST' && req.url === '/openai/v1/responses') {
        const key = (req.headers.authorization ?? '').replace('Bearer ', '');
        return send(401, { error: { message: `Incorrect API key provided: ${key}.` } });
      }
      send(404, { error: 'not found' });
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
