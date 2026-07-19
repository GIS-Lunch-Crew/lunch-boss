// context is loosely typed by @forge/resolver; accountId is always present
// for real invocations, but fail loudly rather than run queries against ''.
export const requireAccountId = (context: { accountId?: unknown }): string => {
  if (typeof context.accountId !== "string" || context.accountId === "") {
    throw new Error("Missing accountId in resolver context");
  }
  return context.accountId;
};
