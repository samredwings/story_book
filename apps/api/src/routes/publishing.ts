import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const exportSchema = z.object({
  storyId: z.string(),
  format: z.enum(["pdf", "epub", "html", "markdown", "docx"]),
  includeImages: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});

router.post("/export", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = exportSchema.parse(req.body);

    const story = await prisma.story.findUnique({
      where: { id: data.storyId },
      include: {
        scenes: true,
        mediaAssets: data.includeImages,
      },
    });

    if (!story || story.userId !== userId) {
      return res.status(404).json({ error: "Story not found" });
    }

    let content = "";
    if (data.format === "markdown") {
      content = `# ${story.title}\n\n${story.content || ""}\n`;
      if (data.includeMetadata) {
        content += `\n---\nGenre: ${story.genre}\nRating: ${story.contentRating}\n`;
      }
    } else if (data.format === "html") {
      content = `<!DOCTYPE html><html><head><title>${story.title}</title></head><body><h1>${story.title}</h1><div>${(story.content || "").replace(/\n/g, "<br/>")}</div></body></html>`;
    } else {
      content = story.content || "";
    }

    res.json({
      success: true,
      format: data.format,
      title: story.title,
      content,
      note: data.format === "pdf" || data.format === "epub" || data.format === "docx"
        ? "Binary export formats return text body; client may convert further."
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export story" });
  }
});

export default router;
