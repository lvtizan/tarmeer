"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGoogleTranslate = parseGoogleTranslate;
exports.translate = translate;

/** 解析 Google gtx 返回：data[0] 各段 seg[0] 拼接。畸形输入返回 ''。 */
function parseGoogleTranslate(body) {
    try {
        const data = JSON.parse(body);
        if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
        return data[0].map(seg => (Array.isArray(seg) ? seg[0] : '') || '').join('').trim();
    }
    catch {
        return '';
    }
}

/** 调 Google 免费端点把 text 翻成 target(如 'en'/'vi')。失败/空 → 返回原 text。8s 超时。 */
async function translate(text, target) {
    const src = (text || '').trim();
    if (!src) return '';
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(src)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return src;
        const out = parseGoogleTranslate(await res.text());
        return out || src;
    }
    catch {
        return src;
    }
}
