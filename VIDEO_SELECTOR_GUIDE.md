# Video Selector Guide

## Overview

The VideoSelector component has been added to the Create view to allow users to easily browse and select videos from the `/public/videos` directory.

## Setup

### 1. Install Dependencies
First, install the required packages:

```bash
pnpm install
```

This will install Express and Concurrently, which are needed for the video server.

### 2. Add Videos
Place your video files in the following directory:
```
/public/videos/
```

Supported formats: `.mp4`, `.webm`, `.mov`, `.avi`

### 3. Run the Development Server

You have two options:

#### Option A: Run Vite Only (Videos via URL Input)
If you only need manual URL input:
```bash
npm run dev
```

#### Option B: Run with Video Server (Recommended)
To enable the VideoSelector component with the available videos list:
```bash
npm run dev:with-videos
```

This will start:
- The Vite development server on `http://localhost:5173`
- The video API server on `http://localhost:3001`

### 4. Using the VideoSelector

Once you have the video server running:

1. Go to the **CREATOR** page
2. You'll see the **"Available Videos (X)"** button above the URL input
3. Click the button to see the list of videos in `/public/videos`
4. Click any video to automatically fill the URL input field
5. Click the **Load** button to load the video

## Features

- **Auto-fill**: Selecting a video automatically fills the URL input
- **Search-friendly**: Video files are displayed with both name and path
- **Graceful Fallback**: If the server isn't running, you can still paste URLs manually
- **No videos?**: The selector will only appear if you have videos in `/public/videos`

## How It Works

1. **useAvailableVideos Hook** (`src/hooks/useAvailableVideos.ts`)
   - Fetches the list of videos from the API server
   - Handles errors gracefully if the server isn't available

2. **VideoSelector Component** (`src/components/VideoSelector.tsx`)
   - Displays the list of available videos
   - Allows selection and auto-fills the URL input
   - Only shows if videos are available

3. **Video API Server** (`server-videos.js`)
   - Scans the `/public/videos` directory
   - Serves the videos via HTTP endpoints
   - Accessible at `http://localhost:3001/api/videos`

## Troubleshooting

### "Available Videos" button doesn't appear
- Check that videos are in `/public/videos`
- Ensure you're running `npm run dev:with-videos`
- Check browser console for errors

### Videos won't load
- Make sure the video server is running (port 3001)
- Try accessing `http://localhost:3001/api/videos` directly
- Check that video file extensions are supported

### Server already in use
If port 3001 is already in use, modify `server-videos.js` to use a different port, and update `useAvailableVideos.ts` to match.

## Production Build

When building for production:
```bash
npm run build
```

For production, either:
- Pre-configure video paths in the environment
- Modify the server to serve from a different location
- Use a static file server to host videos

---

The video selector integrates seamlessly with the existing exercise creation workflow!
