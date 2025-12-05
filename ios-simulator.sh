#!/bin/bash

# Function to get the local IP address
get_local_ip() {
  ip=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || ipconfig getifaddr en2)
  if [ -z "$ip" ]; then
    echo "localhost"
  else
    echo "$ip"
  fi
}

LOCAL_IP=$(get_local_ip)
APP_URL="http://${LOCAL_IP}:3000"

echo "=========================================="
echo "Starting Next.js app for iOS Simulator"
echo "=========================================="
echo "App URL: ${APP_URL}"
echo ""
echo "Opening iOS Simulator..."

# Open Simulator
open -a Simulator

# Wait for simulator to boot
echo "Waiting for simulator to boot..."
sleep 5

# Start Next.js dev server in background
echo "Starting Next.js dev server..."
npm run dev:mobile > /tmp/nextjs-simulator.log 2>&1 &
NEXTJS_PID=$!

# Wait a moment for server to start
sleep 5

# Open Safari in the simulator with the app URL
echo "Opening Safari in simulator..."
xcrun simctl openurl booted "$APP_URL"

echo ""
echo "✅ Done! The app should be loading in Safari."
echo "📱 If Safari doesn't open automatically, manually navigate to: ${APP_URL}"
echo ""
echo "To stop the server, run: kill $NEXTJS_PID"
echo "Or check logs at: /tmp/nextjs-simulator.log"

# Keep script running
wait $NEXTJS_PID

