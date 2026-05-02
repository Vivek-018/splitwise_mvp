import express from "express";
import controllers from "../controllers";
const router = express.Router();

router.post("/signup", controllers.UserController.create);
router.get("/me", controllers.UserController.getMe);
router.patch("/me", controllers.UserController.updateMe);
router.delete("/me", controllers.UserController.deleteMe);

export default router;
