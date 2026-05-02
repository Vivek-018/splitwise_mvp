import { Router } from "express";
import controllers from "../controllers/index.js";

const router = Router();

router.get("/", controllers.BalanceController.getMyBalances);

export default router;
