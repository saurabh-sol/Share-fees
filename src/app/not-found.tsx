import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error/ErrorScreen";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Page not found"),
  description: "This path is not on the Accrued desk.",
};

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found."
      body="This path is not on the desk. The field is empty. Go home or open a page that exists."
    />
  );
}
