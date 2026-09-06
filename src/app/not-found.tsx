import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found."
      body="This path is not on the desk. The field is empty. Go home or open a page that exists."
    />
  );
}
