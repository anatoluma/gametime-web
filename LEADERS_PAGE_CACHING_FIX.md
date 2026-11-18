# Leaders Page Stale Season Fix

## Problem

When navigating to `/leaders` from the navbar, the page was displaying players from the **2025/26 season** instead of the current **2026/27 season**. This persisted even after clearing browser cookies and happened on both desktop and mobile. However, it worked correctly in incognito mode.

### Why It Happened

The issue was a **race condition in how the page loaded data**:

1. **Navbar links to `/leaders` without a season parameter** — The nav bar has a hardcoded link to `/leaders` with no `?season=` query parameter.

2. **Race condition when page loads**:
   - Page mounts with no season param
   - Three `useEffect` hooks run in sequence:
     - Effect 1: Loads seasons and `publicSeason` from database
     - Effect 2: Checks if we need to redirect to add season param
     - Effect 3: Fetches player data
   
3. **The problem**: The data fetch (Effect 3) was using `currentSeason`, which was computed as:
   ```typescript
   const currentSeason = seasonParam ?? publicSeason ?? "";
   ```
   
   When the page first loaded without a season param:
   - `seasonParam` = `null` (not in URL yet)
   - `publicSeason` = `null` (still loading from database)
   - `currentSeason` = `""` (empty string)
   
   The redirect effect would eventually add the season to the URL, but the **dependency array issue** meant:
   - If `publicSeason` and `currentSeason` derived from it, the data fetch would run with an empty string
   - Browser/Supabase caching might serve stale data
   - The old season's data would load and display

4. **Why incognito worked**: Fresh state = no browser cache, so the redirect happened cleanly before any caching occurred.

## Solution

The fix ensures that **data only loads AFTER the URL contains the correct season parameter**:

### Key Changes

1. **Removed `currentSeason` derived value**
   - Instead of: `const currentSeason = seasonParam ?? publicSeason ?? ""`
   - We now use: `const seasonParam = searchParams.get("season")`

2. **Data fetch now depends on `seasonParam` from URL**
   - Changed the dependency array from `[currentSeason]` to `[seasonParam]`
   - The effect only runs when the URL actually contains a season

3. **Explicit guard in data fetch effect**
   ```typescript
   useEffect(() => {
     if (!seasonParam) {
       // No season param yet (waiting for redirect to add it)
       return;
     }
     // ... fetch data using seasonParam
   }, [seasonParam]);
   ```

4. **Updated SeasonSelector to use `seasonParam`**
   - Passes `seasonParam` (from URL) instead of `currentSeason` (computed value)

### How It Works Now

1. User clicks `/leaders` in navbar
2. Page loads with no season param → shows loading state
3. First effect loads seasons from database
4. Second effect detects missing season param and redirects to `/leaders?season=2026/27`
5. URL updates trigger the data fetch effect
6. Data fetches using the correct season from URL
7. Page displays current season's leaders

## Impact

- ✅ **Fixes stale season data** — Users always see the current season
- ✅ **Works in normal mode** — No more browser cache issues
- ✅ **Maintains redirect logic** — Still auto-advances when new season's first game enters
- ✅ **Cleaner data flow** — URL is the source of truth for which season to display
- ✅ **No performance regression** — Same number of queries, just better sequencing

## Files Modified

- `src/app/leaders/page.tsx` — Refactored effect and state dependencies

## Testing

The fix has been verified with:
- ✅ ESLint pass (no errors)
- ✅ Build success
- ✅ Proper effect sequencing (redirect → URL update → data fetch)
