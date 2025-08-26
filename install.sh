#!/bin/bash

# Immich SuperSearch Installer
# This script will create the necessary directory and download the backend files.

echo "Creating directory for Immich SuperSearch..."
mkdir -p ~/immich-supersearch && cd ~/immich-supersearch


echo "Downloading backend files..."

# Replace these with your actual raw GitHub URLs once the project is uploaded
wget -q --show-progress -O supersearch.esm.js https://raw.githubusercontent.com/Immich-Super-Search/Immich-SuperSearch/refs/heads/main/supersearch.esm.js
wget -q --show-progress -O package.json https://raw.githubusercontent.com/Immich-Super-Search/Immich-SuperSearch/refs/heads/main/package.json
wget -q --show-progress -O Dockerfile https://raw.githubusercontent.com/Immich-Super-Search/Immich-SuperSearch/refs/heads/main/Dockerfile

echo ""
echo "✅ Download complete!"
echo ""
echo "Next steps:"
echo "1. Add the service to your docker-compose.yml file (see README)."
echo "2. Add your Immich API Key."
echo "3. Run 'docker-compose up -d --build immich-supersearch'."
