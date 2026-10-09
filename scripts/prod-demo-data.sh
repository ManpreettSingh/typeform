#!/usr/bin/env bash
# Adds a third demo form ("Product Launch Feedback") with 14 responses to a running API, using only curl.
#
#   API=https://typeform-production-3059.up.railway.app/api bash scripts/prod-demo-data.sh
#
# The seeded demo forms (Customer Feedback, Event Registration) are never touched.
# - Re-running is safe: a finished form (it has responses) is left alone; an unfinished one from a failed run
#   (a draft with no responses) is deleted and built again.
# - If a step fails for good, the half-built form is deleted, so nothing incomplete is left behind.
# - 502/503/504 and connection errors are retried: the host answers them while it is redeploying, which happens after
#   every push to main. Wait for the deploy to finish if it still fails.
set -euo pipefail

# No default on purpose: a bare run must never write into whatever happens to be on localhost:8000 (your own data).
if [[ -z "${API:-}" ]]; then
  echo "Set API first, e.g.:  API=https://typeform-production-3059.up.railway.app/api bash scripts/prod-demo-data.sh" >&2
  exit 1
fi
TITLE="Product Launch Feedback"
QUESTIONS=8
FORM_ID=""
FINISHED=""

cleanup() {
  if [[ -n "$FORM_ID" && -z "$FINISHED" ]]; then
    echo "Failed: removing the half-built form $FORM_ID so nothing incomplete stays on the server..." >&2
    curl -sS -o /dev/null -X DELETE "$API/forms/$FORM_ID" || echo "Could not delete form $FORM_ID: delete it by hand." >&2
  fi
}
trap cleanup EXIT

# call METHOD PATH [JSON] -> sets BODY. Retries transient errors; stops on any other non-2xx.
call() {
  local out attempt payload="${3:-}"
  for attempt in 1 2 3 4 5 6; do
    if out=$(curl -sS -m 60 -X "$1" "$API$2" -H 'Content-Type: application/json' ${3:+-d "$3"} -w $'\n%{http_code}' 2>&1); then
      CODE="${out##*$'\n'}"
      BODY="${out%$'\n'*}"
      case "$CODE" in
        2*) return 0 ;;
        502 | 503 | 504) ;; # the server is restarting: wait and try again
        *) echo "FAILED $1 $2 ${payload:0:70} -> $CODE: $BODY" >&2; exit 1 ;;
      esac
    fi
    echo "  ($1 $2 got ${CODE:-no answer}; waiting for the server, try $attempt of 6)" >&2
    CODE=""
    sleep 5
  done
  echo "FAILED $1 $2 ${payload:0:70} -> the server did not recover. Check Railway, then run this again." >&2
  exit 1
}
first() { grep -o "\"$1\":\"\?[^,\"}]*" <<<"$BODY" | head -1 | sed -E "s/\"$1\":\"?//"; }

# An earlier run: leave a finished form alone, rebuild an unfinished one.
call GET /forms
existing=$(sed 's/},{/}\n{/g' <<<"$BODY" | grep "\"title\":\"$TITLE\"" || true)
if [[ -n "$existing" ]]; then
  if grep -q '"response_count":0' <<<"$existing"; then
    old_id=$(grep -o '"id":[0-9]*' <<<"$existing" | head -1 | cut -d: -f2)
    echo "Found an unfinished '$TITLE' (form $old_id, no responses): deleting it and starting over."
    call DELETE "/forms/$old_id"
  else
    echo "'$TITLE' already exists with responses: nothing to do."
    exit 0
  fi
fi

echo "Creating the form..."
call POST /forms "{\"title\":\"$TITLE\"}"
FORM_ID=$(first id)

call PATCH "/forms/$FORM_ID" '{"description":"Two minutes, honest answers. It helps us decide what to build next."}'

q() { call POST "/forms/$FORM_ID/questions" "$1"; first id; }

Q_NAME=$(q '{"type":"short_text","title":"What should we call you?","required":true}')
Q_EMAIL=$(q '{"type":"email","title":"Where can we reach you?","required":true}')
Q_HEAR=$(q '{"type":"multiple_choice","title":"How did you hear about us?","required":true,"properties":{"options":[{"id":"a","label":"Social media"},{"id":"b","label":"A friend"},{"id":"c","label":"Search"},{"id":"d","label":"Newsletter"}]}}')
Q_USE=$(q '{"type":"multiple_choice","title":"Which features do you use?","description":"Pick all that apply.","properties":{"allow_multiple":true,"options":[{"id":"a","label":"Drag-and-drop builder"},{"id":"b","label":"Logic jumps"},{"id":"c","label":"Themes"},{"id":"d","label":"Results & CSV export"}]}}')
Q_RATE=$(q '{"type":"rating","title":"How would you rate the new editor?","required":true,"properties":{"max":5,"shape":"star"}}')
Q_NPS=$(q '{"type":"nps","title":"How likely are you to recommend us to a friend?","required":true}')
Q_EARLY=$(q '{"type":"yes_no","title":"Want early access to new features?"}')
Q_NOTE=$(q '{"type":"long_text","title":"Anything else you would like to tell us?"}')

# A request that timed out may still have gone through; make sure no question was added twice.
call GET "/forms/$FORM_ID"
count=$(grep -o "\"form_id\":$FORM_ID,\"type\":" <<<"$BODY" | wc -l | tr -d ' ')
if [[ "$count" != "$QUESTIONS" ]]; then echo "Expected $QUESTIONS questions but the form has $count." >&2; exit 1; fi

call POST "/forms/$FORM_ID/publish"
SLUG=$(first slug)
echo "Published: /f/$SLUG"

# Views, so the results page shows 40 opens next to the 14 responses.
for _ in $(seq 40); do curl -sS -m 30 -o /dev/null -X POST "$API/public/forms/$SLUG/views" || true; done

echo "Submitting 14 responses..."
names=("Aanya Sharma" "Rohan Mehta" "Priya Nair" "Karan Singh" "Sara Khan" "Vikram Rao" "Meera Iyer" "Arjun Das" "Neha Gupta" "Ishaan Verma" "Diya Kapoor" "Kabir Malhotra" "Ananya Joshi" "Dev Patel")
hear=(a b a c d b a c a b d a c b)
use=('["a","c"]' '["a","b","d"]' '["b"]' '["a","b","c","d"]' '["c","d"]' '["a"]' '["a","b"]' '["d"]' '["a","c","d"]' '["b","c"]' '["a","b","c"]' '["a","d"]' '["c"]' '["a","b","d"]')
rate=(5 4 5 3 4 5 4 2 5 4 3 5 4 5)
nps=(10 9 9 7 8 10 9 5 10 8 6 9 8 10)
early=(true true false true false true true false true true false true false true)
notes=("Love how fast the builder feels." "Please add Zapier." "" "Themes need more fonts." "Great, simple, no clutter." "The logic jumps saved me hours." "" "Mobile builder would be great." "CSV export is exactly what I needed." "" "Slightly confusing at first, then great." "More templates please." "" "Best form tool I have tried this year.")

for i in $(seq 0 13); do
  slug_name=$(tr 'A-Z ' 'a-z.' <<<"${names[$i]}")
  note="${notes[$i]}"
  note_json=""
  if [[ -n "$note" ]]; then note_json=",\"$Q_NOTE\":\"$note\""; fi
  call POST "/public/forms/$SLUG/responses" \
    "{\"answers\":{\"$Q_NAME\":\"${names[$i]}\",\"$Q_EMAIL\":\"$slug_name@example.com\",\"$Q_HEAR\":\"${hear[$i]}\",\"$Q_USE\":${use[$i]},\"$Q_RATE\":${rate[$i]},\"$Q_NPS\":${nps[$i]},\"$Q_EARLY\":${early[$i]}$note_json}}"
done

# Same caution for responses: a retried submit that had already landed would count twice.
call GET "/forms/$FORM_ID/summary"
completed=$(first completed)
if [[ "$completed" != "14" ]]; then
  echo "Expected 14 completed responses but found $completed." >&2
  exit 1
fi

FINISHED=1
echo "Done. Form $FORM_ID is live at /f/$SLUG with 14 responses."
