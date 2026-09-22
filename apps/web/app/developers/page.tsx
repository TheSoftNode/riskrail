import { redirect } from "next/navigation";

// Developer settings moved inside the dashboard; keep old links working.
export default function DevelopersRedirect() {
  redirect("/dashboard/developers");
}
