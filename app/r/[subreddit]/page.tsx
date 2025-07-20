"use client";

import AppLayout from "@/components/AppLayout";
import SubredditAnalyzer from "@/components/SubredditAnalyzer";
import { use } from "react";

interface SubredditPageProps {
  params: Promise<{
    subreddit: string;
  }>;
}

export default function SubredditPage({ params }: SubredditPageProps) {
  // Await the params before accessing properties
  const { subreddit } = use(params);

  // Decode the subreddit name from the URL
  const subredditName = decodeURIComponent(subreddit);

  return (
    <AppLayout>
      <SubredditAnalyzer initialSubreddit={subredditName} autoAnalyze={true} />
    </AppLayout>
  );
}
