import { createFileRoute, redirect } from "@tanstack/react-router";

// The studio is a static page under /public/studio; send /studio there when the
// request reaches the server (static-only hosts rewrite it in vercel.json).
export const Route = createFileRoute("/studio")({
  beforeLoad: () => {
    throw redirect({ href: "/studio/index.html", replace: true });
  },
  component: () => null,
});
