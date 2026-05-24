import { GENERAL_TEMPLATE_B64 } from '../../src/general-template-b64.js';
import { fillTemplate } from '../../src/docx.js';

/**
 * POST /api/generate-notice
 * Body: {標題, 收件人, 正文, 回條標題, 回條項目, 回條截止日期, 學年, 通告編號, 發出日期}
 * Returns: .docx file download using the school-branded general notice template
 */
export async function onRequestPost({ request }) {
  try {
    const notice = await request.json();

    // Decode template and fill placeholders
    const bin = atob(GENERAL_TEMPLATE_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const fields = {
      '學年':         notice['學年']         || '',
      '通告編號':     notice['通告編號']     || 'XXXXX',
      '發出日期':     notice['發出日期']     || '',
      '標題':         notice['標題']         || notice.title || '',
      '收件人':       notice['收件人']       || notice.recipient || '各位家長',
      '正文':         notice['正文']         || notice.body  || '',
      '回條標題':     notice['回條標題']     || '',
      '回條項目':     notice['回條項目']     || '',
      '回條截止日期': notice['回條截止日期'] || '',
      '回條截止（文字）': notice['回條截止（文字）'] || '',
      '聯絡電話':     notice['聯絡電話']     || '2322 5122',
      '聯絡老師':     notice['聯絡老師']     || '',
    };

    const docBytes = await fillTemplate(bytes.buffer, fields);
    const safeName = encodeURIComponent((fields['標題'] || '學校通告') + '.docx');
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
