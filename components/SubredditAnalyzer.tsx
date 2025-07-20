"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Field,
  Input,
  Card,
  Text,
  Badge,
  VStack,
  HStack,
  Stat,
  Select,
  createListCollection,
  Heading,
} from "@chakra-ui/react";
import { ToggleTip } from "@/components/ui/toggle-tip";
import {
  LuInfo,
  LuFlame,
  LuStar,
  LuThumbsUp,
  LuMinus,
  LuX,
} from "react-icons/lu";

interface HealthData {
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
  vibeSummary?: string;
}

interface SubredditAnalyzerProps {
  initialSubreddit?: string;
  autoAnalyze?: boolean;
}

const filterOptions = createListCollection({
  items: [
    { label: "Hot", value: "hot", icon: LuFlame },
    { label: "Best", value: "best", icon: LuStar },
  ],
});

export default function SubredditAnalyzer({
  initialSubreddit = "",
  autoAnalyze = false,
}: SubredditAnalyzerProps) {
  const [subreddit, setSubreddit] = useState(initialSubreddit);
  const [filter, setFilter] = useState("best");
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subreddit.trim()) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/subreddit-health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subreddit: subreddit.trim(), filter }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze subreddit");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when component mounts with initial subreddit
  useEffect(() => {
    if (autoAnalyze && initialSubreddit.trim()) {
      handleSubmit();
    }
  }, [autoAnalyze, initialSubreddit]);

  // Update subreddit state when initialSubreddit prop changes
  useEffect(() => {
    setSubreddit(initialSubreddit);
  }, [initialSubreddit]);

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case "supportive":
        return "green";
      case "mixed":
        return "yellow";
      case "hostile":
        return "red";
      default:
        return "gray";
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case "supportive":
        return LuThumbsUp;
      case "mixed":
        return LuMinus;
      case "hostile":
        return LuX;
      default:
        return LuInfo;
    }
  };

  return (
    <div className="w-full">
      <div className="w-full">
        <Heading size="4xl" mb={0} fontWeight="bold">
          {subreddit.trim() ? `Rate r/${subreddit.trim()}` : "Rate Reddit"}
        </Heading>
        <Text fontSize="lg" color="gray.600" mb={4}>
          Analyze subreddit health and community sentiment
        </Text>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <VStack gap={4} align="stretch">
          <HStack gap={4} align="end">
            <Field.Root flex={1}>
              <Field.Label>Subreddit</Field.Label>
              <Input
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value)}
                placeholder="Enter subreddit name (e.g., javascript)"
              />
            </Field.Root>
            <Field.Root w="100px">
              <Select.Root
                collection={filterOptions}
                value={[filter]}
                onValueChange={(details) => setFilter(details.value[0])}
              >
                <Select.Label>Filter</Select.Label>
                <Select.Control>
                  <Select.Trigger>
                    <HStack gap={2}>
                      {(() => {
                        const selectedOption = filterOptions.items.find(
                          (item) => item.value === filter
                        );
                        const IconComponent = selectedOption?.icon;
                        return IconComponent ? (
                          <IconComponent size={16} />
                        ) : null;
                      })()}
                      <Select.ValueText placeholder="Select filter" />
                    </HStack>
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Select.Positioner>
                  <Select.Content>
                    {filterOptions.items.map((option) => (
                      <Select.Item item={option} key={option.value}>
                        <HStack gap={2}>
                          <option.icon size={16} />
                          {option.label}
                        </HStack>
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
            </Field.Root>
          </HStack>
          <Button
            type="submit"
            loading={loading}
            loadingText="Rating, please wait..."
            disabled={!subreddit.trim()}
            mb={8}
          >
            Check Health Rate
          </Button>
        </VStack>
      </form>

      {error && (
        <Card.Root bg="red.50" borderColor="red.200">
          <Card.Body>
            <Text color="red.600">{error}</Text>
          </Card.Body>
        </Card.Root>
      )}

      {data && (
        <Card.Root>
          <Card.Header>
            <HStack justify="space-between" align="center">
              <Text fontSize="xl" fontWeight="bold">
                r/{subreddit} Health Report
              </Text>
              <Badge
                colorPalette={getMoodColor(data.overallMood)}
                size="lg"
                px={4}
                py={2}
                fontSize="md"
                fontWeight="semibold"
                textTransform="capitalize"
              >
                <HStack gap={2} align="center">
                  {(() => {
                    const IconComponent = getMoodIcon(data.overallMood);
                    return <IconComponent size={16} />;
                  })()}
                  {data.overallMood}
                </HStack>
              </Badge>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack gap={6} align="stretch">
              {data.vibeSummary && (
                <Card.Root
                  bg="blue.50"
                  borderColor="blue.200"
                  borderWidth="1px"
                >
                  <Card.Body py={4}>
                    <VStack gap={2} align="start">
                      <HStack gap={2} align="center">
                        <Text
                          fontSize="md"
                          fontWeight="semibold"
                          color="blue.700"
                        >
                          🌟 Community Vibe Summary
                        </Text>
                      </HStack>
                      <Text
                        fontSize="md"
                        color="blue.800"
                        lineHeight="relaxed"
                        fontStyle="italic"
                      >
                        &ldquo;{data.vibeSummary}&rdquo;
                      </Text>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              )}
              <HStack
                gap={0}
                wrap="wrap"
                divideX="1px"
                divideColor="border.muted"
              >
                <Stat.Root px={6} py={2}>
                  <HStack gap={1} align="center">
                    <Stat.Label>Posts Ignored</Stat.Label>
                    <ToggleTip content="Percentage of posts that received little to no engagement (0 or very low scores), suggesting the community showed minimal interest.">
                      <Button size="xs" variant="ghost">
                        <LuInfo />
                      </Button>
                    </ToggleTip>
                  </HStack>
                  <Stat.ValueText>{data.ignoredPercent}%</Stat.ValueText>
                </Stat.Root>
                <Stat.Root px={6} py={2}>
                  <HStack gap={1} align="center">
                    <Stat.Label>Avg Upvotes</Stat.Label>
                    <ToggleTip content="Average number of upvotes received per post in the analyzed sample.">
                      <Button size="xs" variant="ghost">
                        <LuInfo />
                      </Button>
                    </ToggleTip>
                  </HStack>
                  <Stat.ValueText>{data.avgUpvotes}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root px={6} py={2}>
                  <HStack gap={1} align="center">
                    <Stat.Label>Avg Downvotes</Stat.Label>
                    <ToggleTip content="Average number of downvotes received per post in the analyzed sample.">
                      <Button size="xs" variant="ghost">
                        <LuInfo />
                      </Button>
                    </ToggleTip>
                  </HStack>
                  <Stat.ValueText>{data.avgDownvotes}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root px={6} py={2}>
                  <HStack gap={1} align="center">
                    <Stat.Label>Upvote Ratio</Stat.Label>
                    <ToggleTip content="Percentage of upvotes relative to total votes (upvotes + downvotes). Higher ratios indicate more positive reception.">
                      <Button size="xs" variant="ghost">
                        <LuInfo />
                      </Button>
                    </ToggleTip>
                  </HStack>
                  <Stat.ValueText>{data.upvoteRatio}%</Stat.ValueText>
                </Stat.Root>
              </HStack>

              <div>
                <Text fontSize="lg" fontWeight="semibold" mb={3}>
                  Comment Analysis ({data.commentStats.total} comments)
                </Text>
                <HStack
                  gap={0}
                  wrap="wrap"
                  divideX="1px"
                  divideColor="border.muted"
                >
                  <VStack px={6} py={4} flex={1} align="center" gap={2}>
                    <HStack gap={1} align="center">
                      <Text fontWeight="medium">Constructive</Text>
                      <ToggleTip content="Comments that provide helpful feedback, suggestions, or positive engagement that adds value to the discussion.">
                        <Button size="xs" variant="ghost">
                          <LuInfo />
                        </Button>
                      </ToggleTip>
                    </HStack>
                    <Badge
                      colorPalette="green"
                      size="lg"
                      fontSize="lg"
                      fontWeight="bold"
                    >
                      {data.commentStats.constructive}
                    </Badge>
                  </VStack>
                  <VStack px={6} py={4} flex={1} align="center" gap={2}>
                    <HStack gap={1} align="center">
                      <Text fontWeight="medium">Ridicule</Text>
                      <ToggleTip content="Comments that mock, belittle, or dismiss posts/users in a non-constructive way, but aren't necessarily toxic.">
                        <Button size="xs" variant="ghost">
                          <LuInfo />
                        </Button>
                      </ToggleTip>
                    </HStack>
                    <Badge
                      colorPalette="yellow"
                      size="lg"
                      fontSize="lg"
                      fontWeight="bold"
                    >
                      {data.commentStats.ridicule}
                    </Badge>
                  </VStack>
                  <VStack px={6} py={4} flex={1} align="center" gap={2}>
                    <HStack gap={1} align="center">
                      <Text fontWeight="medium">Toxic</Text>
                      <ToggleTip content="Comments containing harassment, hate speech, personal attacks, or other harmful content that violates community standards.">
                        <Button size="xs" variant="ghost">
                          <LuInfo />
                        </Button>
                      </ToggleTip>
                    </HStack>
                    <Badge
                      colorPalette="red"
                      size="lg"
                      fontSize="lg"
                      fontWeight="bold"
                    >
                      {data.commentStats.toxic}
                    </Badge>
                  </VStack>
                  <VStack px={6} py={4} flex={1} align="center" gap={2}>
                    <HStack gap={1} align="center">
                      <Text fontWeight="medium">Neutral</Text>
                      <ToggleTip content="Comments that are neither particularly positive nor negative, including neutral responses, off-topic remarks, and general discussion.">
                        <Button size="xs" variant="ghost">
                          <LuInfo />
                        </Button>
                      </ToggleTip>
                    </HStack>
                    <Badge
                      colorPalette="gray"
                      size="lg"
                      fontSize="lg"
                      fontWeight="bold"
                    >
                      {data.commentStats.neutral}
                    </Badge>
                  </VStack>
                </HStack>
              </div>
            </VStack>
          </Card.Body>
        </Card.Root>
      )}
    </div>
  );
}
