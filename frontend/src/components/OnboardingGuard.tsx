import { Navigate } from "react-router-dom";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";
import LoadingSpinner from "./common/LoadingSpinner";

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export default function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { hasProductContext, loading } = useOnboardingStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!hasProductContext) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
