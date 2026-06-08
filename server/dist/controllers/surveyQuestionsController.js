"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuestions = listQuestions;
exports.createQuestion = createQuestion;
exports.updateQuestion = updateQuestion;
exports.deleteQuestion = deleteQuestion;
exports.reorderQuestions = reorderQuestions;

const database_1 = __importDefault(require("../config/database"));

async function ensureSurveyQuestionsTable() {
    try {
        await database_1.default.execute(`
            CREATE TABLE IF NOT EXISTS survey_questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                question_text VARCHAR(500) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.error('[survey_questions] ensureTable:', e.message);
    }
}
ensureSurveyQuestionsTable();

async function listQuestions(req, res) {
    try {
        const activeOnly = req.query.active !== 'false';
        const where = activeOnly ? 'WHERE is_active = 1' : '';
        const [rows] = await database_1.default.execute(
            `SELECT id, question_text, sort_order, is_active FROM survey_questions ${where} ORDER BY sort_order ASC, id ASC`
        );
        res.json({ questions: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function createQuestion(req, res) {
    const { question_text } = req.body;
    if (!question_text?.trim()) return res.status(400).json({ error: 'question_text required' });
    try {
        const [maxRow] = await database_1.default.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM survey_questions');
        const nextOrder = maxRow[0].next_order;
        const [result] = await database_1.default.execute(
            'INSERT INTO survey_questions (question_text, sort_order) VALUES (?, ?)',
            [question_text.trim(), nextOrder]
        );
        res.status(201).json({ id: result.insertId, question_text: question_text.trim(), sort_order: nextOrder, is_active: 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function updateQuestion(req, res) {
    const { id } = req.params;
    const { question_text, is_active } = req.body;
    try {
        const sets = [];
        const vals = [];
        if (question_text !== undefined) { sets.push('question_text = ?'); vals.push(question_text.trim()); }
        if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
        if (sets.length === 0) return res.json({ ok: true });
        vals.push(id);
        await database_1.default.execute(`UPDATE survey_questions SET ${sets.join(', ')} WHERE id = ?`, vals);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function deleteQuestion(req, res) {
    const { id } = req.params;
    try {
        await database_1.default.execute('DELETE FROM survey_questions WHERE id = ?', [id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function reorderQuestions(req, res) {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    try {
        for (let i = 0; i < ids.length; i++) {
            await database_1.default.execute('UPDATE survey_questions SET sort_order = ? WHERE id = ?', [i, ids[i]]);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
