// src/routes/expense.ts
import { Router } from "express";
import controllers from "../controllers/index";

const router = Router();

router.post("/", controllers.ExpenseController.create);
router.get("/activity", controllers.ExpenseController.activityLog); // before /:id
router.get("/:id", controllers.ExpenseController.getOne);
router.patch("/:id", controllers.ExpenseController.update);
router.delete("/:id", controllers.ExpenseController.remove);

export default router;