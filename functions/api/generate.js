import { TEMPLATE_B64 } from '../../src/template-b64.js';
import { fillTemplate }  from '../../src/docx.js';

export async function onRequestPost({ request }) {
  try {
    const fields = await request.json();
    // 領隊老師 doubles as 聯絡老師 in the contact sentence
    if (!fields['聯絡老師'] && fields['領隊老師']) {
      fields['聯絡老師'] = fields['領隊老師'];
    }
    const bin = atob(TEMPLATE_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const docBytes = await fillTemplate(bytes.buffer, fields);
    const safeName = encodeURIComponent((fields['活動名稱'] || '學校通告') + '.docx');
    return new Response(docBytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
