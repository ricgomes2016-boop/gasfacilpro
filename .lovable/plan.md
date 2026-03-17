

## Problem

The `check-subscription` edge function returns 500 with "Auth session missing!" because `checkSubscription()` is called as soon as `user` exists, but the auth session token may not be fully ready yet. Also, it runs for ALL users (including clients, drivers) who don't need subscription checks.

## Plan

1. **`src/contexts/EmpresaContext.tsx`** — Guard the `checkSubscription` call:
   - Only call it when `user` exists AND `roles` are loaded (not empty)
   - Only call it for staff/admin users who actually need subscription info
   - Add `roles` to the dependency array of the useEffect that triggers the check
   - This prevents the 500 error for unauthenticated sessions and unnecessary calls for non-staff users

### Changes

In the useEffect at line 184-188, change the condition from `if (user && !authLoading)` to `if (user && !authLoading && isStaff)`, and add `roles` to deps so `isStaff` is evaluated correctly.

