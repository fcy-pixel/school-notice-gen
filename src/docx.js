import JSZip from 'jszip';

/** Escape XML special characters */
function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * For multi-line values: clone the enclosing <w:p> for each line.
 * Each cloned paragraph inherits the original's formatting (including <w:numPr> list style).
 */
function expandMultiline(xml, placeholder, value) {
  const lines = value.split('\n')
    .map(l => l.replace(/^[\s\u30FB\u2022\u00B7\u2027]+/, '').trim()) // strip leading ・•·
    .filter(Boolean);
  if (lines.length <= 1) return xml;

  const phIdx = xml.indexOf(placeholder);
  if (phIdx === -1) return xml;

  const pStart = xml.lastIndexOf('<w:p ', phIdx);
  if (pStart === -1) return xml;
  const pEnd = xml.indexOf('</w:p>', phIdx);
  if (pEnd === -1) return xml;

  const paraXml = xml.slice(pStart, pEnd + '</w:p>'.length);
  const expanded = lines.map(line => paraXml.split(placeholder).join(escapeXml(line))).join('');
  return xml.slice(0, pStart) + expanded + xml.slice(pEnd + '</w:p>'.length);
}

/**
 * Fill placeholders in a .docx template.
 * @param {ArrayBuffer} templateBytes - Raw bytes of the template .docx
 * @param {Record<string,string>} fields - Placeholder → replacement value
 * @returns {Promise<ArrayBuffer>} Filled .docx bytes
 */
export async function fillTemplate(templateBytes, fields) {
  const zip = await JSZip.loadAsync(templateBytes);

  // Process main document and relationships
  const targets = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/footer1.xml',
    'word/footer2.xml',
  ];

  for (const target of targets) {
    const file = zip.file(target);
    if (!file) continue;
    let xml = await file.async('string');

    for (const [key, value] of Object.entries(fields)) {
      const placeholder = `{{${key}}}`;
      if (!xml.includes(placeholder)) continue;

      const strValue = String(value ?? '');

      // Multi-line: expand into separate paragraphs (e.g. 備註 list items)
      if (strValue.includes('\n')) {
        const expanded = expandMultiline(xml, placeholder, strValue);
        if (expanded !== xml) { xml = expanded; continue; }
      }

      // Single-line (or fallback): inline with <w:br/> for any remaining \n
      const escaped = escapeXml(strValue)
        .split('\n')
        .join('</w:t><w:br/><w:t xml:space="preserve">');
      xml = xml.split(placeholder).join(escaped);
    }

    zip.file(target, xml);
  }

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
