#!/bin/sh
set -e

echo "Running DB migrations..."
node scripts/runRefreshTokensMigration.js
node scripts/ensureAdminUser.js

echo "Starting API..."
exec npm start
