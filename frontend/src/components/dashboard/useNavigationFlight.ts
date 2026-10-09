import { useEffect, useMemo } from "react";
import {
  createNavigationFlight,
  type NavigationFlight,
} from "@/lib/dashboard/navigation/navigationFlight";

/**
 * The stage owner's navigation flight (`navigationFlight.ts`). It belongs to the
 * owner instance: an owner that unmounts takes its flight with it, so no budget
 * can expire into an owner that no longer exists. `onExpire` must be stable
 * (`useCallback`): a new callback is a new flight.
 */
export function useNavigationFlight(
  onExpire: (abandonedTarget: string) => string | null,
): NavigationFlight {
  const flight = useMemo(() => createNavigationFlight(onExpire), [onExpire]);
  useEffect(() => () => flight.end(), [flight]);
  return flight;
}
