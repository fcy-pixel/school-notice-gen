import { enhanceWithAI } from '../../src/qwen.js';

export async function onRequestPost({ request, env }) {
  try {
    const fields = await request.json();
    const enhanced = await enhanceWithAI(fields, env);
    return new Response(JSON.stringify(enhanced), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
