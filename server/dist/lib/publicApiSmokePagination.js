"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDescendingNumberField = assertDescendingNumberField;
exports.assertDescendingComparableField = assertDescendingComparableField;
exports.assertPaginationMatchesRequest = assertPaginationMatchesRequest;
exports.assertCrossPageDescendingBoundary = assertCrossPageDescendingBoundary;
exports.assertNoOverlappingIds = assertNoOverlappingIds;
exports.collectSmokeSampleIds = collectSmokeSampleIds;
const strict_1 = __importDefault(require("node:assert/strict"));
function toComparableValue(value, fieldName) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
            return asNumber;
        }
        const asDate = Date.parse(value);
        strict_1.default.equal(Number.isNaN(asDate), false, `${fieldName} must be numeric or date-like`);
        return asDate;
    }
    strict_1.default.fail(`${fieldName} must be numeric or date-like`);
}
function assertDescendingNumberField(items, fieldName) {
    for (let index = 1; index < items.length; index += 1) {
        const previous = Number(items[index - 1]?.[fieldName]);
        const current = Number(items[index]?.[fieldName]);
        strict_1.default.equal(Number.isFinite(previous), true, `${fieldName} must be numeric`);
        strict_1.default.equal(Number.isFinite(current), true, `${fieldName} must be numeric`);
        strict_1.default.equal(previous >= current, true, `${fieldName} must be in descending order`);
    }
}
function assertDescendingComparableField(items, fieldName) {
    for (let index = 1; index < items.length; index += 1) {
        const previous = toComparableValue(items[index - 1]?.[fieldName], fieldName);
        const current = toComparableValue(items[index]?.[fieldName], fieldName);
        strict_1.default.equal(previous >= current, true, `${fieldName} must be in descending order`);
    }
}
function assertPaginationMatchesRequest(payload, request) {
    strict_1.default.equal(payload?.pagination?.page, request.page, 'pagination.page must match requested page');
    strict_1.default.equal(payload?.pagination?.limit, request.limit, 'pagination.limit must match requested limit');
}
function assertCrossPageDescendingBoundary(pageOneItems, pageTwoItems, fieldName) {
    if (pageOneItems.length === 0 || pageTwoItems.length === 0) {
        return;
    }
    const previous = Number(pageOneItems[pageOneItems.length - 1]?.[fieldName]);
    const current = Number(pageTwoItems[0]?.[fieldName]);
    strict_1.default.equal(Number.isFinite(previous), true, `${fieldName} must be numeric`);
    strict_1.default.equal(Number.isFinite(current), true, `${fieldName} must be numeric`);
    strict_1.default.equal(previous >= current, true, `${fieldName} must stay in descending order across pages`);
}
function assertNoOverlappingIds(pageOneItems, pageTwoItems) {
    const pageOneIds = new Set(pageOneItems.map((item) => String(item.id)));
    const overlappingIds = pageTwoItems
        .map((item) => String(item.id))
        .filter((id) => pageOneIds.has(id));
    strict_1.default.deepEqual(overlappingIds, [], 'duplicate ids across pages are not allowed');
}
function collectSmokeSampleIds(pageOneItems, pageTwoItems, maxSamples) {
    const result = [];
    const prioritized = [
        pageOneItems[0],
        pageTwoItems[0],
        ...pageOneItems.slice(1),
        ...pageTwoItems.slice(1),
    ].filter(Boolean);
    for (const item of prioritized) {
        const id = String(item.id);
        if (!result.includes(id)) {
            result.push(id);
        }
        if (result.length >= maxSamples) {
            break;
        }
    }
    return result;
}
