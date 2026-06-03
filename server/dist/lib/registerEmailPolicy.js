"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRegisterEmailStatus = buildRegisterEmailStatus;
function buildRegisterEmailStatus({ verificationSent }) {
    if (verificationSent) {
        return {
            emailSent: true,
            message: 'Registration successful! Please check your email to verify your account.',
        };
    }
    return {
        emailSent: false,
        message: 'Registration created, but verification email could not be delivered. Please retry sending verification email.',
    };
}
