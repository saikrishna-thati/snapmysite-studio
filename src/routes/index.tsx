import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snapmy.site — Product launch films, directed by AI" },
      {
        name: "description",
        content:
          "Snapmy.site reads your product website and directs a professional launch film — storyboard, motion, score, and sound — in minutes.",
      },
      { property: "og:title", content: "Snapmy.site — Product launch films, directed by AI" },
      {
        property: "og:description",
        content:
          "Snapmy.site reads your product website and directs a professional launch film — storyboard, motion, score, and sound — in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ href: "/studio/index.html", replace: true });
  },
  component: () => null,
});
