import { Request, Response } from "express";
import prisma from "../db/prisma";

async function getSummary(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {month, year} = req.query;

    if(!month || !year) {
        res.status(400).json({error: "Month and year are required"});
        return;
    }

    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);

    try {
        const [incomeResult, expenseResult] = await prisma.$transaction([
            prisma.transaction.aggregate({
                where: {
                    userId: user.id,
                    type: "INCOME",
                    date: {gte: startDate, lt: endDate}
                },
                _sum: {amount: true}
            }),
            prisma.transaction.aggregate({
                where: {
                    userId: user.id,
                    type: "EXPENSE",
                    date: {gte: startDate, lt: endDate}
                },
                _sum: {amount: true}
            })
        ]);

        const income = Number(incomeResult._sum.amount ?? 0);
        const expenses = Number(expenseResult._sum.amount ?? 0);

        const net = income - expenses;

        res.status(200).json({income, expenses, net});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function getSummaryByCategory(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {month, year} = req.query;

    if(!month || !year) {
        res.status(400).json({error: "Month and year are requied"});
        return;
    }

    const startDate = new Date(Number(year), Number(month) - 1 , 1);
    const endDate = new Date(Number(year), Number(month), 1);

    try {
        const grouped = await prisma.transaction.groupBy({
            by: ["categoryId"],
            where: {
                userId: user.id,
                type: "EXPENSE",
                date: {gte: startDate, lt: endDate}
            },
            _sum: {amount: true}
        });

        const categoryIds = grouped.map(g => g.categoryId).filter(Boolean) as string[];

        const [categories, budgets] = await Promise.all([
            prisma.category.findMany({
                where: {id: {in: categoryIds}}
            }),
            prisma.budget.findMany({
                where: {
                    userId: user.id,
                    categoryId: {in: categoryIds},
                    month: Number(month),
                    year: Number(year)
                }
            })
        ]);

        const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
        const budgetMap = Object.fromEntries(budgets.map(b => [b.categoryId, b]));

        const result = grouped.map(g => ({
            category: g.categoryId ? categoryMap[g.categoryId] : null,
            spent: Number(g._sum.amount ?? 0),
            budget: g.categoryId ? Number(budgetMap[g.categoryId]?.amount ?? 0) : 0,
        }));

        res.status(200).json({breakdown: result, month, year});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function getSummaryOverTime(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { startDate, endDate, granularity = "daily" } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  if (granularity !== "daily" && granularity !== "weekly") {
    res.status(400).json({ error: "granularity must be daily or weekly" });
    return;
  }

  const truncUnit = granularity === "weekly" ? "week" : "day";

  try {
    type OverTimeRow = {
        period: Date;
        type: String;
        total: bigint;
    };

    const rows = await prisma.$queryRaw<OverTimeRow[]>`
      SELECT
        DATE_TRUNC(${truncUnit}, date) AS period,
        type,
        SUM(amount) AS total
      FROM transactions
      WHERE
        user_id = ${user.id}
        AND date >= ${new Date(String(startDate))}
        AND date < ${new Date(String(endDate))}
      GROUP BY period, type
      ORDER BY period ASC
    `;

    // reshape into { period, income, expense } per row
    const periodMap: Record<string, { period: string; income: number; expense: number }> = {};

    for (const row of rows) {
      const key = row.period.toISOString();
      if (!periodMap[key]) {
        periodMap[key] = { period: key, income: 0, expense: 0 };
      }
      if (row.type === "INCOME") periodMap[key].income = Number(row.total);
      if (row.type === "EXPENSE") periodMap[key].expense = Number(row.total);
    }

    const result = Object.values(periodMap);
    res.status(200).json({ data: result, granularity });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export default {
    getSummary,
    getSummaryByCategory,
    getSummaryOverTime
}