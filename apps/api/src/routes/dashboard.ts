import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [stories, characters, storyboards, jobs] = await Promise.all([
      prisma.story.count({ where: { userId } }),
      prisma.character.count({ where: { userId } }),
      prisma.storyboard.count({ where: { userId } }),
      prisma.generationJob.count({ where: { userId } }),
    ]);

    const recentJobs = await prisma.generationJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.json({
      counts: { stories, characters, storyboards, jobs },
      recentJobs,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
