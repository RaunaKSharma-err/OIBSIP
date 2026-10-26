import * as catalog from '../services/catalog.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk, sendPaginated } from '../utils/response';

export const listPizzas = asyncHandler(async (req, res) => {
  const r = await catalog.listPizzas(req.validated.query);
  sendPaginated(res, r.data, r.pagination);
});
export const getPizza = asyncHandler(async (req, res) => {
  sendOk(res, await catalog.getPizza(req.validated.params.id));
});
export const listOptions = asyncHandler(async (req, res) => {
  sendOk(res, await catalog.listOptions(req.validated.query));
});
