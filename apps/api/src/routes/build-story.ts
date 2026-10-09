import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  analyzeImageForStory,
  generateStoryFromImageAnalyses,
  generateText,
  analyzeImageForStoryBangla,
  generateBanglaStoryFromImageAnalyses,
} from "../utils/ai-provider";

const router = Router();

type StoryAsset = {
  id: string;
  url: string;
  label: string | null;
  description: string | null;
  assetType: string;
};

const buildStorySchema = z.object({
  title: z.string().min(1).max(500),
  assetIds: z.array(z.string()).min(1).max(50),
  genre: z.enum([
    "ROMANCE",
    "FANTASY",
    "SCI_FI",
    "DRAMA",
    "MYSTERY",
    "ADVENTURE",
    "EROTICA",
    "THRILLER",
    "HORROR",
    "COMEDY",
    "OTHER",
    "BANGLA_INCEST_CHOTI",
  ]),
  contentRating: z
    .enum(["G", "PG", "PG_13", "R", "NC_17", "X", "XXX"])
    .default("XXX"),
  intimacyLevel: z.number().min(1).max(10).default(9),
  storyDirection: z.string().optional(),
  includeActType: z.string().optional(),
  characterDescriptions: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createScenes: z.boolean().default(true),
  sceneDuration: z.number().default(5),
  language: z.enum(["ENGLISH", "BANGLA"]).optional(),
  chotiMode: z.boolean().optional(),
});

router.post("/build-from-images", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = buildStorySchema.parse(req.body);

    const assets: StoryAsset[] = await prisma.mediaAsset.findMany({
      where: {
        id: { in: data.assetIds },
        userId,
      },
      orderBy: [{ sceneOrder: "asc" }, { createdAt: "asc" }],
    });

    if (assets.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid media assets found. Upload images first." });
    }

    if (assets.length !== data.assetIds.length) {
      return res.status(400).json({
        error:
          "Some media assets were not found. They may have been deleted or belong to another user.",
        foundCount: assets.length,
        requestedCount: data.assetIds.length,
      });
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });

    const sendProgress = (step: string, progress: number, message: string) => {
      res.write(
        JSON.stringify({
          type: "progress",
          step,
          progress,
          message,
          timestamp: new Date().toISOString(),
        }) + "\n",
      );
    };

    sendProgress("analyzing", 10, "Analyzing uploaded images...");

    const analyses = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      try {
        const analysis = await analyzeImageForStory(
          asset.url,
          asset.description || undefined,
        );
        analyses.push({
          imageUrl: asset.url,
          label: asset.label || `Scene ${i + 1}`,
          description: analysis.description,
          characters: analysis.characters,
          setting: analysis.setting,
          mood: analysis.mood,
          assetId: asset.id,
        });
        sendProgress(
          "analyzing",
          10 + Math.round(((i + 1) / assets.length) * 30),
          `Analyzed image ${i + 1}: ${asset.label || `Image ${i + 1}`}`,
        );
      } catch (error) {
        console.warn(`Failed to analyze asset ${asset.id}, using fallback:`, error);
        analyses.push({
          imageUrl: asset.url,
          label: asset.label || `Scene ${i + 1}`,
          description: asset.description || `A filthy sexual scene`,
          characters: [],
          setting: "Unknown",
          mood: "Highly aroused",
          assetId: asset.id,
        });
      }
    }

    sendProgress("writing", 45, "Weaving images into a hardcore explicit story...");

    const isBanglaChoti =
      data.genre === "BANGLA_INCEST_CHOTI" ||
      data.language === "BANGLA" ||
      data.chotiMode;

    let storyContent: string;

    if (isBanglaChoti) {
      const banglaAnalyses = analyses.map((a, i) => ({
        imageUrl: a.imageUrl,
        label: a.label || `Scene ${i + 1}`,
        description: a.description,
        characters: a.characters,
        setting: a.setting,
        mood: a.mood,
      }));

      storyContent = await generateBanglaStoryFromImageAnalyses(banglaAnalyses, {
        genre: data.genre,
        intimacyLevel: data.intimacyLevel,
        includeActType: data.includeActType,
        storyDirection: data.storyDirection,
        characterDescriptions: data.characterDescriptions,
      });
    } else {
      storyContent = await generateStoryFromImageAnalyses(analyses, {
        genre: data.genre,
        intimacyLevel: data.intimacyLevel,
        includeActType: data.includeActType,
        storyDirection: data.storyDirection,
        characterDescriptions: data.characterDescriptions,
      });
    }

    sendProgress("saving", 75, "Saving your explicit story...");

    const story = await prisma.story.create({
      data: {
        title: data.title,
        prompt: `Hardcore explicit story built from ${assets.length} images. Genre: ${data.genre}. Intimacy level: ${data.intimacyLevel}/10. Full sexual content allowed.`,
        content: storyContent,
        genre: data.genre as any,
        contentRating: data.contentRating as any,
        characters: [],
        tags: data.tags || [],
        userId,
        nsfwScore: 1.0,
        nsfwFlagged: false,
      },
    });

    await Promise.all(
      assets.map((asset, idx) =>
        prisma.mediaAsset.update({
          where: { id: asset.id },
          data: {
            storyId: story.id,
            sceneOrder: idx + 1,
          },
        }),
      ),
    );

    let scenes: any[] = [];
    if (data.createScenes) {
      sendProgress("scenes", 85, "Generating explicit video scenes...");
      scenes = await generateScenesFromStory(story.id, storyContent, analyses, data);
    }

    sendProgress("complete", 100, "Hardcore story created successfully!");

    res.write(
      JSON.stringify({
        type: "complete",
        story,
        scenes,
        mediaAssets: assets.map((a) => ({
          id: a.id,
          url: a.url,
          label: a.label,
          assetType: a.assetType,
        })),
        analysisCount: analyses.length,
        intimacyLevel: data.intimacyLevel,
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Build story from images error:", error);
    res.status(500).json({ error: "Failed to build story from images" });
  }
});

router.post("/reorder-assets", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { assetIds } = z
      .object({
        assetIds: z.array(z.string()),
      })
      .parse(req.body);

    await Promise.all(
      assetIds.map((id, index) =>
        prisma.mediaAsset.updateMany({
          where: { id, userId },
          data: { sceneOrder: index + 1 },
        }),
      ),
    );

    res.json({ success: true, message: "Assets reordered" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to reorder assets" });
  }
});

router.post(
  "/build-from-images/simple",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const data = buildStorySchema.parse(req.body);

      const assets: StoryAsset[] = await prisma.mediaAsset.findMany({
        where: {
          id: { in: data.assetIds },
          userId,
        },
        orderBy: [{ sceneOrder: "asc" }, { createdAt: "asc" }],
      });

      if (assets.length === 0) {
        return res
          .status(400)
          .json({ error: "No valid media assets found. Upload images first." });
      }

      const analyses = [];
      for (const asset of assets) {
        try {
          const analysis = await analyzeImageForStory(
            asset.url,
            asset.description || undefined,
          );
          analyses.push({
            imageUrl: asset.url,
            label: asset.label || `Scene`,
            description: analysis.description,
            characters: analysis.characters,
            setting: analysis.setting,
            mood: analysis.mood,
            assetId: asset.id,
          });
        } catch {
          analyses.push({
            imageUrl: asset.url,
            label: asset.label || `Scene`,
            description: asset.description || `A filthy sexual scene`,
            characters: [],
            setting: "Unknown",
            mood: "Highly aroused",
            assetId: asset.id,
          });
        }
      }

      const isBanglaChoti =
        data.genre === "BANGLA_INCEST_CHOTI" ||
        data.language === "BANGLA" ||
        data.chotiMode;

      let storyContent: string;

      if (isBanglaChoti) {
        storyContent = await generateBanglaStoryFromImageAnalyses(analyses, {
          genre: data.genre,
          intimacyLevel: data.intimacyLevel,
          includeActType: data.includeActType,
          storyDirection: data.storyDirection,
          characterDescriptions: data.characterDescriptions,
        });
      } else {
        storyContent = await generateStoryFromImageAnalyses(analyses, {
          genre: data.genre,
          intimacyLevel: data.intimacyLevel,
          includeActType: data.includeActType,
          storyDirection: data.storyDirection,
          characterDescriptions: data.characterDescriptions,
        });
      }

      const story = await prisma.story.create({
        data: {
          title: data.title,
          prompt: `Hardcore explicit story built from ${assets.length} images. Genre: ${data.genre}. Intimacy level: ${data.intimacyLevel}/10.`,
          content: storyContent,
          genre: data.genre as any,
          contentRating: data.contentRating as any,
          characters: [],
          tags: data.tags || [],
          userId,
          nsfwScore: 1.0,
          nsfwFlagged: false,
        },
      });

      await Promise.all(
        assets.map((asset, idx) =>
          prisma.mediaAsset.update({
            where: { id: asset.id },
            data: {
              storyId: story.id,
              sceneOrder: idx + 1,
            },
          }),
        ),
      );

      let scenes: any[] = [];
      if (data.createScenes) {
        scenes = await generateScenesFromStory(story.id, storyContent, analyses, data);
      }

      res.json({
        success: true,
        story,
        scenes,
        mediaAssetCount: assets.length,
        intimacyLevel: data.intimacyLevel,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Build story from images error:", error);
      res.status(500).json({ error: "Failed to build story from images" });
    }
  },
);

async function generateScenesFromStory(
  storyId: string,
  storyContent: string,
  analyses: Array<{
    imageUrl: string;
    label: string;
    description: string;
    characters: string[];
    setting: string;
    mood: string;
  }>,
  options: any,
): Promise<any[]> {
  const scenes = [];

  for (let i = 0; i < analyses.length; i++) {
    const analysis = analyses[i];
    let scenePrompt = analysis.description;

    try {
      const promptResult = await generateText({
        prompt: `Create an extremely explicit, hardcore video generation prompt for this scene. Focus on detailed sexual acts, wet pussy, thick cock, cum, sweat, intense fucking, body fluids, and graphic physical details:
Scene: ${analysis.description}
Mood: ${analysis.mood}
Setting: ${analysis.setting}
Characters: ${analysis.characters.join(", ")}
Generate a single highly detailed, filthy prompt (2-4 sentences) for AI video generation that shows full explicit sex.`,
        systemPrompt:
          "You create ultra-explicit hardcore video generation prompts. Be extremely graphic, vulgar, and detailed about sexual acts, genitals, cum, and physical intensity. No censorship.",
        maxTokens: 500,
        temperature: 0.85,
      });
      scenePrompt = promptResult.content.trim();
    } catch {
      scenePrompt = analysis.description.substring(0, 500);
    }

    const scene = await prisma.scene.create({
      data: {
        title: analysis.label || `Scene ${i + 1}`,
        description: analysis.description.substring(0, 1000),
        sceneNumber: i + 1,
        storyId,
        imageUrl: analysis.imageUrl,
        prompt: scenePrompt,
        motionStrength: options.motionIntensity || 0.75,
        duration: options.sceneDuration || 5,
        status: "PENDING",
      },
    });

    scenes.push(scene);
  }

  return scenes;
}

export default router;
