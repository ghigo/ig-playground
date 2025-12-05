# Complete Setup Guide - Instagram Follower Scraper

Follow these steps exactly to get the scraper running on your local machine.

---

## Prerequisites

Before starting, make sure you have:
- Node.js installed (version 16 or higher) - Download from https://nodejs.org
- A Google account
- Your Instagram username and password

---

## Part 1: Clone/Download the Project

1. Open your terminal
2. Navigate to where you want to place the project:
   ```bash
   cd ~/Desktop  # or wherever you prefer
   ```

3. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd ig-playground
   ```

---

## Part 2: Install Dependencies

In your project folder, run:

```bash
npm install
```

This will install:
- Puppeteer (browser automation)
- Google APIs (for Sheets integration)
- TypeScript and other dependencies

**Note**: This may take a few minutes as Puppeteer downloads Chromium.

---

## Part 3: Set Up Google Sheets API (Most Important!)

### 3.1 Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click **"Select a project"** at the top → **"New Project"**
3. Name it something like "Instagram Scraper"
4. Click **"Create"** and wait for it to finish
5. Make sure your new project is selected at the top

### 3.2 Enable Google Sheets API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it
4. Click **"Enable"**
5. Wait for it to enable (should take a few seconds)

### 3.3 Create a Service Account

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** at the top → **"Service account"**
3. Fill in:
   - **Service account name**: `instagram-scraper`
   - **Service account ID**: (auto-filled)
4. Click **"Create and Continue"**
5. **Skip** the optional role selection (click "Continue")
6. **Skip** granting users access (click "Done")

### 3.4 Create and Download Service Account Key

1. You should now see your service account in the list
2. Click on the **service account email** (looks like `instagram-scraper@...iam.gserviceaccount.com`)
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Choose **"JSON"** format
6. Click **"Create"**
7. A JSON file will download automatically
8. **Important**: Rename this file to `service-account-key.json`
9. Move it to your project folder (same folder as package.json)

### 3.5 Create Your Google Sheet

1. Go to https://sheets.google.com
2. Click **"Blank"** to create a new sheet
3. Name it something like "Instagram Followers Data"
4. Copy the **Sheet ID** from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/`**`ABC123xyz`**`/edit`
   - The Sheet ID is the long string between `/d/` and `/edit`
   - Save this somewhere - you'll need it in a moment!

### 3.6 Share the Sheet with Service Account

1. In your Google Sheet, click the **"Share"** button (top right)
2. In the **"Add people and groups"** field, paste the service account email
   - Find this email in the `service-account-key.json` file you downloaded
   - Look for `"client_email"` - it looks like: `instagram-scraper@...iam.gserviceaccount.com`
3. Make sure the permission is set to **"Editor"**
4. **Uncheck** "Notify people" (the service account doesn't need an email)
5. Click **"Share"**

✅ **Google Sheets setup is now complete!**

---

## Part 4: Configure Your Environment Variables

1. In your project folder, you should see a file called `.env.example`
2. Copy it and rename the copy to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` in a text editor and fill in your information:

```env
# Instagram Credentials
IG_USERNAME=your_actual_instagram_username
IG_PASSWORD=your_actual_instagram_password

# Google Sheets Configuration
GOOGLE_SHEET_ID=paste_your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# Optional Settings
HEADLESS=false
SCRAPE_DELAY=3000
```

**Example filled out:**
```env
IG_USERNAME=johndoe
IG_PASSWORD=MySecurePass123!
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json
HEADLESS=false
SCRAPE_DELAY=3000
```

4. Save the file

---

## Part 5: Build the Project

Compile the TypeScript code:

```bash
npm run build
```

You should see a new `dist` folder created with compiled JavaScript files.

---

## Part 6: Run the Scraper!

Now you're ready to run it:

```bash
npm start
```

Or for development mode:

```bash
npm run dev
```

---

## What to Expect When Running

Here's what will happen step by step:

### 1. Initialization (5-10 seconds)
```
🚀 Instagram Follower Scraper Starting...
📋 Configuration loaded
📊 Initializing Google Sheets...
✓ Google Sheets initialized
🌐 Initializing Instagram Scraper...
✓ Browser initialized
```

### 2. Browser Opens
- A Chrome window will open (unless HEADLESS=true)
- Don't close this window!

### 3. Instagram Login
```
🔐 Logging into Instagram...
Navigating to Instagram login page...
Entering credentials...
Clicking login button...
```

### 4. Two-Factor Authentication (if enabled)
```
2FA detected. Waiting for code input...
Enter your 2FA code:
```
- **Stop here and look at your terminal!**
- Open your authenticator app (Google Authenticator, Authy, etc.)
- Get the 6-digit code for Instagram
- Type it in the terminal and press Enter

### 5. Collecting Followers
```
✓ Successfully logged in
👥 Fetching followers list...
Opening followers list...
Scrolling through followers list...
Found 150 followers so far...
Found 300 followers so far...
✓ Found 450 followers
```

### 6. Scraping Profiles
```
📝 Scraping profile information for 450 followers...
[1/450] Scraping @username1...
   → John Doe | Followers: 1234 | Following: 567 | Posts: 89
[2/450] Scraping @username2...
   → Jane Smith | Followers: 5678 | Following: 890 | Posts: 123
   ✓ Saved batch of 10 profiles to Google Sheets

[11/450] Scraping @username11...
...
```

### 7. Completion
```
✅ Scraping completed successfully!
📊 Total profiles scraped: 450
🔗 View your Google Sheet: https://docs.google.com/spreadsheets/d/...
👋 Browser closed. Goodbye!
```

---

## Troubleshooting

### Error: "Instagram credentials not found in .env file"
- Make sure your `.env` file exists (not `.env.example`)
- Check that you filled in `IG_USERNAME` and `IG_PASSWORD`
- No spaces around the `=` sign

### Error: "Could not access Google Sheet"
- Verify you shared the sheet with the service account email
- Check that `GOOGLE_SHEET_ID` is correct
- Make sure `service-account-key.json` is in the project folder

### Browser doesn't open
- Set `HEADLESS=false` in your `.env` file
- The browser might be opening behind other windows

### "Could not find followers link"
- Your Instagram account might be private
- Try manually opening Instagram first to make sure you're not blocked

### Stuck at login
- Check your username and password
- Instagram might require you to verify it's you
- Try logging in manually first in a regular browser

### Rate limiting / Account temporarily locked
- Instagram detected automation
- Wait a few hours before trying again
- Increase `SCRAPE_DELAY` to 5000 or higher (5 seconds between profiles)
- Use `HEADLESS=false` to look more like a real user

---

## Tips for Best Results

1. **First Run**: Start with `HEADLESS=false` so you can see what's happening
2. **Large Follower Lists**: For 1000+ followers, consider:
   - Increasing `SCRAPE_DELAY` to 5000ms (5 seconds)
   - Running during off-peak hours
   - Taking breaks every few hundred followers
3. **2FA**: Have your phone/authenticator app ready before running
4. **Data Backup**: The script saves in batches, but you might want to export your Sheet periodically

---

## Optional: Customizations

### Change what data is collected

Edit `src/instagram-scraper.ts` in the `getProfileInfo` method to extract different fields.

### Change batch save frequency

In `src/index.ts`, change `batchSize` from 10 to another number:
```typescript
const batchSize = 20; // Save every 20 profiles instead of 10
```

### Change delay between profiles

Update `SCRAPE_DELAY` in `.env`:
```env
SCRAPE_DELAY=5000  # 5 seconds instead of 3
```

---

## Security Reminders

- ✅ `.env` is in `.gitignore` - won't be committed
- ✅ `service-account-key.json` is in `.gitignore` - won't be committed
- ⚠️ Never share these files publicly
- ⚠️ Don't commit them to GitHub
- ⚠️ Keep your Instagram password secure

---

## Need Help?

Common issues:
1. **Node.js not installed**: Download from https://nodejs.org
2. **npm command not found**: Restart terminal after installing Node.js
3. **Permission errors on Mac/Linux**: Try `sudo npm install`
4. **Google Sheets access denied**: Double-check you shared with the service account email

---

## Summary Checklist

Before running, make sure you have:

- [ ] Installed Node.js
- [ ] Ran `npm install` successfully
- [ ] Created Google Cloud project
- [ ] Enabled Google Sheets API
- [ ] Created service account
- [ ] Downloaded `service-account-key.json` to project folder
- [ ] Created a Google Sheet
- [ ] Copied the Sheet ID
- [ ] Shared the sheet with service account email
- [ ] Created `.env` file (from `.env.example`)
- [ ] Filled in all values in `.env`
- [ ] Ran `npm run build`
- [ ] Ready to run `npm start`!

---

Good luck! The script will guide you through each step with clear console messages. 🚀
