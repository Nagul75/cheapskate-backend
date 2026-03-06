import { Request, Response } from "express";
import prisma from "../db/prisma";
import { TransactionType } from "../generated/prisma/enums";

async function getCategories(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [{ isDefault: true }, { userId: user.id }],
      },
    });

    if(categories.length === 0) {
        res.status(404).json({error: "Categories not found"});
    }

    res.status(200).json({
        default: categories.filter(c => c.isDefault),
        custom: categories.filter(c => !c.isDefault),
    });
  } catch (err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
  }
}

async function createCateogry(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {color, icon, name, transaction_type} = req.body as {
        color: string;
        icon: string;
        name: string;
        transaction_type: TransactionType;
    }

    if(!name && !transaction_type) {
        res.status(400).json({error: "Name and transaction type required"});
        return;
    }

    try {
        const category = await prisma.category.create({
            data: {
                color,
                icon,
                name,
                type: transaction_type,
                userId: user.id
            }
        });

        res.status(201).json({category});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function updateCategory(req: Request, res: Response) {
    const user = req.user
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    }

    const {color, icon, name, transaction_type} = req.body as {
        color: string;
        icon: string;
        name: string;
        transaction_type: TransactionType;
    }

    try {
        const existing = await prisma.category.findUnique({
            where: {id}
        });

        if (!existing) {
            res.status(404).json({error: "Category not found"});
            return;
        }

        if (existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const updated = await prisma.category.update({
            where: {
                id
            },
            data: {
                ...(name && {name}),
                ...(color && {color}),
                ...(icon && {icon}),
                ...(transaction_type && {type: transaction_type}),
            }
        });

        res.status(200).json({updated});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function deleteCategory(req: Request, res: Response) {
    const user = req.user;

    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    }

    try {
        const existing = await prisma.category.findUnique({
            where: {id}
        });

        if (!existing) {
            res.status(404).json({error: "Category not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const deleted = await prisma.category.delete({
            where: {
                id
            }
        });

        res.status(200).json({deleted});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
  getCategories,
  createCateogry,
  updateCategory,
  deleteCategory,
};
