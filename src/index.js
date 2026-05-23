import { TEMPLATE_B64 } from './template-b64.js';
import { fillTemplate }  from './docx.js';
import { enhanceWithAI } from './qwen.js';
import { getHTML }        from './html.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── GET / → serve UI ──
    if (pathname === '/' && request.method === 'GET') {
      return html(getHTML());
    }

    // ── POST /api/generate → fill template & return .docx ──
    if (pathname === '/api/generate' && request.method === 'POST') {
      try {
        const fields = await request.json();
        const templateBytes = base64ToBytes(TEMPLATE_B64);
        const docBytes = await fillTemplate(templateBytes, fields);
        const safeName = encodeURIComponent((fields['活動名稱'] || '學校通告') + '.docx');
        return new Response(docBytes, {
          headers: {
            ...corsHeaders(),
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
          },
        });
      } catch (e) {
        return jsonError(e.message);
      }
    }

    // ── POST /api/ai-enhance → call Qwen & return enhanced fields ──
    if (pathname === '/api/ai-enhance' && request.method === 'POST') {
      try {
        const fields = await request.json();
        const enhanced = await enhanceWithAI(fields, env);
        return jsonOk(enhanced);
      } catch (e) {
        return jsonError(e.message);
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ── helpers ────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function html(body) {
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
  });
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function jsonError(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
