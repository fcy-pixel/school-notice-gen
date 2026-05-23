import { buildNoticeDocx } from '../../src/noticedocx.js';

/**
 * POST /api/generate-notice
 * Body: {title, recipient, body, closing, 學年, 通告編號, 發出日期, schoolName}
 * Returns: .docx file download
 */
export async function onRequestPost({ request }) {
  try {
    const notice = await request.json();
    const docBytes = await buildNoticeDocx(notice);
    const safeName = encodeURIComponent((notice.title || '學校通告') + '.docx');
    return new Response(docBytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
