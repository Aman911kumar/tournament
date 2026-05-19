import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/api/profile";

const isMissing = (value?: string | null) => !String(value || "").trim();
const isProviderPhonePlaceholder = (value?: string | null) => /^(google|facebook):/i.test(String(value || "").trim());

export default function OnboardingGate() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    staleTime: 60_000,
    retry: 1,
  });

  const needsOnboarding = useMemo(() => {
    const user = data?.data?.user;
    if (!user) return false;
    if (!user.socialProvider) return false;

    const completedAt = user.onboarding?.completedAt || null;
    if (completedAt) return false;

    const phoneMissing = isMissing(user.phone_number) || isProviderPhonePlaceholder(user.phone_number);
    const dobMissing = !user.dateOfBirth;
    const legalMissing = !user.legalAgreements?.acceptedAt;

    return phoneMissing || dobMissing || legalMissing;
  }, [data?.data?.user]);

  if (isLoading) return null;
  if (isError) return null;
  if (!needsOnboarding) return null;

  return <Navigate to="/onboarding" replace />;
}
