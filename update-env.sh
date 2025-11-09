#!/bin/bash
# Script to update .env.local with Canvas PAT and help get Firebase Admin SDK credentials

echo "Updating .env.local with Canvas PAT..."

# Read current .env.local
ENV_FILE=".env.local"
TEMP_FILE=$(mktemp)

# Update Canvas PAT if provided
if [ -n "$1" ]; then
  CANVAS_PAT="$1"
  # Check if CANVAS_PAT already exists, if not add it
  if grep -q "^CANVAS_PAT=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^CANVAS_PAT=.*|CANVAS_PAT=$CANVAS_PAT|" "$ENV_FILE"
  else
    echo "" >> "$ENV_FILE"
    echo "# Canvas Personal Access Token (PAT) - alternative to OAuth" >> "$ENV_FILE"
    echo "CANVAS_PAT=$CANVAS_PAT" >> "$ENV_FILE"
  fi
  echo "✓ Canvas PAT updated"
fi

echo ""
echo "To get Firebase Admin SDK credentials:"
echo "1. Go to: https://console.firebase.google.com/project/study-tool-a4fbb/settings/serviceaccounts/adminsdk"
echo "2. Click 'Generate New Private Key'"
echo "3. Download the JSON file"
echo "4. Extract 'client_email' and 'private_key' from the JSON"
echo "5. Update FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local"
