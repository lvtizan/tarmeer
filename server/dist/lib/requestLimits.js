"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPayloadTooLargeError = exports.PAYLOAD_TOO_LARGE_MESSAGE = exports.UPLOAD_REQUEST_BODY_LIMIT = void 0;
exports.UPLOAD_REQUEST_BODY_LIMIT = '20mb';
exports.PAYLOAD_TOO_LARGE_MESSAGE = 'Uploaded files are too large. Please reduce file size or file count and try again.';
const isPayloadTooLargeError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    return (candidate.type === 'entity.too.large' ||
        candidate.code === 'LIMIT_FILE_SIZE' ||
        candidate.status === 413 ||
        candidate.statusCode === 413);
};
exports.isPayloadTooLargeError = isPayloadTooLargeError;
