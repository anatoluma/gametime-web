# Box Score Middleware — Spec Document

## Overview

A backend middleware that accepts uploaded FIBA box score images, extracts structured
stats via Claude Vision API, validates the data, resolves player names against the
roster, and writes approved results to the database.

---

## 1. API Endpoint

### POST /api/box-scores/upload

Accepts a box score image upload and creates a processing job.

**Request**
```
Content-Type: multipart/form-data
Fields:
  - file: image (JPEG, PNG, WebP, required)
  - season_id: integer (required)
  - competition_id: integer (required)
  - home_team_id: integer (optional — if known in advance)
  - away_team_id: integer (optional — if known in advance)
```

**Response 202 Accepted**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "created_at": "ISO8601"
}
```

### GET /api/box-scores/jobs/:job_id

Returns current job status and results.

**Response**
```json
{
  "job_id": "uuid",
  "status": "pending|extracting|validating|needs_review|approved|committed|rejected",
  "file_url": "https://storage/raw/...",
  "extraction": { ...raw extracted JSON or null... },
  "validation": {
    "passed": true,
    "checks": [
      { "rule_id": "points_sum_home", "severity": "hard", "passed": true, "detail": "47 == 47" },
      { "rule_id": "fd_range_check", "severity": "soft", "passed": false, "detail": "MET #5 FD=31 seems high" }
    ]
  },
  "name_resolution": [
    {
      "team_code": "ADM",
      "number": 1,
      "extracted_name": "M.Dolgatiov",
      "resolved_player_id": 42,
      "resolved_name": "M.Dolgaliov",
      "confidence": 0.91,
      "method": "fuzzy",
      "confirmed": false
    }
  ],
  "errors": []
}
```

### POST /api/box-scores/jobs/:job_id/approve

Approves a job that is in `needs_review` state, triggering DB write.

**Request**
```json
{
  "name_overrides": [
    { "team_code": "ADM", "number": 1, "player_id": 42 }
  ]
}
```

### POST /api/box-scores/jobs/:job_id/reject

Rejects a job with a reason.

**Request**
```json
{ "reason": "Duplicate upload — already committed as game #45" }
```

---

## 2. Processing Pipeline

Each stage is discrete. Failures at any stage update job status and stop processing.

```
PENDING
  → EXTRACTING   (call Claude Vision API)
  → VALIDATING   (run sanity checks)
  → NEEDS_REVIEW (if any check fails OR name confidence < threshold)
  → APPROVED     (manual approval or auto-approve if all checks pass)
  → COMMITTED    (written to stats tables)
```

A job can also move to `REJECTED` from `NEEDS_REVIEW` or `APPROVED`.

---

## 3. Database Schema

### processing_jobs
```sql
id               UUID PRIMARY KEY
status           VARCHAR(20) NOT NULL  -- enum: pending|extracting|validating|needs_review|approved|committed|rejected
season_id        INTEGER REFERENCES seasons(id)
competition_id   INTEGER REFERENCES competitions(id)
raw_file_path    TEXT NOT NULL         -- path in object storage, immutable
extraction_json  JSONB                 -- raw Claude output
validation_json  JSONB                 -- array of check results
resolution_json  JSONB                 -- array of name resolution results
error_message    TEXT
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()
committed_at     TIMESTAMPTZ
committed_by     INTEGER REFERENCES users(id)  -- null if auto-committed
```

### player_aliases
```sql
id               SERIAL PRIMARY KEY
alias_name       VARCHAR(100) NOT NULL   -- exactly as extracted: "M.Dolgatiov"
player_id        INTEGER REFERENCES players(id)
confidence       DECIMAL(4,3)            -- 0.000–1.000
resolution_method VARCHAR(20)            -- exact|fuzzy|number_hint|manual
confirmed_by     INTEGER REFERENCES users(id)  -- null if auto-resolved
source_job_id    UUID REFERENCES processing_jobs(id)
created_at       TIMESTAMPTZ DEFAULT now()

UNIQUE(alias_name, player_id)
```

### games (written on commit)
```sql
id               SERIAL PRIMARY KEY
source_job_id    UUID REFERENCES processing_jobs(id)
season_id        INTEGER REFERENCES seasons(id)
competition_id   INTEGER REFERENCES competitions(id)
game_number      INTEGER
played_at        TIMESTAMPTZ
duration_minutes INTEGER
home_team_id     INTEGER REFERENCES teams(id)
away_team_id     INTEGER REFERENCES teams(id)
home_score       INTEGER
away_score       INTEGER
crew_chief       VARCHAR(100)
umpires          TEXT[]
score_intervals  JSONB   -- { home: [2,7,...], away: [14,27,...] }
created_at       TIMESTAMPTZ DEFAULT now()
```

### game_player_stats (written on commit)
```sql
id               SERIAL PRIMARY KEY
game_id          INTEGER REFERENCES games(id)
source_job_id    UUID REFERENCES processing_jobs(id)
player_id        INTEGER REFERENCES players(id)
team_id          INTEGER REFERENCES teams(id)
is_starter       BOOLEAN
is_captain       BOOLEAN
dnp              BOOLEAN DEFAULT false
minutes          VARCHAR(6)    -- "MM:SS"
fg_made          SMALLINT
fg_att           SMALLINT
two_made         SMALLINT
two_att          SMALLINT
three_made       SMALLINT
three_att        SMALLINT
ft_made          SMALLINT
ft_att           SMALLINT
reb_off          SMALLINT
reb_def          SMALLINT
reb_tot          SMALLINT
assists          SMALLINT
turnovers        SMALLINT
steals           SMALLINT
blocks           SMALLINT
fouls_personal   SMALLINT
fouls_drawn      SMALLINT
plus_minus       SMALLINT
efficiency       SMALLINT
points           SMALLINT
created_at       TIMESTAMPTZ DEFAULT now()
```

### game_team_summary (written on commit)
```sql
id                        SERIAL PRIMARY KEY
game_id                   INTEGER REFERENCES games(id)
team_id                   INTEGER REFERENCES teams(id)
points_from_turnovers     SMALLINT
points_in_paint           SMALLINT
points_in_paint_att       SMALLINT
points_in_paint_pct       DECIMAL(4,1)
second_chance_points      SMALLINT
fast_break_points         SMALLINT
bench_points              SMALLINT
biggest_lead              SMALLINT
biggest_lead_score        VARCHAR(20)
biggest_scoring_run       SMALLINT
biggest_scoring_run_score VARCHAR(20)
lead_changes              SMALLINT
times_tied                SMALLINT
time_with_lead            VARCHAR(6)
```

---

## 4. Validation Rules

### Hard rules — block commit if failed
| rule_id | Description |
|---|---|
| `points_sum_home` | Sum of home player points == home_team.score |
| `points_sum_away` | Sum of away player points == away_team.score |
| `totals_row_home` | team_totals points for home team == home_team.score |
| `totals_row_away` | team_totals points for away team == away_team.score |
| `q4_end_home` | score_by_periods.home.q4_end == home_team.score |
| `q4_end_away` | score_by_periods.away.q4_end == away_team.score |
| `intervals_monotonic_home` | Each interval value >= previous (home) |
| `intervals_monotonic_away` | Each interval value >= previous (away) |
| `fg_impossible` | fg_made <= fg_att for every player |
| `three_impossible` | three_made <= three_att for every player |
| `ft_impossible` | ft_made <= ft_att for every player |
| `duplicate_game` | No committed game with same teams + date + score |

### Soft rules — flag for review, don't block
| rule_id | Description |
|---|---|
| `fd_range` | fouls_drawn > 10 for any player (likely column misread) |
| `dnp_has_stats` | DNP player has non-null stats |
| `zero_minutes_has_stats` | Player with 0:00 minutes has non-zero stats |
| `efficiency_null` | Any non-DNP player has null efficiency |
| `points_verify` | player.points != (two_made*2 + three_made*3 + ft_made) where two/three data present |

---

## 5. Name Resolution Logic

```
Input: { team_code, number, extracted_name }

Step 1 — Check alias table
  SELECT player_id FROM player_aliases
  WHERE alias_name = extracted_name AND confirmed = true
  → if found: use it, confidence = 1.0, method = "exact"

Step 2 — Fuzzy match against roster for that team
  Candidates = all players on team_code's roster this season
  Score each candidate with Jaro-Winkler(extracted_name, canonical_name)
  Best match score:
    >= 0.92 → auto-accept, method = "fuzzy", save to alias table unconfirmed
    0.70–0.91 → flag for review, return top 3 candidates
    < 0.70 → try Step 3

Step 3 — Jersey number hint
  If a player on the roster has the same jersey number:
    boost that player's fuzzy score by +0.15
    if boosted score >= 0.75 → flag for review with number_hint note
    else → mark as "new player candidate", flag for review

Step 4 — Human review
  Present extracted name + top candidates to reviewer
  On confirmation: save to alias table with confirmed_by = user_id
```

**Notes:**
- Normalise before matching: strip dots, lowercase, remove diacritics
- `M.Dolgaliov` and `M Dolgaliov` and `M.Dolgalyov` should all hit the same candidate
- Store original extracted string in alias table, not the normalised version

---

## 6. File Storage Layout

```
object-storage/
  box-scores/
    raw/{job_id}.jpg          ← original upload, never modified
    processed/{job_id}.jpg    ← resized if needed before Claude call
```

- Store `raw_file_path` on the job record immediately on upload
- Never delete raw files — needed for reprocessing
- Max upload size: 10MB
- Accepted types: image/jpeg, image/png, image/webp

---

## 7. Claude API Call

```javascript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8000,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Image }
      },
      { type: "text", text: EXTRACTION_PROMPT }  // see extraction-prompt.txt
    ]
  }]
});
```

**Cost estimate:** ~1600 input tokens per image + ~2000 output tokens
- Sonnet: ~$0.035 per image at standard rate
- With Batch API (50% off): ~$0.018 per image
- Use Batch API for any non-realtime processing

---

## 8. Auto-approve Conditions

A job can skip `NEEDS_REVIEW` and go directly to `APPROVED` if ALL of:
- All hard validation rules pass
- All soft validation rules pass
- All players resolved with confidence >= 0.92
- No new player candidates detected

Otherwise it requires human review.

---

## 9. Reprocessing

A committed job should never be deleted. If a job needs to be reprocessed:
1. Create a new job with the same raw file path
2. Run the full pipeline again
3. On commit of the new job, mark the old game record as `superseded_by = new_game_id`
4. Stats queries should filter `WHERE superseded_by IS NULL`

---

## 10. What to Build First (suggested order)

1. File upload endpoint + object storage + job record creation
2. Extraction service (Claude API call → save extraction_json to job)
3. Hard validation rules
4. DB write on clean jobs (skip name resolution initially, use team_code + number as key)
5. Name resolution + alias table
6. Soft validation rules
7. Review UI — list of jobs in needs_review, approve/reject, name override
8. Auto-approve logic
9. Reprocessing support
