import { generateText } from "@/lib/openrouter";
import { NextRequest, NextResponse } from "next/server";
import snoowrap from "snoowrap";

const reddit = new snoowrap({
  userAgent: "SubHealthChecker/1.0",
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
});

const MAX_POSTS = 15;
const MAX_COMMENTS = 10;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subreddit, filter = "hot" } = body;

  if (!subreddit) {
    return NextResponse.json({ error: "Missing subreddit" }, { status: 400 });
  }

  try {
    const subredditObj = reddit.getSubreddit(subreddit);
    let posts;

    if (filter === "best") {
      posts = await subredditObj.getTop({ limit: MAX_POSTS, time: "week" });
    } else {
      posts = await subredditObj.getHot({ limit: MAX_POSTS });
    }

    let ignored = 0,
      ridicule = 0,
      constructive = 0,
      toxic = 0,
      neutral = 0,
      totalComments = 0,
      totalUpvotes = 0,
      totalDownvotes = 0;

    for (const post of posts) {
      if (post.num_comments === 0 && post.ups === 0) ignored++; // consider posts with no comments and no upvotes as ignored

      const ups = post.ups;
      const ratio = post.upvote_ratio;

      // Estimate downvotes since Reddit API doesn't expose them directly
      const totalVotes = ratio > 0 ? ups / ratio : ups;
      const estimatedDowns = Math.max(0, Math.round(totalVotes - ups));

      totalUpvotes += ups;
      totalDownvotes += estimatedDowns;

      console.log("post.ups", ups);
      console.log("post.upvote_ratio", ratio);
      console.log("estimated downs", estimatedDowns);

      const comments = await (post.expandReplies({
        limit: MAX_COMMENTS,
        depth: 1,
      }) as Promise<{ comments: Comment[] }>);
      const commentAnalysis = await analyzeComments(comments.comments);

      ridicule += commentAnalysis.ridicule;
      constructive += commentAnalysis.constructive;
      toxic += commentAnalysis.toxic;
      neutral += commentAnalysis.neutral || 0;
      totalComments += commentAnalysis.total;
    }

    const data = {
      ignoredPercent: Math.round((ignored / posts.length) * 100),
      avgUpvotes: Math.round(totalUpvotes / posts.length),
      avgDownvotes: Math.round(totalDownvotes / posts.length),
      upvoteRatio:
        totalUpvotes + totalDownvotes > 0
          ? Math.round((totalUpvotes / (totalUpvotes + totalDownvotes)) * 100)
          : 0,
      commentStats: {
        ridicule,
        constructive,
        toxic,
        neutral,
        total: totalComments,
      },
      overallMood: getOverallMood(constructive, toxic),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to analyze subreddit" },
      { status: 500 }
    );
  }
}

function getOverallMood(constructive: number, toxic: number) {
  const ratio = constructive / (toxic + 1);
  if (ratio > 3) return "supportive";
  if (ratio > 1) return "mixed";
  return "hostile";
}

interface Comment {
  body?: string;
}

async function analyzeComments(comments: Comment[]) {
  if (comments.length === 0) {
    return {
      ridicule: 0,
      constructive: 0,
      toxic: 0,
      neutral: 0,
      total: 0,
    };
  }

  const response = await generateText({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Analyze each Reddit comment and classify it. Return a JSON array with one object per comment.`,
      },
      {
        role: "user",
        content: `Analyze these Reddit comments:\n\n${comments
          .map((c, i) => `${i + 1}. ${c.body || ""}`)
          .join("\n")}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "comment_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            comments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  constructive: {
                    type: "boolean",
                    description:
                      "Whether the comment is helpful or constructive",
                  },
                  toxic: {
                    type: "boolean",
                    description:
                      "Whether the comment contains toxic or harmful content",
                  },
                  mood: {
                    type: "string",
                    enum: ["supportive", "neutral", "aggressive", "sarcastic"],
                    description: "The overall mood/tone of the comment",
                  },
                },
                required: ["constructive", "toxic", "mood"],
                additionalProperties: false,
              },
            },
          },
          required: ["comments"],
          additionalProperties: false,
        },
      },
    },
  });

  // Parse the AI response
  let analysisResults;
  try {
    analysisResults = JSON.parse(response || "{}");
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    // Fallback to simple keyword analysis
    return fallbackAnalysis(comments);
  }

  // Count the different types
  let ridicule = 0,
    constructive = 0,
    toxic = 0;

  for (const analysis of analysisResults.comments) {
    if (analysis.constructive) constructive++;
    if (analysis.toxic) toxic++;
    if (analysis.mood === "sarcastic") ridicule++;
  }

  // Calculate neutral comments (everything that wasn't categorized above)
  const neutral = comments.length - (constructive + toxic + ridicule);

  return {
    ridicule,
    constructive,
    toxic,
    neutral,
    total: comments.length,
  };
}

function fallbackAnalysis(comments: Comment[]) {
  let ridicule = 0,
    constructive = 0,
    toxic = 0;

  for (const c of comments) {
    const text = c.body?.toLowerCase() || "";
    if (text.includes("lol") || text.includes("this is dumb")) ridicule++;
    if (
      text.includes("try") ||
      text.includes("suggest") ||
      text.includes("could")
    )
      constructive++;
    if (text.includes("idiot") || text.includes("shut up")) toxic++;
  }

  // Calculate neutral comments for fallback analysis
  const neutral = comments.length - (constructive + toxic + ridicule);

  return {
    ridicule,
    constructive,
    toxic,
    neutral,
    total: comments.length,
  };
}
