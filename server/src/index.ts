import path from 'node:path';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readBomFromText, extractResistorValuesNoMPN } from './bom.js';
import { MouserClient } from './mouser.js';
import { chatWithTools, ChatMessage } from './openrouter.js';
import { defineTools } from './tools.js';

// Load .env from server/ and also try repo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const server = Fastify({ logger: true });

server.register(cors, {
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
});

server.get('/api/ping', async () => ({ ok: true }));

server.post('/api/run', async (req: any, reply) => {
  try {
    console.log('[API] /api/run called');
    const { bomCsv, messages } = (req.body || {}) as {
      bomCsv?: string;
      messages: ChatMessage[];
    };
    console.log('[API] bomCsv present:', !!bomCsv, 'messages count:', messages?.length || 0);

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Access-Control-Allow-Methods', 'POST');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const send = (data: any) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const msgs: ChatMessage[] = [];
    msgs.push({
      role: 'system',
      content: 'You are a Mouser BOM assistant. The user has uploaded a BOM. Ask them what they want help with, then help them.',
    });

    const mouser = new MouserClient();
    const { tools, map } = defineTools(mouser);

    if (bomCsv && typeof bomCsv === 'string') {
      const rows = readBomFromText(bomCsv);
      if (rows.length) {
        const lines = rows.map(r => {
          return Object.entries(r)
            .map(([key, value]) => `  ${key}: ${value ?? ''}`)
            .join('\n');
        }).join('\n\n');
        msgs.push({
          role: 'user',
          content: `BOM uploaded:\n\n${lines}\n\nAsk the user what they want help with.`,
        });
      }
    }

    if (Array.isArray(messages)) msgs.push(...messages);

    const MAX_STEPS = Math.min(8, Number(process.env.AGENT_MAX_STEPS || 6));
    console.log('[API] Starting agent loop, max steps:', MAX_STEPS);

    for (let step = 0; step < MAX_STEPS; step++) {
      console.log('[API] Step', step, '- calling LLM with', msgs.length, 'messages');

      const r = await chatWithTools({ messages: msgs as any, tools });
      const m = r.choices[0].message as any;
      console.log('[API] Step', step, '- got response, content:', !!m.content, 'tool_calls:', m.tool_calls?.length || 0);

      if (m.content) {
        send({ type: 'message', role: 'assistant', content: m.content });
      }

      if (m.tool_calls && m.tool_calls.length) {
        msgs.push(m);
        for (const tc of m.tool_calls as any[]) {
          const def = map[tc.function.name];
          if (!def) continue;
          let args: any;
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }

          send({ type: 'tool_call', name: def.name, args });
          const result = await def.handler(args);
          send({ type: 'tool_result', name: def.name, result: typeof result === 'string' ? result.slice(0, 200) + '...' : result });

          msgs.push({ role: 'tool', tool_call_id: tc.id, name: def.name, content: JSON.stringify(result) });
        }
        continue;
      }

      // No tools → check for control JSON
      const meta = safeParseJSON(m.content || '');
      if (meta && typeof meta === 'object') {
        console.log('[API] Got control JSON:', meta);
        if (meta.status === 'complete' || meta.status === 'await_user') {
          send({ type: 'done', meta });
          reply.raw.end();
          return;
        }
      }

      // Plain assistant message → handoff to user
      console.log('[API] Plain message, returning to user');
      send({ type: 'done' });
      reply.raw.end();
      return;
    }

    console.log('[API] Hit step cap');
    send({ type: 'done', meta: { status: 'step_cap' } });
    reply.raw.end();
  } catch (e: any) {
    console.error('[API] Error:', e);
    reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
    reply.raw.end();
  }
});

const PORT = Number(process.env.PORT || 3000);
server
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`Server running at http://localhost:${PORT}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

function safeParseJSON(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
