import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';

export function validate(schema: {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          fields[path] = err.message;
        });

        return res.status(HttpStatus.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_FAILED,
          message: error.errors[0]?.message || 'Dữ liệu không hợp lệ',
          fields,
        });
      }
      next(error);
    }
  };
}
