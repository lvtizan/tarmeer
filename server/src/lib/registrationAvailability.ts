export type RegistrationAvailabilityInput = {
  emailExists: boolean;
  phoneExists: boolean;
};

export type RegistrationAvailabilityResult = {
  emailAvailable: boolean;
  phoneAvailable: boolean;
  error: string | null;
};

export function buildRegistrationAvailabilityResult(
  input: RegistrationAvailabilityInput,
): RegistrationAvailabilityResult {
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
