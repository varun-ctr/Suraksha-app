import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sakhiRouter from "./sakhi-new";
import nearbyPlacesRouter from "./nearby-places";
import revenuecatRouter from "./revenuecat";
import authRouter from "./auth";
import sosAlertRouter from "./sos-alert";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sakhiRouter);
router.use(nearbyPlacesRouter);
router.use(revenuecatRouter);
router.use(authRouter);
router.use(sosAlertRouter);

export default router;
