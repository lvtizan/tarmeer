<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Field Survey Rules

**NEVER hardcode the survey schema (section titles, field keys, field labels, or options)** in any frontend file — not in the survey page, not in the admin visit-records detail view, nowhere.

The canonical schema lives in the `survey_schema` DB table and is served by `GET /api/field/survey-schema`. All components that render survey data MUST fetch from this endpoint and fall back to a minimal default only when the API returns null.

Rationale: hardcoded schemas cause silent data loss — fields added to the DB schema are never shown in the admin view, and filled answers go invisible without any error.
