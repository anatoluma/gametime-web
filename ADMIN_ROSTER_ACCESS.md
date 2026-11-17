# Admin roster and player photos

From `/admin`, choose **Edit rosters & player photos**, then select a team.
The editor manages the current-season roster and player photos without a
temporary link.

The admin editor sends an explicit admin-mode header to the manager APIs. Each
request verifies the bearer session against `ADMIN_EMAILS` or
`SUPER_ADMIN_EMAILS` before granting access to all teams. A temporary-link
cookie does not override admin access. Temporary links at `/manage` and
assigned managers at `/manager` remain restricted to their authorized teams.
