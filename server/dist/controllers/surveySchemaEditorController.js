"use strict";

// The schema is edited only from an active AE V7 draft.  This keeps the
// published template and the draft snapshot in step without rewriting any
// submitted or historical record snapshots.
const crypto = require('crypto');
const database = require('../config/database').default;
const verification = require('../lib/verificationV7');
const { logActivity } = require('./adminController');

const AE = 'ae';
const SHA256 = /^[a-f0-9]{64}$/;
const GENERATED_CUSTOM_KEY = /^custom_[a-f0-9]{32}$/;

function asObject(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    return value;
}

function json(value) {
    try {
        const parsed = verification.parseJSON(value);
        return asObject(parsed);
    } catch {
        return null;
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function canonicalJSON(value) {
    if (Array.isArray(value)) return value.map(canonicalJSON);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalJSON(value[key]);
            return result;
        }, {});
    }
    return value;
}

function revision(value) {
    // MySQL JSON normalises object key order while the MEDIUMTEXT catalogue
    // keeps the insertion order it was written with.  Hash a canonical object
    // representation so a successful write can always be used as the next
    // optimistic-concurrency revision; array order remains significant.
    return crypto.createHash('sha256').update(JSON.stringify(canonicalJSON(value))).digest('hex');
}

function permissionsOf(admin) {
    if (!admin) return {};
    if (typeof admin.permissions === 'string') {
        try { return asObject(JSON.parse(admin.permissions)) || {}; } catch { return {}; }
    }
    return asObject(admin.permissions) || {};
}

// Field staff are deliberately excluded even if someone writes a forged
// permission bit to their row.  Only the two roles below can ever edit.
function canEdit(req, country) {
    const admin = req.admin;
    if (country !== AE || !admin) return false;
    if (admin.role === 'super_admin') return true;
    return admin.role === 'sub_admin'
        && admin.country === AE
        && permissionsOf(admin).can_edit_survey_schema === true;
}

function explicitCountry(req, source) {
    const requested = source === 'body' ? req.body?.country : req.query?.country;
    // A super admin must explicitly pick AE.  A sub-admin is fixed to their
    // database country and must not be able to use a query/body override.
    if (requested !== AE) return false;
    return canEdit(req, AE);
}

function validDraftId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validFields(fields) {
    if (!Array.isArray(fields)) return false;
    const keys = new Set();
    for (const field of fields) {
        if (!asObject(field) || typeof field.key !== 'string' || !field.key || typeof field.type !== 'string' || !field.type || keys.has(field.key)) return false;
        keys.add(field.key);
        if (field.fields !== undefined && !validFields(field.fields)) return false;
    }
    return true;
}

function validSnapshot(schema) {
    if (!schema || schema.version !== verification.VERSION || schema.country !== AE || !Array.isArray(schema.sections)) return false;
    const keys = new Set();
    for (const section of schema.sections) {
        if (!asObject(section) || typeof section.key !== 'string' || !section.key || keys.has(section.key) || !validFields(section.fields)) return false;
        keys.add(section.key);
    }
    return true;
}

function validLabel(label) {
    if (typeof label !== 'string') return null;
    const next = label.trim();
    if (!next || Array.from(next).length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(next)) return null;
    return next;
}

function targetAt(schema, sectionKey, fieldPath) {
    if (!validSnapshot(schema) || typeof sectionKey !== 'string' || !Array.isArray(fieldPath) || !fieldPath.length
        || fieldPath.some(key => typeof key !== 'string' || !key || key.length > 160 || /[\u0000-\u001f\u007f]/.test(key))) return null;
    const section = schema.sections.find(item => item && item.key === sectionKey);
    if (!section || !Array.isArray(section.fields)) return null;
    let fields = section.fields;
    let field;
    for (let index = 0; index < fieldPath.length; index += 1) {
        const position = fields.findIndex(item => item && item.key === fieldPath[index]);
        if (position < 0) return null;
        field = fields[position];
        if (index === fieldPath.length - 1) return { fields, index: position, field };
        if (!Array.isArray(field.fields)) return null;
        fields = field.fields;
    }
    return null;
}

function sameTarget(publishedTarget, draftTarget) {
    return publishedTarget && draftTarget
        && publishedTarget.field.key === draftTarget.field.key
        && publishedTarget.field.type === draftTarget.field.type
        && publishedTarget.field.retired !== true
        && draftTarget.field.retired !== true;
}

function inheritedVisibility(field) {
    const inherited = {};
    if (field.group !== undefined) inherited.group = clone(field.group);
    if (field.visibleWhen !== undefined) inherited.visibleWhen = clone(field.visibleWhen);
    // groupKey is an implementation marker for the group controller.  Giving a
    // free-text child the same marker can hide it behind a different control.
    return inherited;
}

function applyAction(schema, action, sectionKey, fieldPath, label, customKey) {
    const target = targetAt(schema, sectionKey, fieldPath);
    if (!target || target.field.retired === true) return { error: 'The selected field is no longer editable.' };
    if (action === 'rename') {
        target.field.label = label;
        target.field.labelEn = label;
        return { target: target.field };
    }
    if (action === 'add') {
        const added = {
            key: customKey,
            label,
            labelEn: label,
            type: 'text',
            custom: true,
            required: false,
            inputPolicy: { maxLength: 2000 },
            ...inheritedVisibility(target.field),
        };
        target.fields.splice(target.index + 1, 0, added);
        return { target: target.field, added };
    }
    if (action === 'delete') {
        if (target.field.custom !== true || !GENERATED_CUSTOM_KEY.test(target.field.key)) {
            return { error: 'Only added custom fields can be deleted.' };
        }
        target.field.retired = true;
        return { target: target.field };
    }
    return { error: 'Unsupported schema action.' };
}

function mutationInput(body) {
    const action = body?.action;
    if (!['rename', 'add', 'delete'].includes(action)) return { error: 'Invalid schema action.' };
    if (!SHA256.test(body?.revision || '') || !SHA256.test(body?.draftRevision || '')) return { error: 'Schema revision is required.' };
    const draftId = validDraftId(body?.draftId);
    if (!draftId) return { error: 'A valid draft is required.' };
    const label = action === 'delete' ? null : validLabel(body?.label);
    if (action !== 'delete' && !label) return { error: 'Field name must be 1 to 120 characters without control characters.' };
    return {
        action,
        draftId,
        sectionKey: body?.sectionKey,
        fieldPath: body?.fieldPath,
        label,
        revision: body.revision,
        draftRevision: body.draftRevision,
    };
}

async function lockedContext(db, draftId) {
    const [publishedRows] = await db.execute('SELECT schema_json FROM survey_schema WHERE id = ? FOR UPDATE', [7]);
    const [draftRows] = await db.execute(
        'SELECT id, country, status, schema_version, schema_snapshot FROM company_interviews WHERE id = ? FOR UPDATE',
        [draftId],
    );
    const published = json(publishedRows[0]?.schema_json);
    const draft = json(draftRows[0]?.schema_snapshot);
    const record = draftRows[0];
    if (!published || !record || record.country !== AE || record.status !== 'draft'
        || record.schema_version !== verification.VERSION || !validSnapshot(published) || !validSnapshot(draft)) return null;
    return { published, draft, record };
}

async function getSurveySchemaEditor(req, res) {
    // This route is intentionally public-shaped: it lets an unlogged-in survey
    // renderer ask whether controls should be shown without revealing schema or
    // draft data.
    if (!explicitCountry(req, 'query')) return res.json({ canEdit: false });
    const draftId = validDraftId(req.query?.draftId);
    if (!draftId) return res.status(400).json({ error: 'A valid draftId is required.' });
    try {
        const [publishedRows] = await database.execute('SELECT schema_json FROM survey_schema WHERE id = ?', [7]);
        const [draftRows] = await database.execute(
            'SELECT id, country, status, schema_version, schema_snapshot FROM company_interviews WHERE id = ? LIMIT 1',
            [draftId],
        );
        const published = json(publishedRows[0]?.schema_json);
        const draft = json(draftRows[0]?.schema_snapshot);
        const record = draftRows[0];
        if (!published || !record || record.country !== AE || record.status !== 'draft'
            || record.schema_version !== verification.VERSION || !validSnapshot(published) || !validSnapshot(draft)) {
            return res.status(404).json({ error: 'Editable survey draft not found.' });
        }
        return res.json({
            canEdit: true,
            revision: revision(published),
            draftRevision: revision(draft),
            schema: verification.withValidationPolicies(draft),
        });
    } catch (error) {
        console.error('getSurveySchemaEditor:', error);
        return res.status(500).json({ error: 'Failed to load survey field settings.' });
    }
}

async function updateSurveySchemaEditor(req, res) {
    if (!explicitCountry(req, 'body')) return res.status(403).json({ error: 'Survey field editing is not permitted.' });
    const input = mutationInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    let db;
    let committed = false;
    try {
        db = await database.getConnection();
        await db.beginTransaction();
        const context = await lockedContext(db, input.draftId);
        if (!context) return res.status(404).json({ error: 'Editable survey draft not found.' });
        if (revision(context.published) !== input.revision || revision(context.draft) !== input.draftRevision) {
            return res.status(409).json({ error: 'Survey fields changed. Reload field settings before trying again.' });
        }
        const published = clone(context.published);
        const draft = clone(context.draft);
        const publishedBefore = targetAt(published, input.sectionKey, input.fieldPath);
        const draftBefore = targetAt(draft, input.sectionKey, input.fieldPath);
        if (!sameTarget(publishedBefore, draftBefore)) {
            return res.status(409).json({ error: 'The selected field differs from this draft. Reload field settings.' });
        }
        const customKey = input.action === 'add' ? `custom_${crypto.randomUUID().replace(/-/g, '')}` : null;
        const publishedResult = applyAction(published, input.action, input.sectionKey, input.fieldPath, input.label, customKey);
        const draftResult = applyAction(draft, input.action, input.sectionKey, input.fieldPath, input.label, customKey);
        if (publishedResult.error || draftResult.error) {
            return res.status(409).json({ error: publishedResult.error || draftResult.error || 'The selected field changed.' });
        }
        await db.execute('UPDATE survey_schema SET schema_json = ? WHERE id = ?', [JSON.stringify(published), 7]);
        await db.execute('UPDATE company_interviews SET schema_snapshot = ? WHERE id = ? AND status = ?', [JSON.stringify(draft), input.draftId, 'draft']);
        await db.commit();
        committed = true;
        // Audit is deliberately non-blocking: a schema mutation remains atomic
        // even on installations that have not created the legacy activity table.
        logActivity(req.admin.id, 'edit_survey_schema', 'company_interview', input.draftId, {
            action: input.action,
            sectionKey: input.sectionKey,
            fieldPath: input.fieldPath,
            fieldKey: customKey || publishedBefore.field.key,
        });
        return res.json({
            schema: verification.withValidationPolicies(draft),
            revision: revision(published),
            draftRevision: revision(draft),
        });
    } catch (error) {
        console.error('updateSurveySchemaEditor:', error);
        return res.status(500).json({ error: 'Failed to update survey fields.' });
    } finally {
        if (db) {
            if (!committed) await db.rollback();
            db.release();
        }
    }
}

module.exports = {
    canEdit,
    revision,
    canonicalJSON,
    targetAt,
    applyAction,
    getSurveySchemaEditor,
    updateSurveySchemaEditor,
};
