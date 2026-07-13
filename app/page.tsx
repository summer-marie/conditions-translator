import { redirect } from "next/navigation";

// The real app starts at /app/start (privacy notice -> workspace); there is no separate
// marketing/landing page in the MVP (docs/01_MVP_PRD.md's journey goes straight from
// Guest -> Create Document).
export default function Page() {
  redirect("/app/start");
}
