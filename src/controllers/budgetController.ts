import { Request, Response } from "express";
import prisma from "../db/prisma";

async function getBudgets(req: Request, res: Response) {
  const user = req.user;
  const { month, year } = req.query;

  if (!month || !year) {
    res.status(400).json({ error: "month and year are required" });
    return;
  }

  const startDate = new Date(Number(year), Number(month) - 1, 1);
  const endDate = new Date(Number(year), Number(month), 1);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [budgets, spendingByCategory] = await Promise.all([
      prisma.budget.findMany({
        where: { userId: user.id, month: Number(month), year: Number(year) },
        include: {
          category: true,
          account: {
            select: {
              name: true,
              currency: true,
            },
          },
        },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: { gte: startDate, lt: endDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap = Object.fromEntries(
      spendingByCategory.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]),
    );

    const budgetsWithProgress = budgets.map((budget) => {
      const spent = budget.categoryId ? (spentMap[budget.categoryId] ?? 0) : 0;
      return {
        ...budget,
        spent,
        remaining: Number(budget.amount) - spent,
        progress:
          Number(budget.amount) > 0
            ? Math.round((spent / Number(budget.amount)) * 100)
            : 0,
      };
    });
    res.status(200).json({ budgets: budgetsWithProgress });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function createBudget(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { description, categoryId, amount, month, year, accountId } =
    req.body as {
      description: string;
      categoryId: string;
      amount: number;
      month: number;
      year: number;
      accountId: string;
    };

  if (!month || amount === undefined || !year || !categoryId || !accountId) {
    res.status(400).json({ error: "Amount, Account and time required" });
    return;
  }

  try {
    const budget = await prisma.budget.create({
      data: {
        description,
        userId: user.id,
        categoryId: categoryId,
        accountId: accountId,
        amount,
        month,
        year,
      },
    });

    res.status(201).json({ budget });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

async function updateBudget(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params as {
    id: string;
  };

  const { description, amount, month, year, category_id } = req.body as {
    description: string;
    category_id: string;
    amount: number;
    month: number;
    year: number;
  };

  try {
    const existing = await prisma.budget.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }

    if (existing.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updated = await prisma.budget.update({
      where: { id },
      data: {
        ...(amount && { amount }),
        ...(description && { description }),
        ...(month && { month }),
        ...(year && { year }),
        ...(category_id && { categoryId: category_id }),
      },
    });

    res.status(200).json({ updated });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function deleteBudget(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params as {
    id: string;
  };

  try {
    const existing = await prisma.budget.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Budget not found" });
      return;
    }

    if (existing.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const deleted = await prisma.budget.delete({
      where: { id },
    });

    res.status(200).json({ deleted });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export default {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
};
