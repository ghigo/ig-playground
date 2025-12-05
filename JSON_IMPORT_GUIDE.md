# JSON Import Guide

Import and enrich follower data from Instagram's official data download.

## Why Use JSON Import?

✅ **Complete follower list** - No scrolling limitations
✅ **More reliable** - Uses Instagram's official export
✅ **Faster** - Skip the follower collection step
✅ **Historical data** - See when you started following someone

---

## Step 1: Request Your Instagram Data

### From Instagram App/Website:

1. **Go to Settings**
   - Instagram app → Profile → Menu (☰) → Settings
   - Or web: instagram.com → Profile → Settings

2. **Navigate to Privacy and Security**
   - Settings → Privacy and security → Data download

3. **Request Download**
   - Click "Request Download"
   - Choose format: **JSON** (recommended)
   - Enter your email address
   - Click "Next" and then "Request Download"

4. **Wait for Email**
   - Instagram will send an email when ready
   - Can take **up to 48 hours** (usually ~24 hours)

5. **Download the ZIP File**
   - Click the link in the email
   - Login to Instagram
   - Download the ZIP file

---

## Step 2: Extract the Follower Data

1. **Unzip the Downloaded File**
   - Extract to a folder (e.g., `~/Downloads/instagram-data/`)

2. **Locate the JSON Files**

   The structure typically looks like:
   ```
   instagram-data/
   ├── followers_and_following/
   │   ├── followers.json          ← This one!
   │   ├── following.json          ← Or this one!
   │   └── ...
   ├── media/
   ├── stories/
   └── ...
   ```

3. **Choose Your File**
   - `followers.json` - People who follow you
   - `following.json` - People you follow

---

## Step 3: Import and Enrich

### Build the Project (if not done already)

```bash
npm run build
```

### Run the Import

```bash
npm run import path/to/followers.json
```

**Examples:**

```bash
# Using relative path
npm run import ~/Downloads/instagram-data/followers_and_following/followers.json

# Using absolute path
npm run import /Users/marco/Downloads/instagram-data/followers_and_following/followers.json

# Current directory
npm run import followers.json
```

---

## What Happens During Import

The script will:

1. ✅ Read the JSON file
2. ✅ Extract all follower usernames
3. ✅ Log into Instagram (using your `.env` credentials)
4. ✅ Visit each follower's profile
5. ✅ Scrape their current profile data:
   - Full name
   - Followers/Following/Posts count
   - Bio
   - Verified status
   - Private account status
   - Business account info
   - Category & external URL
6. ✅ Save to CSV or Google Sheets (based on your `.env` config)

---

## Expected Output

```
📂 Instagram JSON Importer

Reading JSON file: followers.json...
✓ JSON file loaded

📊 Found 450 unique usernames in JSON file

📋 Configuration loaded
   Output Format: csv
   Headless Mode: false
   Scrape Delay: 3000ms

📄 Initializing CSV Writer...
✓ CSV Writer initialized

🌐 Initializing Instagram Scraper...
✓ Browser initialized

🔐 Logging into Instagram...
✓ Successfully logged in

📝 Scraping profile information for 450 followers...
   This may take a while...

[1/450] Scraping @username1...
   → John Doe | Followers: 1234 | Following: 567 | Posts: 89
   ✓ Saved batch of 10 profiles to CSV

[2/450] Scraping @username2...
   → Jane Smith | Followers: 5678 | Following: 890 | Posts: 123
...

✅ Import completed successfully!
📊 Total profiles scraped: 450
📁 CSV file saved to: /path/to/output/instagram_followers_from_json_2025-12-05.csv
```

---

## JSON File Format

The script supports multiple Instagram JSON formats:

### Format 1: Standard Instagram Export (Most Common)

```json
[
  {
    "string_list_data": [
      {
        "href": "https://www.instagram.com/username1",
        "value": "username1",
        "timestamp": 1234567890
      }
    ]
  },
  {
    "string_list_data": [
      {
        "href": "https://www.instagram.com/username2",
        "value": "username2",
        "timestamp": 1234567891
      }
    ]
  }
]
```

### Format 2: Simple Array

```json
[
  {
    "username": "username1",
    "href": "https://www.instagram.com/username1"
  },
  {
    "username": "username2",
    "href": "https://www.instagram.com/username2"
  }
]
```

---

## Advantages vs. Live Scraping

| Feature | JSON Import | Live Scraping |
|---------|------------|---------------|
| Complete list | ✅ Yes | ⚠️ Limited by scrolling |
| Speed | ✅ Fast (no collection) | ⏱️ Slower (scrolling + scraping) |
| Reliability | ✅ Official data | ⚠️ Depends on Instagram UI |
| Historical info | ✅ Timestamps included | ❌ No |
| Rate limits | ✅ Lower risk | ⚠️ Higher risk |
| Setup time | ⏱️ Wait 24-48h for data | ✅ Instant |

---

## Tips

### Speed Up Import

For large follower lists (1000+):

1. **Reduce delay** (careful - may trigger rate limits):
   ```env
   SCRAPE_DELAY=2000
   ```

2. **Run in headless mode** (faster):
   ```env
   HEADLESS=true
   ```

3. **Split the file** - Process in chunks:
   ```bash
   # Process first 500
   npm run import followers_part1.json

   # Process next 500
   npm run import followers_part2.json
   ```

### Handle Errors

If the script encounters errors:

1. **Check JSON format** - Make sure it's valid JSON
2. **Verify file path** - Use absolute paths to be safe
3. **Instagram limits** - If rate-limited, increase `SCRAPE_DELAY`

### Compare Lists

Import both followers and following:

```bash
npm run import followers.json
# CSV saved as: instagram_followers_from_json_2025-12-05.csv

npm run import following.json
# CSV saved as: instagram_followers_from_json_2025-12-05.csv (new file)
```

Then compare in Excel/Sheets to find:
- Who follows you back
- Who you follow but doesn't follow you
- Mutual followers

---

## Troubleshooting

### "File not found"

Make sure the path is correct. Try:

```bash
# Print the full path
ls -la ~/Downloads/instagram-data/followers_and_following/followers.json

# Use that exact path
npm run import /Users/yourname/Downloads/instagram-data/followers_and_following/followers.json
```

### "No usernames found in JSON file"

The JSON format might be different. Open the file and check:

```bash
head -20 followers.json
```

Share the structure with me and I can update the parser.

### "Session lost" or "Rate limiting"

Instagram detected the scraping. Solutions:

1. Increase delay: `SCRAPE_DELAY=5000`
2. Split into smaller batches
3. Wait a few hours and retry

---

## Example Workflow

**Complete follower analysis workflow:**

1. **Request data** (Instagram Settings)
2. **Wait 24-48 hours** for email
3. **Download & extract** ZIP file
4. **Import followers:**
   ```bash
   npm run import followers.json
   ```
5. **Import following:**
   ```bash
   npm run import following.json
   ```
6. **Analyze in spreadsheet:**
   - Find mutual followers
   - Identify influencers (high follower count)
   - Find business accounts
   - Check verified accounts

---

## Benefits

✅ **Complete accuracy** - Official Instagram data
✅ **No UI changes** - Not affected by Instagram redesigns
✅ **Timestamps** - Know when connections were made
✅ **Batch processing** - Handle thousands of followers
✅ **Combine sources** - Mix JSON import with live scraping

---

## Next Steps

After importing:

1. **Open the CSV** in Excel/Sheets
2. **Sort by columns:**
   - Followers (find influencers)
   - Business Account (find businesses)
   - Verified (find celebrities)
3. **Filter:**
   - Private accounts
   - Accounts with external URLs
4. **Analyze:**
   - Calculate engagement potential
   - Identify similar accounts
   - Plan content strategy

Happy analyzing! 📊
