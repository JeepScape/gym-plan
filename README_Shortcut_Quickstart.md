# Fitness JSON + Shortcut Quickstart

Upload `fitness.json` to the root of your repo (`jeepscape/gym-plan`). Your Shortcut will overwrite it daily.

## Shortcut headers

**GET**
- URL: https://api.github.com/repos/jeepscape/gym-plan/contents/fitness.json
- Headers:
  - Authorization: Bearer <YOUR_TOKEN>
  - Accept: application/vnd.github+json

**PUT**
- URL: https://api.github.com/repos/jeepscape/gym-plan/contents/fitness.json
- Headers:
  - Authorization: Bearer <YOUR_TOKEN>
  - Accept: application/vnd.github+json
  - Content-Type: application/json
- Body:
{
  "message": "update fitness.json",
  "content": "<BASE64_OF_JSON>",
  "sha": "<CURRENT_SHA_FROM_GET>"
}

## Expected JSON
{
  "date": "YYYY-MM-DD",
  "steps": 1234,
  "distance_km": 2.34,
  "active_energy_kcal": 345,
  "exercise_minutes": 22,
  "workouts": [{"type": "Outdoor Walk", "minutes": 24}]
}
