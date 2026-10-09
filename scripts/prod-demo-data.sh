#!/usr/bin/env bash
# Adds a third demo form ("Product Launch Feedback") with 14 responses to a running API, using only curl.
#
#   API=https://typeform-production-3059.up.railway.app/api bash scripts/prod-demo-data.sh
#
# The two seeded demo forms (Customer Feedback, Event Registration) are not touched. Safe to re-run: it stops if the
# form already exists. To remove old test forms, see the DELETE commands in the answer / README ("Demo data").
set -euo pipefail

API="${API:-http://localhost:8000/api}"
TITLE="Product Launch Feedback"

# call METHOD PATH [JSON] -> sets BODY; stops on any non-2xx.
call() {
  local out
  out=$(curl -sS -X "$1" "$API$2" -H 'Content-Type: application/json' ${3:+-d "$3"} -w $'\n%{http_code}')
  CODE="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
  if [[ "$CODE" != 2* ]]; then echo "FAILED $1 $2 -> $CODE: $BODY" >&2; exit 1; fi
}
first() { grep -o "\"$1\":\"\?[^,\"}]*" <<<"$BODY" | head -1 | sed -E "s/\"$1\":\"?//"; }

call GET /forms
if grep -q "\"title\":\"$TITLE\"" <<<"$BODY"; then echo "'$TITLE' already exists: nothing to do."; exit 0; fi

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

call POST "/forms/$FORM_ID/publish"
SLUG=$(first slug)
echo "Published: /f/$SLUG"

# Views, so the results page shows 40 opens next to the 14 responses.
for _ in $(seq 40); do curl -sS -o /dev/null -X POST "$API/public/forms/$SLUG/views"; done

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

echo "Done. Form $FORM_ID: $API/forms/$FORM_ID"
