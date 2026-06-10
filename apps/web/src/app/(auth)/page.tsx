import { AuthForms } from "@/components/auth/auth-forms";
import { isSignupEnabled } from "@/lib/auth/actions";

export default async function AuthPage() {
  return <AuthForms signupEnabled={await isSignupEnabled()} />;
}
