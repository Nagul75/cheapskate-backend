import { Request, Response } from "express";
import prisma from "../db/prisma";

async function getBudgets(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    try {
        const budgets = await prisma.budget.findMany({
            where: {
                userId: user.id
            }
        });

        res.status(200).json({budgets});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function createBudget(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {description, category_id, amount, month, year} = req.body as {
        description: string;
        category_id: string;
        amount: number;
        month: number;
        year: number;
    }

    if(!month || amount === undefined || !year) {
        res.status(400).json({error: "Amount and time required"});
        return;
    }

    try {
        const budget = await prisma.budget.create({
            data: {
                description,
                userId: user.id,
                categoryId: category_id,
                amount,
                month,
                year,
            }
        });

        res.status(201).json({budget});
    } catch(err) {
        res.status(500).json({error: "Internal server error"});
    }
}

async function updateBudget(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string
    }

    const {description, amount, month, year, category_id} = req.body as {
        description: string;
        category_id: string;
        amount: number;
        month: number;
        year: number;
    };

    try {
        const existing = await prisma.budget.findUnique({
            where: {id}
        });

        if(!existing) {
            res.status(404).json({error: "Budget not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const updated = await prisma.budget.update({
            where: {id},
            data: {
                ...(amount && {amount}),
                ...(description && {description}),
                ...(month && {month}),
                ...(year && {year}),
                ...(category_id && {categoryId: category_id})
            }
        });

        res.status(200).json({updated});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Internal server error"});
    }
}

async function deleteBudget(req: Request, res: Response) {
    const user = req.user;
    if(!user) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }

    const {id} = req.params as {
        id: string;
    }

    try {
        const existing = await prisma.budget.findUnique({
            where: {id}
        });
        if(!existing) {
            res.status(404).json({error: "Budget not found"});
            return;
        }

        if(existing.userId !== user.id) {
            res.status(403).json({error: "Forbidden"});
            return;
        }

        const deleted = await prisma.budget.delete({
            where: {id}
        });

        res.status(200).json({deleted});
    } catch(err) {
        res.status(500).json({error: "Internal server error"});
    }
}

export default {
    getBudgets,
    createBudget,
    updateBudget,
    deleteBudget
}