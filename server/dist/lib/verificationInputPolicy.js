'use strict';
const GOOGLE_MAP_HOSTS=new Set(['google.com','google.ae','google.co.uk','google.de','google.fr']);
const GOOGLE_MAP_SUBDOMAINS=new Set(['maps.google.com','maps.google.ae','maps.google.co.uk']);
function normalizePhone(value) {
    return value.replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-0x0660)).replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-0x06f0));
}
function validUAEPhone(value) {
    if(typeof value!=='string' || /[\x00-\x1f\x7f]/.test(value)) return false;
    const formatted=normalizePhone(value);
    if(!/^[\d\s+().-]+$/.test(formatted)) return false;
    const digits=formatted.replace(/[\s().-]/g,'');
    let national;
    if(digits.startsWith('+971')) national=digits.slice(4);
    else if(digits.startsWith('00971')) national=digits.slice(5);
    else if(digits.startsWith('0')) national=digits.slice(1);
    else return false;
    if(!/^(?:5[024568]\d{7}|[234679]\d{7})$/.test(national)) return false;
    return !/^0+$/.test(national.slice(national.startsWith('5')?2:1));
}
function validWebsite(value,allowHandle=false) {
    if(allowHandle && typeof value==='string' && /^@[\p{L}\p{N}_.-]{1,64}$/u.test(value)) return true;
    try {
        if(typeof value!=='string' || /\s|[\x00-\x1f\x7f]/.test(value)) return false;
        const url=new URL(value);
        return ['http:','https:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') && url.hostname!=='localhost' && !url.hostname.endsWith('.localhost');
    } catch {return false;}
}
function validGoogleMaps(value) {
    if(!validWebsite(value)) return false;
    const url=new URL(value);
    if(url.port && !['80','443'].includes(url.port)) return false;
    if(url.hostname==='maps.app.goo.gl') return /^\/[^/]+/.test(url.pathname);
    if(url.hostname==='goo.gl') return /^\/maps\/[^/]+/.test(url.pathname);
    if(GOOGLE_MAP_SUBDOMAINS.has(url.hostname)) return true;
    const googleHost=url.hostname.startsWith('www.')?url.hostname.slice(4):url.hostname;
    return GOOGLE_MAP_HOSTS.has(googleHost) && /^\/maps(?:\/|$)/.test(url.pathname);
}
function inputPolicyError(value,policy) {
    if(!policy || value===undefined || value===null || (typeof value==='string' && !value.trim())) return null;
    const kind=policy.kind;
    if(['count','amount','area'].includes(kind)) {
        if(!['string','number'].includes(typeof value) || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(String(value))) return 'enter a non-negative number without exponent notation.';
        const numeric=Number(value);
        const decimals=String(value).split('.')[1]?.length || 0;
        if(!Number.isFinite(numeric) || numeric<(policy.min??0) || numeric>policy.max || decimals>(policy.precision??0) || (policy.integer && !Number.isInteger(numeric))) return `enter a value between ${policy.min??0} and ${policy.max} with at most ${policy.precision??0} decimal places.`;
        return null;
    }
    if(['choice','choices','attachment','repeat','date','year'].includes(kind)) return null;
    if(typeof value!=='string') return 'enter text.';
    const trimmed=value.trim();
    const length=Array.from(trimmed).length;
    if(policy.maxLength!==undefined && length>policy.maxLength) return `use at most ${policy.maxLength} characters.`;
    if(policy.minLength!==undefined && length<policy.minLength) return `use at least ${policy.minLength} characters.`;
    const controls=policy.allowNewlines ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/;
    if(controls.test(value)) return 'remove control characters.';
    if(policy.requireLetter && !/\p{L}/u.test(trimmed)) return 'include meaningful letters rather than numbers or symbols alone.';
    if(kind==='identifier' && (!/^[\p{L}\p{N} ./#_-]+$/u.test(trimmed) || !/[\p{L}\p{N}]/u.test(trimmed))) return 'use letters or digits with conventional spaces, dots, slashes, #, underscores or hyphens.';
    if(kind==='phone' && !validUAEPhone(trimmed)) return 'enter a valid UAE mobile or landline number (0, +971 or 00971 prefix).';
    if(kind==='website' && !validWebsite(trimmed,policy.allowHandle)) return 'enter a valid HTTP(S) website or social media link.';
    if(kind==='map' && !validGoogleMaps(trimmed)) return 'enter a genuine Google Maps link.';
    if(kind==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'enter a valid email address.';
    return null;
}
module.exports={inputPolicyError,validUAEPhone,normalizePhone,validWebsite,validGoogleMaps};
