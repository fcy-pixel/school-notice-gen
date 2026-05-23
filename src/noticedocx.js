/**
 * Generate a minimal but properly formatted Chinese school notice .docx
 * from structured notice data, without requiring a pre-made template.
 * Uses JSZip (already in package.json).
 */
import JSZip from 'jszip';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap text in a centered, bold paragraph */
function centeredBoldPara(text, size = '28') {
  return `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr>
    <w:r>
      <w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>
        <w:rFonts w:east="標楷體" w:cs="標楷體"/>
      </w:rPr>
      <w:t xml:space="preserve">${esc(text)}</w:t>
    </w:r>
  </w:p>`;
}

/** Regular paragraph, indented */
function normalPara(text, indent = '480') {
  if (!text) return emptyPara();
  // Split on \n to create sub-paragraphs
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const indentStr = i === 0 ? `<w:ind w:firstLine="${indent}"/>` : '';
    return `<w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/>${indentStr}</w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/><w:szCs w:val="24"/>
          <w:rFonts w:east="標楷體" w:cs="標楷體"/>
        </w:rPr>
        <w:t xml:space="preserve">${esc(line)}</w:t>
      </w:r>
    </w:p>`;
  }).join('\n');
}

function emptyPara() {
  return '<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr></w:p>';
}

/** Right-aligned paragraph */
function rightPara(text) {
  if (!text) return emptyPara();
  return `<w:p>
    <w:pPr><w:jc w:val="right"/><w:spacing w:before="60" w:after="60"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
        <w:rFonts w:east="標楷體" w:cs="標楷體"/>
      </w:rPr>
      <w:t xml:space="preserve">${esc(text)}</w:t>
    </w:r>
  </w:p>`;
}

/** Two-column row for notice meta (學年 / 通告編號) */
function metaTable(schoolYear, noticeNo) {
  const cell = (text, align = 'left') =>
    `<w:tc>
      <w:tcPr><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="${align}"/></w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:east="標楷體" w:cs="標楷體"/></w:rPr>
          <w:t xml:space="preserve">${esc(text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9072" w:type="dxa"/>
      <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="4536"/><w:gridCol w:w="4536"/></w:tblGrid>
    <w:tr>
      ${cell('學年：' + (schoolYear || ''), 'left')}
      ${cell('通告編號：' + (noticeNo || ''), 'right')}
    </w:tr>
  </w:tbl>`;
}

/**
 * Build the word/document.xml content.
 */
function buildDocumentXml(notice) {
  const { title, recipient, body, closing, 學年, 通告編號, 發出日期, schoolName } = notice;

  const bodyParas = (body || '').split('\n\n')
    .flatMap(para => para.trim() ? [normalPara(para), emptyPara()] : [emptyPara()]);

  const closingLines = (closing || '').split('\n').filter(Boolean);
  const closingParas = closingLines.length
    ? closingLines.map(l => rightPara(l)).join('\n')
    : rightPara(closing || '');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:b/><w:sz w:val="32"/><w:szCs w:val="32"/>
          <w:rFonts w:east="標楷體" w:cs="標楷體"/>
        </w:rPr>
        <w:t>${esc(schoolName || '中華基督教會基慈小學')}</w:t>
      </w:r>
    </w:p>

    ${centeredBoldPara(title || '學校通告', '28')}

    ${metaTable(學年, 通告編號)}

    ${emptyPara()}

    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/><w:rFonts w:east="標楷體" w:cs="標楷體"/></w:rPr>
        <w:t xml:space="preserve">${esc(recipient || '各位家長')}，</w:t>
      </w:r>
    </w:p>

    ${emptyPara()}

    ${bodyParas.join('\n')}

    ${emptyPara()}

    ${closingParas}

    <w:p>
      <w:pPr><w:jc w:val="right"/><w:spacing w:before="60" w:after="60"/></w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:east="標楷體" w:cs="標楷體"/></w:rPr>
        <w:t xml:space="preserve">${esc(發出日期 || '')}</w:t>
      </w:r>
    </w:p>

    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:east="標楷體" w:cs="標楷體"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="zh-TW" w:eastAsia="zh-TW"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

/**
 * Generate a notice .docx ArrayBuffer from structured notice data.
 * @param {object} notice - {title, recipient, body, closing, 學年, 通告編號, 發出日期, schoolName}
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildNoticeDocx(notice) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('word/document.xml', buildDocumentXml(notice));
  zip.file('word/_rels/document.xml.rels', WORD_RELS_XML);
  zip.file('word/styles.xml', STYLES_XML);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
