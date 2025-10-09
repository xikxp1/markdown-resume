/**
 * Nuxt client plugin to initialize GitHub retry queue on app startup.
 * This restores any pending retry timers from persisted storage (localForage).
 */
export default defineNuxtPlugin(() => {
  // Initialize the retry queue and restore timers
  initGithubRetryQueue();
});
