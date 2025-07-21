import { generateText } from "@/lib/openrouter";
import { NextRequest, NextResponse } from "next/server";
import snoowrap from "snoowrap";
import { kv } from "@vercel/kv";

const reddit = new snoowrap({
  userAgent: "SubHealthChecker/1.0",
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
});

const MAX_POSTS = 15;
const MAX_COMMENTS = 10;

// Cache TTL in seconds
const CACHE_TTL = 30 * 60; // 30 minutes
const POST_CACHE_TTL = 60 * 60; // 1 hour for individual posts

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subreddit, filter = "hot" } = body;

  if (!subreddit) {
    return NextResponse.json({ error: "Missing subreddit" }, { status: 400 });
  }

  try {
    // Check cache first
    const cacheKey = `subreddit_health:${subreddit}:${filter}`;
    const cachedResult = await kv.get(cacheKey);

    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return NextResponse.json(cachedResult);
    }

    console.log(`Cache miss for ${cacheKey}, fetching from Reddit...`);

    // Fetch and analyze subreddit data
    const result = await analyzeSubredditHealth(subreddit, filter);

    // Cache the result
    await kv.setex(cacheKey, CACHE_TTL, result);
    console.log(`Cached result for ${cacheKey} with TTL ${CACHE_TTL}s`);

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);

    // Check if this is a "subreddit does not exist" error
    if (err instanceof Error && err.message.includes("does not exist")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to analyze subreddit" },
      { status: 500 }
    );
  }
}

async function analyzeSubredditHealth(subreddit: string, filter: string) {
  const subredditObj = reddit.getSubreddit(subreddit);
  let posts;

  try {
    if (filter === "best") {
      posts = await subredditObj.getTop({ limit: MAX_POSTS, time: "week" });
    } else {
      posts = await subredditObj.getHot({ limit: MAX_POSTS });
    }
  } catch (error: unknown) {
    const errorObj = error as { statusCode?: number; message?: string };
    if (
      errorObj.statusCode === 404 ||
      errorObj.message?.includes("404") ||
      errorObj.message?.includes("not found") ||
      errorObj.message?.includes("Forbidden")
    ) {
      throw new Error(`Subreddit r/${subreddit} does not exist`);
    }
    // Re-throw other errors
    throw error;
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

    // Check if we have cached comment analysis for this post
    const postCacheKey = `post_comments:${post.id}`;
    let commentAnalysis = (await kv.get(postCacheKey)) as {
      ridicule: number;
      constructive: number;
      toxic: number;
      neutral: number;
      total: number;
    } | null;

    if (!commentAnalysis) {
      console.log(`Cache miss for post ${post.id}, analyzing comments...`);
      const comments = await (post.expandReplies({
        limit: MAX_COMMENTS,
        depth: 1,
      }) as Promise<{ comments: Comment[] }>);
      commentAnalysis = await analyzeComments(comments.comments);

      // Cache the comment analysis for this post
      await kv.setex(postCacheKey, POST_CACHE_TTL, commentAnalysis);
      console.log(`Cached comment analysis for post ${post.id}`);
    } else {
      console.log(`Cache hit for post ${post.id} comment analysis`);
    }

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

  // Generate Community Vibe Summary
  const vibeSummary = await generateCommunityVibeSummary(subreddit, data);

  return {
    ...data,
    vibeSummary,
  };
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

interface AnalyticsData {
  ignoredPercent: number;
  avgUpvotes: number;
  avgDownvotes: number;
  upvoteRatio: number;
  commentStats: {
    ridicule: number;
    constructive: number;
    toxic: number;
    neutral: number;
    total: number;
  };
  overallMood: string;
}

async function generateCommunityVibeSummary(
  subreddit: string,
  data: AnalyticsData
) {
  try {
    const response = await generateText({
      model: "google/gemini-2.5-flash",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
            You are an expert community analyst.  
            Generate a concise summary of a subreddit's community vibe based on the provided metrics.  

            Example Output 1:  
            This subreddit feels mostly supportive with a high level of constructive feedback and low ridicule. Posts are rarely ignored, and engagement is healthy relative to its size.

            Example Output 2:  
            The community is somewhat active, but replies can be hit or miss. While there's some useful feedback, sarcasm and off-topic comments show up regularly. A mixed bag overall.

            Example Output 3:  
            This subreddit leans hostile. Many comments are mocking or dismissive, and constructive discussion is rare. New posts often go unnoticed or are met with negativity.

          `,
        },
        {
          role: "user",
          content: `Analyze r/${subreddit} with these metrics:
            - ${data.ignoredPercent}% of posts are ignored (no comments/upvotes)
            - Average ${data.avgUpvotes} upvotes, ${data.avgDownvotes} downvotes per post
            - ${data.upvoteRatio}% upvote ratio
            - Comments: ${data.commentStats.constructive} constructive, ${data.commentStats.toxic} toxic, ${data.commentStats.ridicule} ridicule, ${data.commentStats.neutral} neutral out of ${data.commentStats.total} total
            - Overall mood: ${data.overallMood}
            .`,
        },
      ],
    });

    return (
      response ||
      "This community shows typical engagement patterns for its size and topic focus."
    );
  } catch (error) {
    console.error("Failed to generate vibe summary:", error);
    return "This community shows typical engagement patterns for its size and topic focus.";
  }
}
