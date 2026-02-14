import express from "express";
import { db } from "../db/index.js";
import { classes, subjects, user } from "../db/schema/index.js";
import {
    and,
    desc,
    eq,
    getTableColumns,
    ilike,
    sql,
} from "drizzle-orm";

const router = express.Router();

/**
 * Helper to parse Refine filter query params
 */
const parseRefineFilters = (query: any) => {
    const conditions = [];

    // Refine sends filters like:
    // filters[0][field]
    // filters[0][operator]
    // filters[0][value]

    const filterIndexes = new Set<string>();

    Object.keys(query).forEach((key) => {
        const match = key.match(/^filters\[(\d+)]\[field]$/);
        if (match) {
            filterIndexes.add(match[1]);
        }
    });

    filterIndexes.forEach((index) => {
        const field = query[`filters[${index}][field]`];
        const operator = query[`filters[${index}][operator]`];
        const value = query[`filters[${index}][value]`];

        if (!field || value === undefined) return;

        // -------- SEARCH / CONTAINS --------
        if (operator === "contains") {
            if (field === "name") {
                conditions.push(
                    ilike(classes.name, `%${value}%`)
                );
            }

            if (field === "subject") {
                conditions.push(
                    ilike(subjects.name, `%${value}%`)
                );
            }

            if (field === "teacher") {
                conditions.push(
                    ilike(user.name, `%${value}%`)
                );
            }
        }

        // -------- EXACT MATCH --------
        if (operator === "eq") {
            if (field === "subject") {
                conditions.push(eq(subjects.name, value));
            }

            if (field === "teacher") {
                conditions.push(eq(user.name, value));
            }

            if (field === "status") {
                conditions.push(eq(classes.status, value));
            }
        }
    });

    return conditions;
};

// =============================
// GET ALL CLASSES
// =============================
router.get("/", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        // 🔥 Parse Refine filters
        const filterConditions = parseRefineFilters(req.query);

        const whereClause =
            filterConditions.length > 0 ? and(...filterConditions) : undefined;

        // -------- COUNT QUERY --------
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        // -------- DATA QUERY --------
        const classesList = await db
            .select({
                ...getTableColumns(classes),
                subject: {
                    ...getTableColumns(subjects),
                },
                teacher: {
                    ...getTableColumns(user),
                },
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause)
            .orderBy(desc(classes.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: classesList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error("GET /classes error:", error);
        res.status(500).json({ error: "Failed to fetch classes" });
    }
});

// =============================
// CREATE CLASS
// =============================
router.post("/", async (req, res) => {
    try {
        const [createdClass] = await db
            .insert(classes)
            .values({
                ...req.body,
                inviteCode: Math.random().toString(36).substring(2, 9),
                schedules: [],
            })
            .returning({ id: classes.id });

        if (!createdClass) throw new Error("Class creation failed");

        res.status(201).json({ data: createdClass });
    } catch (error) {
        console.error("POST /classes error:", error);
        res.status(500).json({ error: "Failed to create class" });
    }
});

export default router;
