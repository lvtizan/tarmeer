type RegisterEmailStatusParams = {
  verificationSent: boolean;
  notificationQueued: boolean;
};

export function buildRegisterEmailStatus({ verificationSent }: RegisterEmailStatusParams) {
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
