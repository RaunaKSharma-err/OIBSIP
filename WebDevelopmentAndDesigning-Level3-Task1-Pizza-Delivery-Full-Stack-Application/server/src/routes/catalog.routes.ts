import { Router } from 'express';
import * as c from '../controllers/catalog.controller';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { listOptionsQuery, listPizzasQuery } from '../validators/catalog.validators';

export const pizzaRoutes = Router();
pizzaRoutes.get('/', validate({ query: listPizzasQuery }), c.listPizzas);
pizzaRoutes.get('/:id', validate({ params: idParam }), c.getPizza);

export const optionRoutes = Router();
optionRoutes.get('/', validate({ query: listOptionsQuery }), c.listOptions);
