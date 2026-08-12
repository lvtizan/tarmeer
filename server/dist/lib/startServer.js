"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAfterRequiredMigrations = startAfterRequiredMigrations;
exports.startProductionServer = startProductionServer;

async function startAfterRequiredMigrations({ migrate, listen, cleanup }) {
    try {
        await migrate();
        return await listen();
    }
    catch (error) {
        try {
            await cleanup();
        }
        catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'Server startup and cleanup failed');
        }
        throw error;
    }
}

async function startProductionServer({ runAutoMigrate, listen, cleanup }) {
    return startAfterRequiredMigrations({
        migrate: () => runAutoMigrate({ strict: true }),
        listen,
        cleanup,
    });
}
