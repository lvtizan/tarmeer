"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdownToHtml = markdownToHtml;
exports.countWords = countWords;
exports.estimateReadingTime = estimateReadingTime;
function stripLeadingDuplicateCoverImage(content, coverImage) {
    if (!coverImage)
        return content;
    const coverId = coverImage.match(/photo-[a-zA-Z0-9-]+/)?.[0];
    if (!coverId)
        return content;
    return content.replace(new RegExp(`!\\[[^\\]]*\\]\\([^)]*${coverId}[^)]*\\)\\n*`), '');
}
function markdownToHtml(content, coverImage) {
    const normalized = stripLeadingDuplicateCoverImage(content, coverImage);
    return normalized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure><img src="$2" alt="$1" loading="lazy" decoding="async" fetchpriority="low" /><figcaption>$1</figcaption></figure>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/^---$/gm, '<hr />')
        .split(/\n\n+/)
        .map((block) => {
        const trimmed = block.trim();
        if (!trimmed)
            return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<figure')) {
            return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
        .filter(Boolean)
        .join('\n');
}
function countWords(content) {
    return content.trim().split(/\s+/).filter(Boolean).length;
}
function estimateReadingTime(wordCount) {
    return Math.max(1, Math.ceil(wordCount / 200));
}
