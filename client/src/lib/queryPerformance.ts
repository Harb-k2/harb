export const harbQueryDefaults = {
  staleTime: 20_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export function shouldLoadControlAudit(isAuthenticated: boolean, workspace: "assistant" | "control") {
  return isAuthenticated && workspace === "control";
}
