import { Request, Response } from "express";
import prisma from "../db/prisma";
import { AccountType } from "../generated/prisma/enums";

async function getUserAccounts(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const accounts = await prisma.account.findMany({
      where: {
        userId: user.id,
      },
    });

    if (accounts.length === 0) {
      res.status(404).json({ error: "No account found" });
      return;
    }

    res.status(200).json({
      accounts,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function createAccount(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }
    const {name, type, balance, currency} = req.body as {
        name: string;
        type: AccountType;
        balance: number;
        currency: string;
    }

    if (!name || !type || !balance) {
        res.status(400).json({error: "Invalid request"});
        return;
    }

    try {
        const account = await prisma.account.create({
            data: {
                userId: user.id,
                name,
                balance,
                currency,
                type
            },
            select: {
                id: true,
                balance: true,
                name: true,
                type: true,
                currency: true,
            }
        });
        res.status(201).json({account});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function updateAccount(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    };
    const {name, type, currency} = req.body as {
        name: string;
        type: AccountType;
        currency: string;
    };

    try {
        const existing = await prisma.account.findUnique({where: {id}});

        if(!existing) {
            res.status(404).json({error: "Account not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const updated = await prisma.account.update({
            where: {id},
            data: {
                ...(name && {name}),
                ...(type && {type}),
                ...(currency && {currency}),
            },
        });

        res.status(200).json({account: updated});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function deleteAccount(req: Request, res: Response) {
    const user = req.user;
    if (!user) {
        res.status(401).json({error: "unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    }

    try {
        const existing = await prisma.account.findUnique({
            where: {
                id
            }
        });

        if(!existing) {
            res.status(404).json({error: "Account not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Unauthorized"});
        }

        const deleted = await prisma.account.delete({
            where: {id}
        });
        res.status(200).json({deleted});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
  getUserAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
};
