import { describe, it, expect, vi } from 'vitest';
import {
  ErrorCode,
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  createErrorResponse,
  ClientErrorHandler,
} from '@/lib/errorHandler';

describe('ErrorCode', () => {
  it('has expected authentication codes', () => {
    expect(ErrorCode.UNAUTHORIZED).toBe(1001);
    expect(ErrorCode.TOKEN_EXPIRED).toBe(1002);
  });

  it('has expected validation codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe(2001);
    expect(ErrorCode.INVALID_EMAIL).toBe(2002);
  });

  it('has expected resource codes', () => {
    expect(ErrorCode.NOT_FOUND).toBe(3001);
    expect(ErrorCode.ALREADY_EXISTS).toBe(3002);
  });

  it('has expected server error codes', () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe(5001);
    expect(ErrorCode.NETWORK_ERROR).toBe(5004);
  });
});

describe('AppError', () => {
  it('creates an error with code, message, and statusCode', () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, 'bad input', 400);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.message).toBe('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AppError');
  });

  it('defaults statusCode to 500', () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'server error');
    expect(err.statusCode).toBe(500);
  });

  it('supports details', () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, 'bad', 400, { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('specific error classes', () => {
  it('AuthenticationError sets 401 and correct code', () => {
    const err = new AuthenticationError('not logged in');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.name).toBe('AuthenticationError');
  });

  it('ValidationError sets 400', () => {
    const err = new ValidationError('invalid email');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('NotFoundError sets 404', () => {
    const err = new NotFoundError('resource missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('ConflictError sets 409', () => {
    const err = new ConflictError('duplicate');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(ErrorCode.CONFLICT);
  });
});

describe('createErrorResponse', () => {
  it('formats AppError into error response', () => {
    const err = new AppError(ErrorCode.VALIDATION_ERROR, 'bad input', 400, { field: 'name' });
    const resp = createErrorResponse(err, 'req-123');
    expect(resp.error).toBe('bad input');
    expect(resp.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(resp.statusCode).toBe(400);
    expect(resp.details).toEqual({ field: 'name' });
    expect(resp.requestId).toBe('req-123');
    expect(resp.timestamp).toBeTruthy();
  });

  it('formats generic Error into 500 response', () => {
    const err = new Error('something broke');
    const resp = createErrorResponse(err);
    expect(resp.error).toBe('something broke');
    expect(resp.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(resp.statusCode).toBe(500);
  });

  it('handles Error without message', () => {
    const err = new Error();
    const resp = createErrorResponse(err);
    expect(resp.error).toBeTruthy(); // fallback message
  });
});

describe('ClientErrorHandler', () => {
  describe('handleApiError', () => {
    it('returns message from AppError', () => {
      const err = new AppError(ErrorCode.VALIDATION_ERROR, 'bad input', 400);
      expect(ClientErrorHandler.handleApiError(err)).toBe('bad input');
    });

    it('extracts message from error.response.data', () => {
      const err = { response: { data: { error: 'server says no' } } };
      expect(ClientErrorHandler.handleApiError(err)).toBe('server says no');
    });

    it('handles network errors', () => {
      const err = { code: 'ERR_NETWORK' };
      expect(ClientErrorHandler.handleApiError(err)).toContain('Network error');
    });

    it('handles timeout errors', () => {
      const err = { code: 'ECONNABORTED' };
      expect(ClientErrorHandler.handleApiError(err)).toContain('timeout');
    });

    it('falls back to generic message', () => {
      const err = {};
      expect(ClientErrorHandler.handleApiError(err)).toContain('unexpected error');
    });
  });

  describe('retryWithErrorHandling', () => {
    it('returns result on success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await ClientErrorHandler.retryWithErrorHandling(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new AppError(ErrorCode.INTERNAL_ERROR, 'fail', 500))
        .mockResolvedValue('ok');
      const result = await ClientErrorHandler.retryWithErrorHandling(fn, 3, 10);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry 4xx errors', async () => {
      const fn = vi.fn().mockRejectedValue(
        new AppError(ErrorCode.VALIDATION_ERROR, 'bad', 400)
      );
      await expect(ClientErrorHandler.retryWithErrorHandling(fn, 3, 10))
        .rejects.toThrow('bad');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      await expect(ClientErrorHandler.retryWithErrorHandling(fn, 2, 10))
        .rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
