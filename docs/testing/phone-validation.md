# Phone Validation Test Cases

## Components covered
- `src/lib/phoneValidation.ts` (shared logic)
- `src/components/for-companies/CompanySignupForm.tsx`
- `src/components/home/Banner.tsx`
- `src/components/InquiryForm.tsx`

## TC-PV-01: UAE valid mobile numbers

| Input | Country | Expected |
|-------|---------|----------|
| 501234567 | +971 | Valid |
| 521234567 | +971 | Valid |
| 541234567 | +971 | Valid |
| 551234567 | +971 | Valid |
| 561234567 | +971 | Valid |
| 581234567 | +971 | Valid |

## TC-PV-02: UAE valid landline numbers

| Input | Country | Expected |
|-------|---------|----------|
| 211234567 | +971 | Valid |
| 312345678 | +971 | Valid |
| 412345678 | +971 | Valid |
| 612345678 | +971 | Valid |
| 712345678 | +971 | Valid |

## TC-PV-03: UAE invalid prefix

| Input | Country | Expected |
|-------|---------|----------|
| 101234567 | +971 | Error: must start with 50/52/54/55/56/58 |
| 801234567 | +971 | Error: invalid prefix |
| 901234567 | +971 | Error: invalid prefix |

## TC-PV-04: Fake number patterns

| Input | Country | Expected |
|-------|---------|----------|
| 000000000 | +971 | Error: Invalid phone number |
| 555555555 | +971 | Error: Invalid phone number (5+ consecutive) |
| 111111111 | +971 | Error: Invalid phone number (5+ consecutive) |
| 123456789 | +971 | Error: Invalid phone number (sequential) |
| 987654321 | +971 | Error: Invalid phone number (sequential) |

## TC-PV-05: Incomplete input (no error while typing)

| Input | Country | Expected |
|-------|---------|----------|
| 50 | +971 | No error (still typing) |
| 5012 | +971 | No error (still typing) |
| 50123456 | +971 | No error (8 digits, need 9) |

## TC-PV-06: KSA numbers

| Input | Country | Expected |
|-------|---------|----------|
| 501234567 | +966 | Valid |
| 551234567 | +966 | Valid |
| 101234567 | +966 | Error: KSA mobile must start with 5 |

## TC-PV-07: Other GCC (no prefix validation, only fake check)

| Input | Country | Expected |
|-------|---------|----------|
| 12345678 | +974 (Qatar) | Valid |
| 00000000 | +974 (Qatar) | Error: Invalid phone number |
| 55555555 | +965 (Kuwait) | Error: Invalid phone number |

## TC-PV-08: Form submit blocked

| Scenario | Expected |
|----------|----------|
| CompanySignupForm with invalid phone → click Get Started | Form does not submit, error shown |
| Banner with invalid phone → click submit | Form does not submit, error shown |
| InquiryForm with invalid phone → click submit | Form does not submit, error shown |
