"use strict";

// Convert supplier PDFs to static page images on the server.  The public reader
// uses these files instead of relying on every visitor's browser/pdf.js stack.
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const running = new Map();
const MAX_PAGES = 160;

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.once('error', reject);
        child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-600)}`)));
    });
}

function catalogFilePath(fileUrl) {
    if (typeof fileUrl !== 'string' || !fileUrl.startsWith('/uploads/')) return null;
    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    const absolute = path.resolve(process.cwd(), 'public', fileUrl.replace(/^\/+/, ''));
    return absolute.startsWith(`${uploadsRoot}${path.sep}`) ? absolute : null;
}

async function pdfMetadata(source) {
    const { execFile } = require('child_process');
    const output = await new Promise((resolve, reject) => {
        execFile('pdfinfo', [source], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(`pdfinfo failed: ${stderr || error.message}`));
            else resolve(stdout);
        });
    });
    const pages = Number((output.match(/^Pages:\s*(\d+)/m) || [])[1]);
    const size = output.match(/^Page size:\s*([\d.]+)\s+x\s+([\d.]+)/m);
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) {
        throw new Error(`Unsupported PDF page count: ${pages || 'unknown'}`);
    }
    const width = Number(size?.[1]) || 1;
    const height = Number(size?.[2]) || 1;
    return { pages, ar: Math.min(3, Math.max(0.5, Number((width / height).toFixed(4)) || 1.4)) };
}

async function renderCatalogPages(catalog, { force = false } = {}) {
    const id = Number(catalog?.id);
    const source = catalogFilePath(catalog?.file_url);
    if (!id || !source || !/\.pdf(?:$|\?)/i.test(catalog.file_url)) return false;
    const pagesDir = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(id));
    const manifest = path.join(pagesDir, 'manifest.json');
    if (!force) {
        try {
            const existing = JSON.parse(await fs.readFile(manifest, 'utf8'));
            if (Number(existing?.pages) > 0) return true;
        }
        catch { /* render missing or invalid output */ }
    }
    if (running.has(id)) {
        const activeRender = running.get(id);
        // A replacement may arrive while the previous file is still rendering.
        // Queue one forced pass after it, otherwise an old page set could win.
        return force ? activeRender.then(() => renderCatalogPages(catalog, { force: true })) : activeRender;
    }
    const task = (async () => {
        try {
            await fs.access(source);
            await fs.mkdir(pagesDir, { recursive: true, mode: 0o755 });
            // Hide a stale or partial conversion.  The manifest is published only
            // after every page is complete, so readers never consume half a PDF.
            await fs.rm(manifest, { force: true });
            const meta = await pdfMetadata(source);
            for (let page = 1; page <= meta.pages; page += 1) {
                const fullPrefix = path.join(pagesDir, `${page}`);
                const thumbPrefix = path.join(pagesDir, `${page}-thumb`);
                await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-jpeg', '-jpegopt', 'quality=84', '-scale-to-x', '1400', '-scale-to-y', '-1', source, fullPrefix]);
                await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-jpeg', '-jpegopt', 'quality=72', '-scale-to-x', '180', '-scale-to-y', '-1', source, thumbPrefix]);
            }
            const manifestBody = JSON.stringify({ pages: meta.pages, ar: meta.ar, format: 'jpg', rev: Date.now() });
            const tempManifest = `${manifest}.${process.pid}.tmp`;
            await fs.writeFile(tempManifest, manifestBody, { mode: 0o644 });
            await fs.rename(tempManifest, manifest);
            return true;
        }
        catch (error) {
            console.error(`Catalog render failed for #${id}:`, error);
            return false;
        }
        finally {
            running.delete(id);
        }
    })();
    running.set(id, task);
    return task;
}

function enqueueCatalogRender(catalog, options) {
    void renderCatalogPages(catalog, options);
}

module.exports = { enqueueCatalogRender, renderCatalogPages, catalogFilePath };
