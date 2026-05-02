import { Router } from "express";
import userRoutes from "./user";
import expenseRoutes from "./expense";
import balanceRoutes from "./balance";
const router = Router();

const defaultRoutes = [
  {
    path: '/user',
    route: userRoutes,
  },
  {
    path: '/expense',
    route: expenseRoutes,
  },
  {
    path: '/balance',
    route: balanceRoutes,
  }
];

defaultRoutes.forEach(({ path, route }) => { 
    router.use(path, route);
}); 

// Health check endpoint
router.get("/",async(req,res)=>{
  return res.status(200).send({ status:true, message: "Welcome to SplitWise MVP" });
});

export default router;
