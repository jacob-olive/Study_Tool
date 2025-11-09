#!/bin/bash
# Helper script to extract Firebase Admin SDK credentials from JSON file

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-firebase-adminsdk-json-file>"
  echo ""
  echo "Example:"
  echo "  $0 ~/Downloads/study-tool-a4fbb-firebase-adminsdk-xxxxx.json"
  exit 1
fi

JSON_FILE="$1"

if [ ! -f "$JSON_FILE" ]; then
  echo "Error: File not found: $JSON_FILE"
  exit 1
fi

echo "Extracting Firebase Admin SDK credentials from: $JSON_FILE"
echo ""

# Extract values using jq if available, otherwise use grep/sed
if command -v jq &> /dev/null; then
  PROJECT_ID=$(jq -r '.project_id' "$JSON_FILE")
  CLIENT_EMAIL=$(jq -r '.client_email' "$JSON_FILE")
  PRIVATE_KEY=$(jq -r '.private_key' "$JSON_FILE")
else
  PROJECT_ID=$(grep -o '"project_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$JSON_FILE" | sed 's/.*"project_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  CLIENT_EMAIL=$(grep -o '"client_email"[[:space:]]*:[[:space:]]*"[^"]*"' "$JSON_FILE" | sed 's/.*"client_email"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  PRIVATE_KEY=$(grep -o '"private_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$JSON_FILE" | sed 's/.*"private_key"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | sed 's/\\n/\n/g')
fi

if [ -z "$PROJECT_ID" ] || [ -z "$CLIENT_EMAIL" ] || [ -z "$PRIVATE_KEY" ]; then
  echo "Error: Could not extract all required values from JSON file"
  echo "Please check the file format"
  exit 1
fi

ENV_FILE=".env.local"

# Update or add FIREBASE_PROJECT_ID
if grep -q "^FIREBASE_PROJECT_ID=" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=$PROJECT_ID|" "$ENV_FILE"
else
  echo "" >> "$ENV_FILE"
  echo "FIREBASE_PROJECT_ID=$PROJECT_ID" >> "$ENV_FILE"
fi

# Update or add FIREBASE_CLIENT_EMAIL
if grep -q "^FIREBASE_CLIENT_EMAIL=" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL|" "$ENV_FILE"
else
  echo "FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL" >> "$ENV_FILE"
fi

# Update or add FIREBASE_PRIVATE_KEY (handle multiline)
if grep -q "^FIREBASE_PRIVATE_KEY=" "$ENV_FILE" 2>/dev/null; then
  # Remove old private key line
  sed -i.bak '/^FIREBASE_PRIVATE_KEY=/d' "$ENV_FILE"
fi

# Add new private key (escaped for .env file)
echo "FIREBASE_PRIVATE_KEY=\"$(echo "$PRIVATE_KEY" | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')\"" >> "$ENV_FILE"

echo "✓ Updated .env.local with Firebase Admin SDK credentials"
echo ""
echo "Values:"
echo "  FIREBASE_PROJECT_ID=$PROJECT_ID"
echo "  FIREBASE_CLIENT_EMAIL=$CLIENT_EMAIL"
echo "  FIREBASE_PRIVATE_KEY=<hidden>"
echo ""
echo "Please restart your dev server for changes to take effect."

