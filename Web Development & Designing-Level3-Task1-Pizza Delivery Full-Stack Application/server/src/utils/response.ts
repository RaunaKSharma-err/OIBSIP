import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const sendOk = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

export const sendPaginated = <T>(res: Response, data: T[], pagination: PaginationMeta) =>
  res.status(200).json({ success: true, data, pagination });
