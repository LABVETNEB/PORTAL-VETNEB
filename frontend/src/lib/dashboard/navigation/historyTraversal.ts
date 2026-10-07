/**
 * Start of a history traversal (Back/Forward) as a deterministic signal.
 *
 * The dashboard controllers must tell a commit produced by Back/Forward apart
 * from a late commit of a superseded router navigation, and the module alone
 * cannot do it: Back may land on an entry of the very module a superseded
 * activation targeted. `popstate` cannot carry the distinction either, because
 * the router can render the restored url before that event reaches us.
 *
 * The Navigation API `navigate` event fires when the traversal STARTS, before
 * the url changes and before `popstate`, so a flag raised here is already set
 * when the restore commit reaches the url effects. Where the API is missing the
 * subscription is a no-op and the `popstate` backstops keep their behaviour.
 */

type NavigateEventLike = Event & { readonly navigationType?: string };

export function subscribeHistoryTraversal(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  if (!navigation) return () => {};

  function onNavigate(event: Event) {
    if ((event as NavigateEventLike).navigationType === "traverse") listener();
  }

  navigation.addEventListener("navigate", onNavigate);
  return () => navigation.removeEventListener("navigate", onNavigate);
}
