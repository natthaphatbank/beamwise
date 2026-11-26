// Word (.docx) report: the same report HTML as the PDF, converted to WordprocessingML
// (headings, paragraphs with bold / line breaks, tables with header shading, legends as
// coloured cells, images, page breaks, footer with page numbers). Uses makeZip (xlsx.js).

async function htmlToDocx(html, tpl = {}) {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  const x = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const accent = (tpl.accent || "#1f5fbf").replace("#", "").toUpperCase();
  const media = [];                                  // { name, bytes, rid }
  const body = [];
  const PAGE_W = 6.3 * 914400;                       // usable width ~16 cm in EMU

  // image size from the data URL
  const dims = url => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([800, 500]); i.src = url; });
  const imageXml = async (src, maxW = PAGE_W, maxH = 8.5 * 914400) => {
    if (!src || !/^data:image\/(png|jpeg|jpg|webp)/.test(src)) return "";
    const [w, h] = await dims(src);
    let cx = maxW, cy = cx * h / w;
    if (cy > maxH) { cy = maxH; cx = cy * w / h; }
    const ext = /png/.test(src.slice(0, 20)) ? "png" : "jpeg";
    const n = media.length + 1, rid = "rIdImg" + n;
    media.push({ name: `media/image${n}.${ext}`, bytes: dataUrlBytes(src), rid });
    cx = Math.round(cx); cy = Math.round(cy);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}"/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  // inline content of an element as runs (bold for <b>/<strong>/<th>, breaks for <br>)
  const runs = (el, bold = false, size = null, color = null) => {
    let out = "";
    const rp = b => `<w:rPr>${b ? "<w:b/><w:bCs/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ""}</w:rPr>`;
    const walk = (n, b) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const tx = c.textContent.replace(/\s+/g, " "); if (tx.trim() || tx === " ") out += `<w:r>${rp(b)}<w:t xml:space="preserve">${x(tx)}</w:t></w:r>`; }
        else if (c.nodeName === "BR") out += "<w:r><w:br/></w:r>";
        else if (c.nodeName === "IMG") continue;
        else walk(c, b || /^(B|STRONG|TH)$/.test(c.nodeName));
      }
    };
    walk(el, bold);
    return out;
  };
  const para = (inner, style = null, opts = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${opts}</w:pPr>${inner}</w:p>`;
  const cellXml = (inner, shade = null, widthPct = null) => `<w:tc><w:tcPr>${widthPct ? `<w:tcW w:w="${widthPct}" w:type="pct"/>` : ""}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}</w:tcPr>${inner || "<w:p/>"}</w:tc>`;
  const tblStart = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="C9D1DE"/>`).join("")}</w:tblBorders>
    <w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;

  const table = el => {
    const rows = [...el.querySelectorAll("tr")];
    if (!rows.length) return "";
    const nCols = Math.max(...rows.map(r => [...r.children].reduce((s, c) => s + (+c.getAttribute("colspan") || 1), 0)));
    const small = el.classList.contains("r-small");
    let out = tblStart + `<w:tblGrid>${Array.from({ length: nCols }, () => `<w:gridCol w:w="${Math.round(9000 / nCols)}"/>`).join("")}</w:tblGrid>`;
    for (const r of rows) {
      const head = r.parentElement?.nodeName === "THEAD", foot = r.parentElement?.nodeName === "TFOOT";
      out += `<w:tr>${head ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}` + [...r.children].map(c => {
        const span = +c.getAttribute("colspan") || 1;
        const shade = head || c.nodeName === "TH" ? "EEF2F8" : null;
        const right = c.classList.contains("n") || c.classList.contains("num");
        const p = para(runs(c, head || foot || c.nodeName === "TH", small ? 16 : 19), null, right ? '<w:jc w:val="right"/>' : "");
        return `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}</w:tcPr>${p}</w:tc>`;
      }).join("") + "</w:tr>";
    }
    return out + "</w:tbl>" + para("");
  };
  // legend: one row of small coloured cells with their labels
  const legend = el => {
    const items = [...el.querySelectorAll(".rl-i")];
    const title = el.querySelector("b");
    let out = title ? para(runs(title, true, 18)) : "";
    if (!items.length) return out;
    out += tblStart + `<w:tblGrid>${items.map(() => `<w:gridCol w:w="${Math.round(9000 / items.length)}"/>`).join("")}</w:tblGrid><w:tr>`;
    for (const it of items) {
      const sw = it.querySelector("i"), m = sw?.getAttribute("style")?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      const fill = m ? m.slice(1).map(v => (+v).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
      out += cellXml(para(runs(it, false, 16)), fill);
    }
    return out + "</w:tr></w:tbl>" + para("");
  };

  let firstSection = true;
  const walk = async el => {
    for (const c of el.children) {
      const tag = c.nodeName, cls = c.classList;
      if (tag === "SECTION") {
        if (cls.contains("r-page") && !firstSection) body.push(para('<w:r><w:br w:type="page"/></w:r>'));
        firstSection = false;
        await walk(c);
      } else if (tag === "H1") body.push(para(runs(c), "Title"));
      else if (tag === "H2") body.push(para(runs(c), "Heading1"));
      else if (tag === "H3") body.push(para(runs(c), "Heading2"));
      else if (tag === "TABLE") body.push(table(c));
      else if (cls.contains("r-legend")) body.push(legend(c));
      else if (cls.contains("r-brand")) {
        const img = c.querySelector("img.r-logo");
        if (img) body.push(para(await imageXml(img.getAttribute("src"), 1.6 * 914400, 0.9 * 914400)));
        body.push(para(runs(c, false, 22, accent)));
      } else if (tag === "IMG") body.push(para(await imageXml(c.getAttribute("src")), null, '<w:jc w:val="center"/>'));
      else if (tag === "FIGURE" || tag === "DIV" && (cls.contains("r-notes-grid") || cls.contains("r-note-item") || cls.contains("r-root"))) await walk(c);
      else if (cls.contains("r-footer")) continue;
      else if (tag === "P" || tag === "FIGCAPTION" || tag === "DIV") {
        const style = cls.contains("r-note") ? "Small" : cls.contains("r-sub") ? "Subtitle" : null;
        body.push(para(runs(c), style));
        for (const im of c.querySelectorAll("img")) body.push(para(await imageXml(im.getAttribute("src")), null, '<w:jc w:val="center"/>'));
      } else await walk(c);
    }
  };
  await walk(root.querySelector(".r-root") || root);

  const footer = tpl.footer || "";
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body.join("\n")}
<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Small"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>
<w:r><w:t xml:space="preserve">${x(footer)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const font = `<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Leelawadee UI" w:eastAsia="Microsoft YaHei"/>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-GB" w:bidi="th-TH"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${accent}"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="${accent}"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${accent}"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${accent}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="555555"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
</w:styles>`;
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
${media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.name}"/>`).join("")}</Relationships>` },
    { name: "word/document.xml", data: documentXml },
    { name: "word/styles.xml", data: stylesXml },
    { name: "word/footer1.xml", data: footerXml },
    ...media.map(m => ({ name: "word/" + m.name, data: m.bytes })),
  ];
  return makeZip(files, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
