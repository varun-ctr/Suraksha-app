import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sakhiRouter from "./sakhi-new";
import nearbyPlacesRouter from "./nearby-places";
import revenuecatRouter from "./revenuecat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sakhiRouter);
router.use(nearbyPlacesRouter);
router.use(revenuecatRouter);

export default router;
