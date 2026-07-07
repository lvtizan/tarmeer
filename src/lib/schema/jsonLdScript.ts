// 安全序列化 JSON-LD 以放进 <script> 标签。
// JSON.stringify 不转义 <、>、行分隔符 U+2028/U+2029,若数据含用户自填文本
//（如供应商描述），出现 </script> 会提前闭合脚本标签 → 存储型 HTML/JS 注入。
// 此处转义这些字符。参考 Next 官方 JSON-LD 注入建议。
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
