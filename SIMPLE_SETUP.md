# Simple Setup Guide - CSV Output (5 Minutes!)

The easiest way to get started - saves data to a local CSV file. No Google Cloud setup required!

---

## Quick Setup (3 Steps!)

### Step 1: Install Dependencies (2 minutes)

```bash
npm install
```

This will download all required packages including Puppeteer (which includes a browser).

### Step 2: Create Your Configuration File (1 minute)

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` in any text editor and fill in ONLY these two lines:
   ```env
   IG_USERNAME=your_instagram_username
   IG_PASSWORD=your_instagram_password
   OUTPUT_FORMAT=csv
   ```

   **Example:**
   ```env
   IG_USERNAME=johndoe
   IG_PASSWORD=MySecurePass123!
   OUTPUT_FORMAT=csv
   ```

3. Save the file

That's it! You can ignore all the Google Sheets settings.

### Step 3: Build and Run (1 minute)

```bash
npm run build
npm start
```

---

## What Will Happen

1. **Browser Opens**: A Chrome window will open and navigate to Instagram
2. **Login**: The script will enter your credentials
3. **2FA Prompt** (if enabled): Look at your terminal and enter the 6-digit code
4. **Collection**: The script will collect all your followers
5. **Scraping**: For each follower, it will gather their profile info
6. **Saving**: Data is saved in batches to a CSV file
7. **Complete**: You'll see the file path where your CSV was saved

Example output:
```
🚀 Instagram Follower Scraper Starting...
📋 Configuration loaded
   Instagram Account: johndoe
   Output Format: csv
📄 Initializing CSV Writer...
✓ CSV Writer initialized
CSV file created: /path/to/ig-playground/output/instagram_followers_2025-12-05.csv

🌐 Initializing Instagram Scraper...
✓ Browser initialized
🔐 Logging into Instagram...
✓ Successfully logged in

👥 Fetching followers list...
✓ Found 450 followers

📝 Scraping profile information for 450 followers...
[1/450] Scraping @username1...
   → John Doe | Followers: 1234 | Following: 567 | Posts: 89
[2/450] Scraping @username2...
   → Jane Smith | Followers: 5678 | Following: 890 | Posts: 123
   ✓ Saved batch of 10 profiles to CSV

...

✅ Scraping completed successfully!
📊 Total profiles scraped: 450
📁 CSV file saved to: /path/to/ig-playground/output/instagram_followers_2025-12-05.csv
👋 Browser closed. Goodbye!
```

---

## Finding Your CSV File

The CSV file will be saved in:
```
your-project-folder/output/instagram_followers_YYYY-MM-DD.csv
```

You can open it with:
- Microsoft Excel
- Google Sheets (File → Import)
- Apple Numbers
- Any spreadsheet application

---

## CSV Format

The CSV contains these columns:

| Column | Description |
|--------|-------------|
| Username | Instagram username |
| Full Name | Display name |
| Followers | Number of followers |
| Following | Number following |
| Posts | Number of posts |
| Bio | Profile bio |
| Verified | Yes/No |
| Private | Yes/No |
| Profile URL | Link to profile |
| Scraped At | Timestamp |

---

## Troubleshooting

### "Instagram credentials not found"
- Make sure you created `.env` (not `.env.example`)
- Check that you filled in IG_USERNAME and IG_PASSWORD
- No spaces around the = sign

### 2FA Code Prompt
- **Look at your terminal/command line** (not the browser)
- Open your authenticator app
- Enter the 6-digit code in the terminal
- Press Enter

### "npm: command not found"
- Install Node.js from https://nodejs.org
- Restart your terminal after installing

### Browser doesn't open
- The browser window might be behind other windows
- Make sure `HEADLESS=false` in your `.env` file

### Rate Limiting
- Instagram detected automation
- Increase `SCRAPE_DELAY` to 5000 or higher
- Wait a few hours before trying again

---

## Tips

1. **First Run**: Keep `HEADLESS=false` so you can watch what's happening
2. **Large Lists**: For 1000+ followers, set `SCRAPE_DELAY=5000` (5 seconds)
3. **2FA Ready**: Have your phone/authenticator app handy before starting
4. **Check Output**: The CSV file is in the `output` folder

---

## Want to Use Google Sheets Instead?

If you want automatic upload to Google Sheets:

1. See `SETUP_GUIDE.md` for detailed Google Cloud setup
2. Change `OUTPUT_FORMAT=google-sheets` in your `.env`
3. Add your Google Sheet configuration

But CSV is much simpler to get started!

---

## Security Note

- `.env` is automatically ignored by git (won't be committed)
- Never share your `.env` file
- Keep your Instagram password secure

---

## Summary

```bash
# One-time setup
npm install
cp .env.example .env
# Edit .env with your Instagram username/password

# Run it
npm run build
npm start
```

That's it! Your data will be in `output/instagram_followers_YYYY-MM-DD.csv` 🎉
