"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRegistrationAvailabilityResult = buildRegistrationAvailabilityResult;
function buildRegistrationAvailabilityResult(input) {
    if (input.emailExists) {
        return {
            emailAvailable: false,
            phoneAvailable: !input.phoneExists,
            error: 'Email already registered',
        };
    }
    if (input.phoneExists) {
        return {
            emailAvailable: true,
            phoneAvailable: false,
            error: 'Phone already registered',
        };
    }
    return {
        emailAvailable: true,
        phoneAvailable: true,
        error: null,
    };
}
