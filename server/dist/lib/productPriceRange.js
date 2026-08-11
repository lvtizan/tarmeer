"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProductPrice = parseProductPrice;
exports.validateProductPriceRange = validateProductPriceRange;
const MAX_CENTS = 999999999999n;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

/** Parse a DECIMAL(12,2) boundary without floating-point range comparisons. */
function parseProductPrice(value, field, options = {}) {
    if (value === undefined)
        return { kind: 'absent' };
    if (value === null) {
        return options.allowClear
            ? { kind: 'clear', value: null, cents: null }
            : { kind: 'invalid', error: `${field} must be a decimal from 0.01 to 9999999999.99.` };
    }
    if (typeof value !== 'number' && typeof value !== 'string')
        return { kind: 'invalid', error: `${field} must be a decimal from 0.01 to 9999999999.99.` };
    const text = typeof value === 'number' ? String(value) : value;
    const match = DECIMAL_PATTERN.exec(text);
    if (!match || (typeof value === 'number' && !Number.isFinite(value)))
        return { kind: 'invalid', error: `${field} must be a decimal from 0.01 to 9999999999.99.` };
    const [whole, fraction = ''] = text.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (cents < 1n || cents > MAX_CENTS)
        return { kind: 'invalid', error: `${field} must be a decimal from 0.01 to 9999999999.99.` };
    return { kind: 'valid', value: `${whole}.${fraction.padEnd(2, '0')}`, cents };
}

function validateProductPriceRange(price, priceMax) {
    if (priceMax.kind === 'valid' && price.kind !== 'valid')
        return 'price_max requires a valid price.';
    if (price.kind === 'valid' && priceMax.kind === 'valid' && priceMax.cents < price.cents)
        return 'price_max must be greater than or equal to price.';
    return null;
}
