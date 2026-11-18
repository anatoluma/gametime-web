# Updating Season Links for New Season

## When to Update

Update these links at the **beginning of a new season** to ensure users always see current season data by default.

## Files to Update

### 1. Navigation Links
**File:** `src/app/components/Nav.tsx` (lines 68-69)

```typescript
const navLinks = [
  { href: "/teams", label: t("nav_teams") },
  { href: "/games", label: t("nav_games") },
  { href: "/leaders?season=2026/27", label: t("nav_leaders") },  // ← UPDATE THIS
  { href: "/standings?season=2026/27", label: t("nav_standings") },  // ← UPDATE THIS
];
```

**Update steps:**
1. Change `2026/27` to the new season (e.g., `2027/28`)
2. Keep the format: `YYYY/YY` (e.g., `2027/28`)
3. Commit and deploy

## Example

For 2027/28 season:
```typescript
{ href: "/leaders?season=2027/28", label: t("nav_leaders") },
{ href: "/standings?season=2027/28", label: t("nav_standings") },
```

## Notes

- The season selector dropdown on each page still allows users to view historical seasons
- Only the **default** (navbar) link changes — users can always manually select other seasons
- The `/games`, `/teams`, and other pages auto-detect the latest season with games, so they don't need updates

## Why This Approach?

The hardcoded season in nav links prevents caching issues that occur with dynamic season detection. It's a simple, reliable solution that requires a one-line update per season.
