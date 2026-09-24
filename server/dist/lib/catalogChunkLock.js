"use strict";

function lockConflict() {
    return Object.assign(new Error('Another catalog upload request is still processing. Please wait a moment and retry.'), { statusCode: 409 });
}

async function withCatalogChunkLock(pool, userId, task) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw lockConflict();
    const connection = await pool.getConnection();
    const lockName = `tarmeer:catalog-chunk:${id}`;
    let acquired = false;
    // Until GET_LOCK explicitly says "not acquired", the connection's lock
    // state is uncertain and it must not be returned to the pool.
    let safeToReuse = false;
    try {
        const [rows] = await connection.execute('SELECT GET_LOCK(?, 2) AS acquired', [lockName]);
        const acquiredValue = rows?.[0]?.acquired;
        acquired = acquiredValue === 1 || acquiredValue === '1';
        if (acquiredValue === 0 || acquiredValue === '0') {
            safeToReuse = true;
            throw lockConflict();
        }
        if (!acquired) throw new Error('Catalog upload lock returned an invalid database response.');
        return await task();
    }
    finally {
        if (acquired) {
            try {
                const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]);
                safeToReuse = Number(rows?.[0]?.released) === 1;
            }
            catch {
                safeToReuse = false;
            }
        }
        // A named lock belongs to the physical MySQL connection. Never return a
        // connection with an uncertain lock state to the pool.
        if (safeToReuse) connection.release();
        else connection.destroy();
    }
}

module.exports = { withCatalogChunkLock };
