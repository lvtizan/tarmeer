# Testing Strategy

## Approach

- **Change-driven**: modify a domain, run that domain's test cases
- **Pre-deploy gate**: full-site.md smoke test before every deploy
- **Test cases evolve with features**: update test cases when adding new functionality

---

## Test Case Index

| Domain | File | Coverage |
|--------|------|----------|
| Auth | [auth-profile.md](auth-profile.md) | Registration, OAuth, login, avatar, roles |
| Full Site | [full-site.md](full-site.md) | All roles (anonymous, user, homeowner, company, admin), 50+ cases |
| Staging | [staging-flows.md](staging-flows.md) | Email reg, OAuth, profile, upload on staging env |
| Site Config | [site-config.md](site-config.md) | Fixed business config (address, maps, WhatsApp, Instagram) |

---

## When to Run What

| Change | Test File | Priority |
|--------|-----------|----------|
| Auth changes (login, register, OAuth, tokens) | auth-profile.md | Required |
| Any UI changes | full-site.md (smoke) | Required |
| Pre-deploy (any deploy) | full-site.md | Mandatory |
| New company features | full-site.md company section | Required |
| Staging promotion | staging-flows.md | Required |
| Business config changes (address, contact) | site-config.md | Required |
| Image/avatar changes | auth-profile.md TC-04 + full-site.md TC-X.5 | Required |

---

## Running Tests

All test cases are manual checklists. For API smoke tests, see the curl commands in full-site.md (TC-API section) and auth-profile.md (bottom section).

## Release Gate

Before promoting any change to production:

1. Run the relevant domain test cases above
2. Run full-site.md smoke test (mandatory for every deploy)
3. Verify post-deploy checklist in [deploy-runbook.md](../operations/deploy-runbook.md)
