# Immich SuperSearch Plugin

![SuperSearch Screenshot](https://github.com/Immich-Super-Search/Immich-SuperSearch/blob/main/Screenshot.jpg?)

A powerful plugin for [Immich](https://github.com/immich-app/immich) that adds a highly-detailed search interface, allowing you to find photos and videos using criteria not available in the standard search.

This plugin consists of two parts:
1.  A **Backend Sidecar Service** that runs in Docker alongside Immich.
2.  A **Frontend Userscript** that injects the new search button and UI into the Immich web interface.

---

## Features

*   **Integrated UI:** Adds a new search icon right in the Immich header.
*   **Filename Search:** Find assets where the filename starts with a specific prefix (e.g., `IMG_`).
*   **Advanced Video Search:** Filter by video duration (longer than, shorter than, or between).
*   **File Size Filtering:** Filter by a specific file size range (GB, MB, KB).
*   **Dimension Filtering:** Find photos/videos wider, narrower, taller, or shorter than a specific resolution.
*   **And more:** Filter by date ranges, favorite status, motion photos, and whether an asset is in an album.
*   **Save Results:** Automatically create a new album with your search results.

---

## Installation

### Prerequisites

1.  A working **Immich** instance running via Docker Compose.
2.  **Docker** and **Docker Compose** installed on your server.
3.  A **Userscript Manager** browser extension, such as [Tampermonkey](https://www.tampermonkey.net/).

### Step 1: Backend Setup (Server-Side)

Run the following command on your server in the same directory where your main Immich `docker-compose.yml` file is located. It will download and run an installer script that creates the `immich-supersearch` folder and gets the necessary files.

```bash
wget -O - https://raw.githubusercontent.com/nazzal-cloud/immich-supersearch-plugin/main/install.sh | bash
```

Next, open your main `docker-compose.yml` file (e.g., `nano docker-compose.yml`) and paste the following service definition at the end of your `services:` block:

```yaml
  immich-supersearch:
    container_name: immich_supersearch
    build: ./immich-supersearch # This path should now be correct
    restart: unless-stopped
    environment:
      # This should point to your Immich server's container name and port
      - IMMICH_URL=http://immich-server:3001
      # Generate an API Key in Immich and paste it here
      - IMMICH_API_KEY=YOUR_IMMICH_API_KEY_HERE
    ports:
      - "8080:8080"
```

Now, **generate an API Key** in the Immich web UI (`Administration` -> `API Keys` -> `New API Key`) and paste it into the `IMMICH_API_KEY` field you just added. Save the file.

Finally, build and start the new service:

```bash
docker-compose up -d --build immich-supersearch
```

The backend is now running! You can check its logs with `docker logs immich_supersearch`.

### Step 2: Frontend Setup (Browser-Side)

1.  **[Click here to install the userscript](https://greasyfork.org/en/scripts/547302-immich-supersearch-integrated-ui-v1-0)**.
2.  Your userscript manager (Tampermonkey) will open. Click `Install`.
3.  **IMPORTANT:** After installing, go to the Tampermonkey Dashboard, find the "Immich SuperSearch" script, and click `Edit`. 
You **must** change the `@match` lines to point to your Immich URL. Otherwise SuperSearch icon will NOT appear.
4.  Refresh your Immich page. The SuperSearch icon will appear.
![UserScript Screenshot](https://greasyfork.s3.us-east-2.amazonaws.com/z3ufmeh7h7ytk4ez56uxec5cpgh7)
---

### Note:

The script will automatically detect the sidecar URL for most standard setups. <ins>If you have a different network configuration</ins> (e.g., a different port or IP address), you can easily change it:

1.  Click the SuperSearch icon in the Immich header.
2.  In the popup, click the **settings icon (⚙️)** in the top-right corner.
3.  Enter the correct URL for your sidecar service.
