import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sakhiRouter from "./sakhi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sakhiRouter);

export default router;
