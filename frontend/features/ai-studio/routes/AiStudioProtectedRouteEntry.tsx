/**
 * Thin AI Studio route entry.
 * Owns auth/compliance bootstrap so the heavy studio runtime only loads after
 * protected-route prerequisites are satisfied.
 */
import dynamic from "next/dynamic";
import Head from "next/head";
import type { ParsedUrlQuery } from "querystring";
import { useRouter } from "next/router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { AppErrorBoundary } from "../../../components/AppErrorBoundary";
import { buildLoginPath } from "../../../lib/authRedirects";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { useProtectedRoute } from "../../../lib/authGuard";
import { ProtectedRouteSessionProvider } from "../../../lib/protectedRouteSessionContext";
import { MediaComplianceGate } from "../../compliance/components/MediaComplianceGate";
import { useMediaComplianceGate } from "../../compliance/hooks/useMediaComplianceGate";
import { createProject } from "../../projects/logic/projectCreateClient";
import { AiStudioProjectEntryState } from "../components/AiStudioProjectEntryState";

const loadAiStudioRouteApp = () => import("./AiStudioRouteApp");

const AiStudioEntryHead = () => (
  <Head>
    <title>ShortPulse · AI Studio</title>
    <meta name="description" content="AI Studio — prompt, generate, preview, save." />
  </Head>
);

const AiStudioEntryStateFrame = (props: ComponentProps<typeof AiStudioProjectEntryState>) => (
  <>
    <AiStudioEntryHead />
    <AiStudioProjectEntryState {...props} />
  </>
);

const AiStudioRouteApp = dynamic(loadAiStudioRouteApp, {
  loading: () => (
    <AiStudioEntryStateFrame
      variant="loading"
      phase="resolving-project"
      stepsAriaLabel="Project loading progress"
    />
  ),
});

type AiStudioProtectedRouteEntryProps = {
  RuntimeComponent?: ComponentType;
};

export const CHECKOUT_SUCCESS_PROJECT_TITLE = "Untitled Project";

const CHECKOUT_PROJECT_SESSION_STORAGE_PREFIX = "shortpulse.checkoutProject.";
const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutProjectLaunchIntent = {
  checkoutSessionId: string | null;
};

type CheckoutProjectLaunchState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "failed"; message: string };

const getQueryStringValue = (
  query: ParsedUrlQuery | undefined,
  searchParams: URLSearchParams,
  key: string
): string | null => {
  const queryValue = query?.[key];
  const rawValue = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    return rawValue.trim();
  }
  const paramValue = searchParams.get(key);
  return paramValue && paramValue.trim().length > 0 ? paramValue.trim() : null;
};

const resolveSearchParams = (asPath: string | undefined): URLSearchParams => {
  if (!asPath) return new URLSearchParams();
  try {
    return new URL(asPath, "https://shortpulse.local").searchParams;
  } catch {
    return new URLSearchParams();
  }
};

export const resolveCheckoutProjectLaunchIntent = ({
  query,
  asPath,
}: {
  query?: ParsedUrlQuery;
  asPath?: string;
}): CheckoutProjectLaunchIntent | null => {
  const searchParams = resolveSearchParams(asPath);
  const checkout = getQueryStringValue(query, searchParams, "checkout");
  const project = getQueryStringValue(query, searchParams, "project");
  const projectId = getQueryStringValue(query, searchParams, "projectId");
  if (checkout !== "subscription_success" || project !== "new" || projectId) {
    return null;
  }

  return {
    checkoutSessionId:
      getQueryStringValue(query, searchParams, "checkout_session_id") ??
      getQueryStringValue(query, searchParams, "checkoutSessionId"),
  };
};

const buildCheckoutProjectStorageKeys = ({
  checkoutSessionId,
  userId,
}: {
  checkoutSessionId: string | null;
  userId: string | null;
}): string[] => {
  if (!checkoutSessionId) return [];
  const keys = userId
    ? [`${CHECKOUT_PROJECT_SESSION_STORAGE_PREFIX}${userId}:${checkoutSessionId}`]
    : [];
  keys.push(`${CHECKOUT_PROJECT_SESSION_STORAGE_PREFIX}${checkoutSessionId}`);
  return Array.from(new Set(keys));
};

const getStoredCheckoutProjectId = ({
  checkoutSessionId,
  userId,
}: {
  checkoutSessionId: string | null;
  userId: string | null;
}): string | null => {
  if (!checkoutSessionId || typeof window === "undefined") return null;
  try {
    for (const key of buildCheckoutProjectStorageKeys({ checkoutSessionId, userId })) {
      const projectId = window.sessionStorage.getItem(key);
      if (projectId && PROJECT_ID_PATTERN.test(projectId)) return projectId;
    }
  } catch {
    // Session storage is best-effort; project ownership is verified by the API before reuse.
  }
  return null;
};

const rememberCheckoutProjectId = ({
  checkoutSessionId,
  userId,
  projectId,
}: {
  checkoutSessionId: string | null;
  userId: string | null;
  projectId: string;
}) => {
  if (!checkoutSessionId || typeof window === "undefined") return;
  try {
    for (const key of buildCheckoutProjectStorageKeys({ checkoutSessionId, userId })) {
      window.sessionStorage.setItem(key, projectId);
    }
  } catch {
    // Session storage is only a duplicate-navigation guard; project creation is still canonical.
  }
};

const forgetCheckoutProjectId = ({
  checkoutSessionId,
  userId,
}: {
  checkoutSessionId: string | null;
  userId: string | null;
}) => {
  if (!checkoutSessionId || typeof window === "undefined") return;
  try {
    for (const key of buildCheckoutProjectStorageKeys({ checkoutSessionId, userId })) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup failures; the next route read still verifies ownership server-side.
  }
};

const verifyStoredCheckoutProjectForCurrentUser = async (projectId: string): Promise<boolean> => {
  const response = await fetchWithAuth(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "GET",
    shortpulseAuthTimeoutMs: 5000,
    shortpulseRetryNetworkOnce: true,
  });
  if (response.ok) return true;
  if (response.status === 400 || response.status === 403 || response.status === 404) {
    return false;
  }
  throw new Error("Failed to verify your starter project. Try again.");
};

/**
 * Resolves route-access prerequisites before the full AI Studio runtime loads.
 */
export default function AiStudioProtectedRouteEntry({
  RuntimeComponent = AiStudioRouteApp,
}: AiStudioProtectedRouteEntryProps) {
  const router = useRouter();
  const checkoutProjectLaunchIntent = useMemo(
    () =>
      resolveCheckoutProjectLaunchIntent({
        query: router.query,
        asPath: router.asPath,
      }),
    [router.asPath, router.query]
  );
  const [checkoutProjectLaunchState, setCheckoutProjectLaunchState] =
    useState<CheckoutProjectLaunchState>({ status: "idle" });
  const checkoutProjectLaunchKeyRef = useRef<string | null>(null);
  const checkoutProjectLaunchStatusRef = useRef<CheckoutProjectLaunchState["status"]>("idle");
  const authRedirectPath = useMemo(
    () => buildLoginPath({ nextPath: router.asPath || "/dashboard" }),
    [router.asPath]
  );
  const { loading, session, user } = useProtectedRoute(true);
  const resolvedUser = user ?? session?.user ?? null;
  const resolvedUserId = resolvedUser?.id ?? null;
  const mediaCompliance = useMediaComplianceGate({
    enabled: Boolean(session),
    userId: resolvedUserId,
  });

  useEffect(() => {
    if (mediaCompliance.status !== "auth_recovery_required") return;
    void router.replace(authRedirectPath);
  }, [authRedirectPath, mediaCompliance.status, router]);

  useEffect(() => {
    if (loading || !session) return;
    if (mediaCompliance.status !== "accepted") return;
    if (checkoutProjectLaunchIntent) return;
    void loadAiStudioRouteApp();
  }, [checkoutProjectLaunchIntent, loading, mediaCompliance.status, session]);

  useEffect(() => {
    if (loading || !session) return;
    if (mediaCompliance.status !== "accepted") return;
    if (!checkoutProjectLaunchIntent) return;
    if (checkoutProjectLaunchStatusRef.current !== "idle") return;

    const launchKey = checkoutProjectLaunchIntent.checkoutSessionId ?? router.asPath;
    if (checkoutProjectLaunchKeyRef.current === launchKey) return;
    checkoutProjectLaunchKeyRef.current = launchKey;

    let isActive = true;
    const launchCheckoutProject = async () => {
      checkoutProjectLaunchStatusRef.current = "creating";
      setCheckoutProjectLaunchState({ status: "creating" });

      try {
        const storedProjectId = getStoredCheckoutProjectId({
          checkoutSessionId: checkoutProjectLaunchIntent.checkoutSessionId,
          userId: resolvedUserId,
        });
        if (storedProjectId) {
          const canReuseStoredProject =
            await verifyStoredCheckoutProjectForCurrentUser(storedProjectId);
          if (canReuseStoredProject) {
            await router.replace(
              { pathname: "/ai-studio", query: { projectId: storedProjectId } },
              undefined,
              { shallow: false }
            );
            return;
          }
          forgetCheckoutProjectId({
            checkoutSessionId: checkoutProjectLaunchIntent.checkoutSessionId,
            userId: resolvedUserId,
          });
        }

        const project = await createProject(CHECKOUT_SUCCESS_PROJECT_TITLE);
        rememberCheckoutProjectId({
          checkoutSessionId: checkoutProjectLaunchIntent.checkoutSessionId,
          userId: resolvedUserId,
          projectId: project.id,
        });
        if (!isActive) return;
        await router.replace(
          { pathname: "/ai-studio", query: { projectId: project.id } },
          undefined,
          { shallow: false }
        );
      } catch (error) {
        if (!isActive) return;
        checkoutProjectLaunchKeyRef.current = null;
        checkoutProjectLaunchStatusRef.current = "failed";
        setCheckoutProjectLaunchState({
          status: "failed",
          message:
            error instanceof Error && error.message.trim()
              ? error.message
              : "Failed to create your starter project.",
        });
      }
    };

    void launchCheckoutProject();
    return () => {
      isActive = false;
    };
  }, [
    checkoutProjectLaunchIntent,
    loading,
    mediaCompliance.status,
    router,
    session,
    resolvedUserId,
  ]);

  const retryCheckoutProjectLaunch = () => {
    checkoutProjectLaunchKeyRef.current = null;
    checkoutProjectLaunchStatusRef.current = "idle";
    setCheckoutProjectLaunchState({ status: "idle" });
  };

  if (loading || !session) {
    return (
      <AiStudioEntryStateFrame
        variant="loading"
        phase="resolving-project"
        message="Checking your session before project restore continues."
        activeStepIndex={0}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "loading") {
    return (
      <AiStudioEntryStateFrame
        variant="loading"
        phase="resolving-project"
        message="Checking your media agreement before project restore continues."
        activeStepIndex={1}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "auth_recovery_required") {
    return (
      <AiStudioEntryStateFrame
        variant="loading"
        phase="resolving-project"
        message="Refreshing your session before project restore continues."
        activeStepIndex={0}
        stepsAriaLabel="Project loading progress"
      />
    );
  }

  if (mediaCompliance.status === "service_unavailable") {
    return (
      <AppErrorBoundary>
        <MediaComplianceGate
          mode="unavailable"
          agreement={mediaCompliance.agreement}
          error={mediaCompliance.error}
          loading={mediaCompliance.loading}
          primaryActionLabel="Retry"
          showSecondaryAction={false}
          onAccept={mediaCompliance.acceptAgreement}
          onRetry={mediaCompliance.refreshStatus}
        />
      </AppErrorBoundary>
    );
  }

  if (mediaCompliance.status === "needs_consent") {
    return (
      <AppErrorBoundary>
        <MediaComplianceGate
          agreement={mediaCompliance.agreement}
          error={mediaCompliance.error}
          loading={mediaCompliance.loading}
          onAccept={mediaCompliance.acceptAgreement}
          onRetry={mediaCompliance.refreshStatus}
        />
      </AppErrorBoundary>
    );
  }

  if (mediaCompliance.status === "accepted" && checkoutProjectLaunchIntent) {
    if (checkoutProjectLaunchState.status === "failed") {
      return (
        <AiStudioEntryStateFrame
          variant="error"
          phase="resolving-project"
          errorTitle="Project creation failed"
          errorMessage={checkoutProjectLaunchState.message}
          primaryActionLabel="Try again"
          onPrimaryAction={retryCheckoutProjectLaunch}
          secondaryActionLabel="Go to dashboard"
          onSecondaryAction={() => {
            void router.replace("/dashboard");
          }}
        />
      );
    }

    return (
      <AiStudioEntryStateFrame
        variant="loading"
        phase="resolving-project"
        title={`Creating ${CHECKOUT_SUCCESS_PROJECT_TITLE}`}
        message="Saving your starter project before AI Studio opens."
        activeStepIndex={2}
        stepsAriaLabel="Project creation progress"
      />
    );
  }

  return (
    <ProtectedRouteSessionProvider session={session} user={resolvedUser ?? session.user}>
      <RuntimeComponent />
    </ProtectedRouteSessionProvider>
  );
}
