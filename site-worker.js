// site-worker — the one script in front of globeskimmers.io's static site (2026-10-24). Every path
// that is a file under site/ is served straight from the assets without running this. The paths
// the API worker answers are handed to it through the API service binding, so links printed as
// globeskimmers.io/... work:
//   /p/<slug>   a shared passport (StampEarnedSheet's share card; returned the site 404 before)
//   /m/<code>   a postcard or telegram texted from someone's phone (handleLinkLanding)
//   /go/<os>    the store redirects those pages link to
// Anything else falls through to the assets, which answer with site/404.html.
const API_PATHS = /^\/(p|m|go)\//;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (API_PATHS.test(url.pathname) && request.method === 'GET') return env.API.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
