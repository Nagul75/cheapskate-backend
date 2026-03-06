import { Request, Response } from "express";

import prisma from "../db/prisma";
import { TransactionType } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";

async function getUserTransactions(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { accountId, categoryId, type, startDate, endDate } = req.query as {
    accountId: string;
    categoryId: string;
    type: TransactionType;
    startDate: string;
    endDate: string;
  };

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        ...(accountId && { accountId }),
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
              },
            }
          : {}),
      },
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: "desc" },
    });
    res.status(200).json({transactions});
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function createTransaction(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { accountId, categoryId, amount, type, description, date } =
    req.body as {
      accountId: string;
      categoryId: string;
      amount: number;
      type: TransactionType;
      description?: string;
      date: string;
    };

  if (!accountId || !amount || !type || !date) {
    res
      .status(400)
      .json({ error: "accountId, amount, type, and date are required" });
    return;
  }

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (account.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const balanceDelta = type === "INCOME" ? amount : -amount;

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: user.id,
          accountId,
          categoryId,
          amount,
          type,
          description,
          date: new Date(date),
        },
      }),
      prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: balanceDelta } },
      }),
    ]);

    res.status(201).json({ transaction });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function updateTransaction(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params as {
    id: string;
  };

  const { accountId, categoryId, amount, type, description, date } =
    req.body as {
      accountId?: string;
      categoryId?: string;
      amount?: number;
      type?: TransactionType;
      description?: string;
      date?: string;
    };

  try {
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    if (existing.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const newAmount = amount ?? Number(existing.amount);
    const newType = type ?? existing.type;
    const newAccountId = accountId ?? existing.accountId;

    const accountChanged = newAccountId !== existing.accountId;
    const balanceAffected =
      accountChanged ||
      newAmount !== Number(existing.amount) ||
      newType !== existing.type;

    const oldDelta =
      existing.type === "INCOME"
        ? Number(existing.amount)
        : -Number(existing.amount);
    const newDelta = newType === "INCOME" ? newAmount : -newAmount;

    const transactionData = {
      ...(accountId && { accountId }),
      ...(categoryId !== undefined && { categoryId }),
      ...(amount && { amount }),
      ...(type && { type }),
      ...(description !== undefined && { description }),
      ...(date && { date: new Date(date) }),
    };

    let transaction;

    if (balanceAffected) {
      if (accountChanged) {
       [transaction] = await prisma.$transaction([
          prisma.transaction.update({ where: { id }, data: transactionData }),
          prisma.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: -oldDelta } },
          }),
          prisma.account.update({
            where: { id: newAccountId },
            data: { balance: { increment: newDelta } },
          }),
        ]);
      } else {
        [transaction] = await prisma.$transaction([
          prisma.transaction.update({ where: { id }, data: transactionData }),
          prisma.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: newDelta - oldDelta } },
          }),
        ]);
      }
    } else {
      transaction = await prisma.transaction.update({ where: { id }, data: transactionData });
    }
    res.status(200).json({transaction});
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function deleteTransaction(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    }

    try {
        const existing = await prisma.transaction.findUnique({
            where: {id}
        });

        if(!existing) {
            res.status(404).json({error: "Transaction not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const reverseDelta = existing.type === "INCOME" ? -Number(existing.amount) : Number(existing.amount);

        const [transaction] = await prisma.$transaction([
            prisma.transaction.delete({where: {id}}),
            prisma.account.update({
                where: {id: existing.accountId},
                data: {balance: {increment: reverseDelta}}
            })
        ]);

        res.status(200).json({transaction});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
  getUserTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
