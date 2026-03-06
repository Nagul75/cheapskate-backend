import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import accountController from "../controllers/accountController";
import categoryController from "../controllers/categoryController";
import transactionController from "../controllers/transactionController";
import budgetController from "../controllers/budgetController";
import dashboardController from "../controllers/dashboardController";

const apiRouter = Router();

apiRouter.use(authenticate);

// Accounts CRUD
apiRouter.get("/accounts", accountController.getUserAccounts);
apiRouter.post("/accounts", accountController.createAccount);
apiRouter.put("/accounts/:id", accountController.updateAccount);
apiRouter.delete("/accounts/:id", accountController.deleteAccount);

// Categories CRUD
apiRouter.get("/categories", categoryController.getCategories);
apiRouter.post("/categories", categoryController.createCateogry);
apiRouter.put("/categories/:id", categoryController.updateCategory);
apiRouter.delete("/categories/:id", categoryController.deleteCategory);

// Transactions CRUD
apiRouter.get("/transactions", transactionController.getUserTransactions);
apiRouter.post("/transactions", transactionController.createTransaction);
apiRouter.put("/transactions/:id", transactionController.updateTransaction);     // update + reconcile balance (not just simple update)
apiRouter.delete("/transactions/:id", transactionController.deleteTransaction);  // delete + reconcile balance (not just simple delete)

// Budgets CRUD
apiRouter.get("/budgets", budgetController.getBudgets);
apiRouter.post("/budgets", budgetController.createBudget);
apiRouter.put("/budgets/:id", budgetController.updateBudget);
apiRouter.delete("/budgets/:id", budgetController.deleteBudget);


// Dashboard API
apiRouter.get("/dashboard/summary", dashboardController.getSummary);        // monthly income, expenses, net
apiRouter.get("/dashboard/by-category", dashboardController.getSummaryByCategory);     // spending grouped by category
apiRouter.get("/dashboard/over-time", dashboardController.getSummaryOverTime);       // daily/weekly totals for a date range

export default apiRouter;