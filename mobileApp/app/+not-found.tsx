import { Redirect } from "expo-router";

export default function NotFoundScreen() {
  // Unknown routes fall through to the auth gate, which redirects by role.
  return <Redirect href="/sign-in" />;
}