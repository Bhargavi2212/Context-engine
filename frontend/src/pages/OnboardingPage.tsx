import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { postProductContextBulk } from "../services/productApi";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus";
import ProductWizard from "../components/wizard/ProductWizard";

type Phase = "welcome" | "wizard" | "upload";

export default function OnboardingPage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const navigate = useNavigate();
  const { hasProductContext, loading } = useOnboardingStatus();

  useEffect(() => {
    if (!loading && hasProductContext) {
      navigate("/dashboard", { replace: true });
    }
  }, [hasProductContext, loading, navigate]);

  const handleStartSetup = () => setPhase("wizard");

  const handleSkipAndExplore = async () => {
    try {
      await postProductContextBulk([{ section: "product_basics", data: {} }]);
      navigate("/dashboard", { replace: true });
    } catch {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleWizardComplete = () => setPhase("upload");

  const handleSkipUpload = () => navigate("/dashboard", { replace: true });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (phase === "welcome") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-8">
          <h1 className="text-3xl font-bold text-gray-100">
            Welcome to Context Engine!
          </h1>
          <p className="text-gray-400 text-lg">
            Let&apos;s set up your product so the AI knows your context.
          </p>
          <p className="text-gray-500">
            This takes about 5 minutes. Every step is skippable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleStartSetup}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Start Setup
            </button>
            <button
              onClick={handleSkipAndExplore}
              className="px-6 py-3 text-gray-400 hover:text-gray-100 border border-gray-700 rounded-lg hover:border-gray-600"
            >
              Skip and explore →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "wizard") {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-2xl mx-auto">
          <ProductWizard mode="onboarding" onComplete={handleWizardComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-8">
        <h2 className="text-xl font-semibold text-gray-100">
          Want to upload some feedback data?
        </h2>
        <p className="text-gray-500">
          Upload feedback and customer data to get insights. You can do this later from Settings.
        </p>
        <div className="flex flex-col gap-3">
          <button
            disabled
            className="px-6 py-3 bg-gray-800 text-gray-500 rounded-lg cursor-not-allowed"
          >
            Upload Feedback CSV (Coming in Phase 3)
          </button>
          <button
            disabled
            className="px-6 py-3 bg-gray-800 text-gray-500 rounded-lg cursor-not-allowed"
          >
            Upload Customer CSV (Coming in Phase 3)
          </button>
          <button
            onClick={handleSkipUpload}
            className="px-6 py-3 text-gray-400 hover:text-gray-100 border border-gray-700 rounded-lg hover:border-gray-600"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
