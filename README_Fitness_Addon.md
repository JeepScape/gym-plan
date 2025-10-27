
# Apple Fitness → Gym Plan (GitHub Pages) via iOS Shortcuts

This adds a small "Today · Apple Fitness" card to your PWA. An iOS Shortcut updates `fitness.json`
in this repo daily with your Health data (steps, distance, active energy, exercise minutes, and today's workouts).

## Files
- `index.html` (patched) — includes the Fitness card and fetch code
- `fitness.json` — where your Shortcut writes today's metrics
- This README

## One-time GitHub setup
1. Create a **fine‑grained personal access token** on GitHub with access limited to *this repo only* and **Contents: Read/Write**.
2. Keep the token on your device (Shortcuts will use it in headers).

## Shortcut outline (build in the Shortcuts app on iPhone)
1) **Get Health Data**
   - Action: *Get Health Sample* → Type **Steps**, Date Range **Today**, *Get Total* → Save to `steps`
   - Action: *Get Health Sample* → **Walking/Running Distance**, Today, *Get Total* → convert to kilometers → `distance_km`
   - Action: *Get Health Sample* → **Active Energy**, Today, *Get Total* → `active_kcal`
   - Action: *Get Health Sample* → **Apple Exercise Time**, Today, *Get Total* → minutes → `exercise_minutes`
   - Action: *Find Workouts* → Date **Today**
     - *Repeat with Each* workout:
       - Make Dictionary: `type`: `Workout Name`, `minutes`: `Duration`
     - Collect into a List `workouts`

2) **Build JSON**
   - Make Dictionary with keys:
     - `date`: Format Current Date as `yyyy-MM-dd`
     - `steps`: **steps**
     - `distance_km`: **distance_km**
     - `active_energy_kcal`: **active_kcal**
     - `exercise_minutes`: **exercise_minutes**
     - `workouts`: **workouts**
   - Action: *Dictionary → JSON* (call this `jsonBody`)
   - Action: *Base64 Encode* `jsonBody` (call this `contentB64`)

3) **Fetch current SHA (needed by GitHub API)**
   - Action: *Get Contents of URL* (GET)
     - URL: `https://api.github.com/repos/jeepscape/gym-plan/contents/fitness.json`
     - Headers:
       - `Authorization: Bearer YOUR_TOKEN`
       - `Accept: application/vnd.github+json`
   - Action: *Get Dictionary from* result → read `sha` → save as `currentSha`

4) **Write the file (PUT to GitHub)**
   - Action: *Get Contents of URL* (PUT)
     - URL: `https://api.github.com/repos/jeepscape/gym-plan/contents/fitness.json`
     - Headers:
       - `Authorization: Bearer YOUR_TOKEN`
       - `Accept: application/vnd.github+json`
     - JSON Body:
       ```
       {
         "message": "update fitness.json",
         "content": "<contentB64>",
         "sha": "<currentSha>"
       }
       ```
     - (Replace the placeholders with the Shortcut variables you created.)

5) **Automate**
   - Shortcuts → **Automation** → **Time of Day** (e.g., 23:59) → Run the Shortcut (allow without asking).

## Verify
- After the Shortcut runs once, open your site and you should see the **Today · Apple Fitness** card populated.
- The PWA fetches `fitness.json` with `cache: 'no-store'` so it shows fresh data on load.
