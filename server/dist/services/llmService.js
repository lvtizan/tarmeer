"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLlmConfigured = isLlmConfigured;
exports.generateArticle = generateArticle;
const database_1 = __importDefault(require("../config/database"));
const TAG = '[llm-service]';
async function getConfig() {
    const [rows] = await database_1.default.execute("SELECT config_key, config_value FROM system_config WHERE config_key IN ('llm_provider', 'llm_api_key', 'llm_model')");
    const map = {};
    for (const row of rows) {
        map[row.config_key] = row.config_value;
    }
    if (!map.llm_api_key)
        return null;
    return {
        provider: map.llm_provider || 'openai',
        apiKey: map.llm_api_key,
        model: map.llm_model || 'gpt-4o-mini',
    };
}
async function isLlmConfigured() {
    const config = await getConfig();
    return config !== null && config.apiKey.length > 0;
}
async function generateArticle(prompt) {
    const config = await getConfig();
    if (!config) {
        console.log(TAG, 'LLM not configured');
        return null;
    }
    try {
        if (config.provider === 'openai') {
            return await callOpenAI(config, prompt);
        }
        // Future: add 'gemini' provider here
        console.error(TAG, 'Unknown provider:', config.provider);
        return null;
    }
    catch (err) {
        console.error(TAG, 'Generation failed:', err);
        return null;
    }
}
async function callOpenAI(config, prompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: 'system', content: 'You are an expert SEO content writer for interior design and renovation companies in UAE. Write in English. Output JSON with keys: title, content (markdown), excerpt (1-2 sentences).' },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 2000,
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text)
        return null;
    const parsed = JSON.parse(text);
    return {
        title: parsed.title || 'Untitled',
        content: parsed.content || '',
        excerpt: parsed.excerpt || '',
    };
}
