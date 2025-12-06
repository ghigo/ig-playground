# Instagram Follower Scraper

A Node.js/TypeScript application that imports your Instagram followers list from your data download, gathers detailed profile information for each follower, and saves the data to a persistent CSV database with smart caching.

## Features

- ✅ **JSON import** - Import follower list from Instagram's official data download (required!)
- ✅ **Multi-account support** - Track multiple Instagram accounts separately (CSV files or sheet tabs)
- ✅ **Google Drive integration** - Read JSON files directly from Google Drive
- ✅ **CSV database** - Persistent storage with smart caching
- ✅ **Google Sheets output** - Export to Google Sheets with separate tabs per account
- ✅ **Cache system** - Skip re-fetching profiles scraped within X days (default: 10)
- ✅ **Unfollower tracking** - Track who unfollowed you (marked, not deleted)
- ✅ Instagram login with 2FA support
- ✅ Profile scraping (followers, following, posts, bio, verification status, etc.)
- ✅ Business account detection, external URLs, categories
- ✅ Rate limiting to avoid being blocked
- ✅ Batch saving with progress tracking
- ✅ Error handling and recovery

## Quick Start

### Step 1: Get Your Follower List

**Required:** You must import your follower list from Instagram's official data download.

1. Go to Instagram Settings → Privacy → Download Data
2. Wait 24-48 hours for email
3. Download and extract the ZIP file
4. Find `followers.json` in the extracted folder

### Step 2: Import and Scrape

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Import your follower list and scrape profile data
npm run import path/to/followers.json
```

**That's it!** The script will:
- Import all followers from the JSON file
- Scrape detailed profile info for each follower
- Save to `output/instagram_followers.csv`
- Cache results for 10 days (configurable)
- Track unfollowers on subsequent runs

### Step 3: Update Profile Data (Optional)

To refresh profile data for your existing followers:

```bash
# Uses the follower list from CSV database
npm start
```

This will only update profiles that haven't been scraped in X days (default: 10).

See **[JSON_IMPORT_GUIDE.md](JSON_IMPORT_GUIDE.md)** for complete instructions.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- An Instagram account
- Instagram data download (see Quick Start)

**Note:** Google Sheets integration is only available for JSON import (`npm run import`), not for live scraping (`npm start`).

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Google Sheets and Drive APIs

#### a. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the required APIs:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and click "Enable"
   - Search for "Google Drive API" and click "Enable" (if using Drive integration)

#### b. Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details and click "Create"
4. Skip the optional permissions and click "Done"
5. Click on the newly created service account
6. Go to the "Keys" tab
7. Click "Add Key" > "Create New Key"
8. Select "JSON" and click "Create"
9. Save the downloaded JSON file as `service-account-key.json` in the project root

#### c. Create and Share a Google Sheet

1. Create a new Google Sheet or use an existing one
2. Copy the Sheet ID from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
3. Share the sheet with the service account email:
   - Open the Google Sheet
   - Click "Share"
   - Add the service account email (found in `service-account-key.json` as `client_email`)
   - Give it "Editor" permissions

### 3. Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and fill in your credentials:

**For CSV Output (Recommended):**
```env
# Instagram Credentials
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password

# Output Format
OUTPUT_FORMAT=csv

# Optional Settings
HEADLESS=false          # Set to 'true' to run browser in headless mode
SCRAPE_DELAY=3000       # Delay between profile scrapes (milliseconds)
CACHE_DAYS=10           # Number of days to cache profile data (default: 10)
```

**For Google Sheets Output (JSON import only):**
```env
# Instagram Credentials
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password

# Output Format
OUTPUT_FORMAT=google-sheets

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# Google Drive Configuration (optional - for reading JSON from Drive)
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id

# Note: Google Sheets mode only works with: npm run import
# Live scraping (npm start) requires OUTPUT_FORMAT=csv

# Optional Settings
HEADLESS=false          # Set to 'true' to run browser in headless mode
SCRAPE_DELAY=3000       # Delay between profile scrapes (milliseconds)
```

**Using Google Drive for JSON files:**

If you set `GOOGLE_DRIVE_FOLDER_ID`, the script will read JSON files from Google Drive instead of your local filesystem:

1. Upload your `followers.json` files to a Google Drive folder
2. Share the folder with your service account (viewer permissions)
3. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
4. Set `GOOGLE_DRIVE_FOLDER_ID` in your `.env` file
5. Run: `npm run import followers.json myaccount`

The script will automatically download JSON files matching the pattern (e.g., `followers*.json` finds `followers_1.json`, `followers_2.json`, etc.)

### 4. Build the Project

```bash
npm run build
```

## Usage

### Import Follower List (Required First Step)

```bash
# Import from Instagram data download
npm run import path/to/followers.json

# Or specify an account name for multi-account support
npm run import followers.json myaccount
npm run import myaccount followers.json  # Both orders work
```

**What happens:**
1. Loads your follower list from the JSON file
2. Marks any unfollowed users in the database
3. Opens a browser and logs into Instagram
4. Scrapes profile info for new/expired followers (skips cached)
5. Saves to `output/instagram_followers.csv` (or `output/instagram_followers_myaccount.csv`)

### Multi-Account Support

Track followers for multiple Instagram accounts separately:

**CSV Mode:**
- Each account gets its own CSV file: `instagram_followers_{accountName}.csv`

**Google Sheets Mode:**
- Each account gets its own sheet/tab in the same spreadsheet
- Sheet tabs are automatically created and named after the account

```bash
# Import for different accounts
npm run import followers_main.json mainaccount
npm run import followers_business.json businessaccount

# Each account's data is kept separate
# - CSV: output/instagram_followers_mainaccount.csv
# - CSV: output/instagram_followers_businessaccount.csv
# - Sheets: Tabs named "mainaccount" and "businessaccount"
```

### Update Profile Data (Optional)

```bash
# Update profile data for existing followers
npm start
```

**What happens:**
1. Loads follower list from CSV database
2. Opens a browser and logs into Instagram
3. Scrapes profile info only for followers whose data is older than `CACHE_DAYS`
4. Updates the CSV database

**Note:** You must import a follower list first using `npm run import`. The script cannot scrape the follower list directly from Instagram.

## Output Data

The script saves the following information to the CSV database (`output/instagram_followers.csv`):

| Column | Description |
|--------|-------------|
| Username | Instagram username |
| Full Name | Profile display name |
| Followers | Number of followers |
| Following | Number of accounts following |
| Posts | Number of posts |
| Bio | Profile bio/description |
| Verified | Whether the account is verified |
| Private | Whether the account is private |
| Business Account | Whether it's a business account |
| Category | Business category (if applicable) |
| External URL | External website/link (if any) |
| Profile URL | Link to the Instagram profile |
| Scraped At | Original timestamp when first scraped |
| Last Updated | Most recent update timestamp |
| Unfollowed | Whether this user has unfollowed you |

## Important Notes

### Rate Limiting

- Instagram has rate limits to prevent scraping
- The script includes delays between requests (default: 3 seconds)
- If you scrape too aggressively, Instagram may temporarily block your account
- Consider increasing `SCRAPE_DELAY` for large follower lists

### 2FA Support

- When 2FA is enabled, the script will pause and prompt you in the terminal
- Enter the 6-digit code from your authenticator app
- The browser window will remain open during this time

### Browser Mode

- By default, the browser runs in non-headless mode (visible window)
- This helps you monitor the scraping process
- Set `HEADLESS=true` in `.env` to run without a visible browser

### Privacy and Security

- Never commit your `.env` file or `service-account-key.json` to version control
- Keep your Instagram credentials secure
- Only share your Google Sheet with trusted service accounts
- Be aware that this script accesses public Instagram data

### Legal Considerations

- This script is for personal use only
- Scraping Instagram may violate their Terms of Service
- Use at your own risk
- Consider the privacy implications of collecting follower data

## Troubleshooting

### "Could not find followers link"

- Your profile might be private
- Instagram's HTML structure may have changed
- Try running in non-headless mode to see what's happening

### "Error accessing Google Sheet"

- Verify the service account has Editor access to the sheet
- Check that the `GOOGLE_SHEET_ID` is correct
- Ensure the Google Sheets API is enabled

### "Login failed" or "Session expired"

- Verify your Instagram credentials
- Instagram may be blocking automated logins
- Try logging in manually first in a regular browser
- Consider using an app-specific password if available

### Profile data shows zeros

- The profile might be private
- Instagram's HTML structure may have changed
- The script includes fallback logic, but some profiles may return incomplete data

## Development

### Project Structure

```
ig-follower-scraper/
├── src/
│   ├── index.ts              # Main orchestration script
│   ├── instagram-scraper.ts  # Instagram scraping logic
│   ├── google-sheets.ts      # Google Sheets integration
│   ├── config.ts             # Configuration loader
│   └── types.ts              # TypeScript type definitions
├── dist/                     # Compiled JavaScript (generated)
├── .env                      # Environment variables (not in git)
├── .env.example              # Example environment variables
├── service-account-key.json  # Google service account key (not in git)
├── package.json
├── tsconfig.json
└── README.md
```

### Modifying the Script

- **Change scraped data**: Edit `src/types.ts` and `src/instagram-scraper.ts`
- **Adjust delays**: Modify `SCRAPE_DELAY` in `.env`
- **Change batch size**: Edit `batchSize` in `src/index.ts`
- **Customize sheet format**: Modify `src/google-sheets.ts`

## License

MIT

## Disclaimer

This tool is provided as-is for educational purposes. The authors are not responsible for any misuse or violations of Instagram's Terms of Service. Use responsibly and respect user privacy.
