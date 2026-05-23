import { runChat } from '../../src/chatService.js';

export async function onRequestPost({ request, env }) {
  try {
    const { messages, school_name: schoolName = '中華基督教會基慈小學', images } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError('messages 不可為空', 400);
    }

    const result = await runChat(messages, schoolName, env, images);

    return new Response(JSON.stringify(result), {
      headers: corsHeaders(),
    });
  } catch (e) {
    return jsonError(e.message);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: corsHeaders(),
  });
}
