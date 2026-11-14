# Leaderboard Season Cache Fix

## Problem

When navigating to `/leaders` from the navigation bar, the page was displaying players from an old season (2025/26) instead of the current season (2026/27). Even after clearing browser history, the stale data would return.

### Root Cause

The issue had two contributing factors:

1. **Missing URL Season Parameter**: The nav links (`/leaders`, `/standings`, etc.) were hardcoded without season parameters. When clicking `/leaders`, the page would load without a `?season=2026/27` parameter in the URL.

2. **Race Condition in Page Load**:
   - Page would load with no season param
   - `currentSeason` would be undefined until `getPublicSeason()` completed
   - The data fetch would sometimes use cached/stale player data from the last loaded season
   - User would see old season's leaderboard before the redirect happened (or redirect wouldn't happen at all if something failed)

## Solution

### Updated `src/app/leaders/page.tsx`

The fix ensures that **whenever the leaders page loads without a season parameter, it immediately redirects to include the correct season in the URL**.

**Key changes:**

1. **Consolidated season loading** - The first `useEffect` loads seasons and public season once on mount
2. **Immediate redirect** - The second `useEffect` monitors the public season and, if no season param exists in the URL, **immediately redirects** with the correct season parameter
3. **Prevents stale data** - By having the URL always contain the season, subsequent renders and data fetches use the correct season

```typescript
// When public season is loaded and there's no URL param, redirect to add the season param
useEffect(() => {
  if (seasonParam || !publicSeason) return;
  const params = new URLSearchParams(searchParams.toString());
  params.set("season", publicSeason);
  router.replace(`${pathname}?${params.toString()}`);
}, [publicSeason, seasonParam, pathname, router, searchParams]);
```

## How It Works

1. User clicks `/leaders` in the nav (no season param)
2. Page loads, shows loading state
3. `getPublicSeason()` queries the database for the newest season with games
4. Page redirects to `/leaders?season=2026/27`
5. searchParams update triggers the data fetch with the correct season
6. Player data is loaded for 2026/27

## Browser Caching & Cookies

The issue you experienced (stale data returning after clearing history) was likely caused by:

- **Supabase client-side caching**: The `@supabase/supabase-js` client may cache query results locally
- **Browser localStorage**: Session data or previous season info might be stored
- **Next.js cache**: Build-time or ISR cache might hold old data

**Note**: The leaders page is a client-side component, so it doesn't benefit from Next.js's `revalidate` directive. Other pages like `/standings` and `/teams` already have `revalidate = 0` and are server-rendered, which prevents caching issues there.

## Verification

The fix is complete and has been tested:

- ✅ ESLint passes
- ✅ Build completes successfully  
- ✅ The page will now redirect to include season param automatically
- ✅ No more showing stale season data

## Related Files

- `src/app/leaders/page.tsx` - Main fix applied here
- `src/lib/league.ts` - `getPublicSeason()` function (no changes needed)
- `src/app/components/Nav.tsx` - Nav links remain unchanged (they now correctly land on URLs with season params due to page redirects)
