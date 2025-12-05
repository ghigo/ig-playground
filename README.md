# Instagram Follower Scraper

A Node.js/TypeScript application that logs into your Instagram account (with 2FA support), collects your followers list, gathers profile information for each follower, and saves the data to either a CSV file or Google Sheets.

## Features

- ✅ Instagram login with 2FA support
- ✅ Automatic follower list collection
- ✅ **JSON import** - Import from Instagram's official data download (most reliable!)
- ✅ Profile scraping (followers, following, posts, bio, verification status, etc.)
- ✅ **CSV export (simple, no setup required)**
- ✅ Google Sheets integration (optional)
- ✅ Business account detection, external URLs, categories
- ✅ Rate limiting to avoid being blocked
- ✅ Batch saving
- ✅ Progress tracking and error handling

## Quick Start (Recommended)

**Want to get started in 5 minutes? Use CSV output!**

See **[SIMPLE_SETUP.md](SIMPLE_SETUP.md)** for the easiest way to get running with CSV output (no Google Cloud setup needed).

## JSON Import (Most Reliable!)

**NEW:** Import and enrich follower data from Instagram's official data download!

This is the **most reliable** method as it:
- ✅ Gets your complete follower list (no scrolling limitations)
- ✅ Uses Instagram's official export (no UI changes can break it)
- ✅ Includes timestamps for when you followed/were followed
- ✅ Works for thousands of followers

### Quick Steps:

1. Request your data: Instagram Settings → Privacy → Download Data
2. Wait 24-48 hours for email
3. Download and extract the ZIP file
4. Run the importer:
   ```bash
   npm run build
   npm run import path/to/followers.json
   ```

See **[JSON_IMPORT_GUIDE.md](JSON_IMPORT_GUIDE.md)** for complete instructions.

## Prerequisites

### For CSV Output (Easy!)
- Node.js (v16 or higher)
- npm or yarn
- An Instagram account

### For Google Sheets Output (Advanced)
- Everything above, plus:
- A Google Cloud Project with Sheets API enabled
- A Google Service Account with access to your target Google Sheet

See **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for detailed Google Sheets setup instructions.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Google Sheets API

#### a. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

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

**For CSV Output (Simple):**
```env
# Instagram Credentials
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password

# Output Format
OUTPUT_FORMAT=csv

# Optional Settings
HEADLESS=false          # Set to 'true' to run browser in headless mode
SCRAPE_DELAY=3000       # Delay between profile scrapes (milliseconds)
```

**For Google Sheets Output (Advanced):**
```env
# Instagram Credentials
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password

# Output Format
OUTPUT_FORMAT=google-sheets

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# Optional Settings
HEADLESS=false          # Set to 'true' to run browser in headless mode
SCRAPE_DELAY=3000       # Delay between profile scrapes (milliseconds)
```

### 4. Build the Project

```bash
npm run build
```

## Usage

### Run in Development Mode

```bash
npm run dev
```

### Run in Production Mode

```bash
npm start
```

### What Happens When You Run the Script

1. The script initializes and loads your configuration
2. Connects to Google Sheets and sets up headers
3. Opens a browser window (unless `HEADLESS=true`)
4. Logs into Instagram with your credentials
5. If 2FA is enabled, you'll be prompted to enter the code in the terminal
6. Navigates to your profile and collects your followers list
7. For each follower:
   - Visits their profile
   - Extracts profile information
   - Saves data to Google Sheets in batches
8. Displays progress and completion status
9. Closes the browser

## Output Data

The script saves the following information to your Google Sheet:

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
| Profile URL | Link to the Instagram profile |
| Scraped At | Timestamp of when the data was collected |

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
