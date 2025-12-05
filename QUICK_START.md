# Quick Start Checklist

Use this as a quick reference while setting up. See `SETUP_GUIDE.md` for detailed instructions.

---

## ☑️ Setup Checklist

### 1. Local Setup
```bash
- [ ] Clone/download the project
- [ ] Run: npm install
```

### 2. Google Cloud Setup (15 minutes)
```bash
- [ ] Go to console.cloud.google.com
- [ ] Create new project
- [ ] Enable "Google Sheets API"
- [ ] Create Service Account
- [ ] Download JSON key → rename to service-account-key.json
- [ ] Move service-account-key.json to project folder
```

### 3. Google Sheet Setup (2 minutes)
```bash
- [ ] Create new Google Sheet at sheets.google.com
- [ ] Copy Sheet ID from URL (between /d/ and /edit)
- [ ] Click Share button
- [ ] Add service account email (from JSON file)
- [ ] Set permission to "Editor"
- [ ] Click Share
```

### 4. Configure Environment (2 minutes)
```bash
- [ ] Copy .env.example → .env
- [ ] Fill in IG_USERNAME
- [ ] Fill in IG_PASSWORD
- [ ] Fill in GOOGLE_SHEET_ID
- [ ] Save file
```

### 5. Build & Run
```bash
- [ ] Run: npm run build
- [ ] Run: npm start
- [ ] Have 2FA code ready if enabled
```

---

## 📋 Your Details (Fill This Out)

Write these down as you create them:

**Service Account Email:**
```
_______________________________________________@___.iam.gserviceaccount.com
```
(Find this in service-account-key.json → "client_email")

**Google Sheet ID:**
```
_________________________________________________________________
```
(From URL: https://docs.google.com/spreadsheets/d/THIS-PART/edit)

**Instagram Username:**
```
_________________________________________________________________
```

---

## 🚀 Quick Commands

Once everything is set up:

```bash
# First time only
npm install
npm run build

# Every time you want to run it
npm start

# Or for development (auto-recompile)
npm run dev
```

---

## ⚡ Fast Track (If you're experienced)

1. `npm install`
2. Create Google Cloud project → Enable Sheets API → Create service account → Download JSON
3. Create Google Sheet → Share with service account email
4. `cp .env.example .env` → Fill in credentials
5. `npm run build && npm start`

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "credentials not found" | Check `.env` file exists and is filled out |
| "could not access sheet" | Share sheet with service account email |
| Browser doesn't open | Set `HEADLESS=false` in `.env` |
| 2FA not working | Type code in terminal, not browser |
| Rate limiting | Increase `SCRAPE_DELAY` to 5000+ |

---

## 📞 Need detailed help?

See **SETUP_GUIDE.md** for step-by-step instructions with screenshots descriptions and detailed troubleshooting.
