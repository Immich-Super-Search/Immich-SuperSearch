# Immich SuperSearch Plugin

![SuperSearch Screenshot](https://github.com/Immich-Super-Search/Immich-SuperSearch/blob/main/Screenshot.jpg?)

[Immich](https://github.com/immich-app/immich)  is a wonderful solution for self-hosting your personal photo and video library. But as your collection grows, have you ever wished for more powerful tools to manage it?

Have you ever wanted to:

*   Easily find and delete all those tiny, **low-resolution images** cluttering up your timeline?
*   Hunt down those accidental, **two-second videos** you filmed when you meant to take a selfie?
*   Quickly identify the **largest files** which eating up your storage space?

The standard search is great for memories, but for library management, you need more power.

**This is where Immich SuperSearch comes in.**

Immich SuperSearch is a plugin that seamlessly integrates a powerful new search interface into Immich, giving you the advanced filtering tools you need to manage your library like a pro. It turns those wishes into a simple, clickable search.


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
wget -O - https://raw.githubusercontent.com/Immich-Super-Search/Immich-SuperSearch/refs/heads/main/install.sh | bash
```

Next, open your main Immich `docker-compose.yml` file (e.g., `nano docker-compose.yml`) and paste the following service definition at the end of your `services:` block, just like other service (e.g., redis, database ..):

```yaml
  immich-supersearch:
    container_name: immich_supersearch
    build: ./immich-supersearch # This path should now be correct
    restart: unless-stopped
    environment:
      # This should point to your Immich server's container name and port
      - IMMICH_URL=http://IMMICH_SERVER:2283
      # Generate an API Key in Immich and paste it here
      - IMMICH_API_KEY=YOUR_IMMICH_API_KEY_HERE
    ports:
      - "8080:8080"
```

Make sure to do the necessary edits:
* Replace `http://IMMICH_SERVER:2283` with your Immich server URL
* **Generate an API Key** in the Immich web UI `Account Settings` -> `API Keys` -> `New API Key`
* Replace `IMMICH_API_KEY` with the generated API Key.
* Save the file.

Finally, build and start the new service:

```bash
docker-compose up -d --build immich-supersearch
```

The backend is now running! You can check its logs with `docker logs immich_supersearch`.

### Step 2: Frontend Setup (Browser-Side)

1.  **[Click here to install the userscript](https://greasyfork.org/en/scripts/547302-immich-supersearch)**.
2.  Your userscript manager (Tampermonkey) will open. Click `Install`.
3.  **IMPORTANT:** After installing, go to the Tampermonkey Dashboard, find the "Immich SuperSearch" script, and click `Edit`. 
You **must** change the `@match` lines to point to your Immich URL. Otherwise SuperSearch icon will NOT appear.
4.  Refresh your Immich page. The SuperSearch icon will appear.

---

### Note:

The script will automatically detect the sidecar URL for most standard setups. <ins>If you have a different network configuration</ins> (e.g., a different port or IP address), you can easily change it:

1.  Click the SuperSearch icon in the Immich header.
2.  In the popup, click the **settings icon (⚙️)** in the top-right corner.
3.  Enter the correct URL for your sidecar service.
