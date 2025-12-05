import * as fs from 'fs';
import { InstagramScraper } from './instagram-scraper';
import { GoogleSheetsService } from './google-sheets';
import { CSVWriter } from './csv-writer';
import { CSVDatabase } from './csv-database';
import { getConfig } from './config';
import { IGProfile } from './types';

interface InstagramDataEntry {
  string_list_data?: Array<{
    href?: string;
    value?: string;
    timestamp?: number;
  }>;
  // Alternative format
  username?: string;
  href?: string;
}

async function importFromJSON(jsonFilePath: string) {
  console.log('📂 Instagram JSON Importer\n');

  // Read and parse JSON file
  console.log(`Reading JSON file: ${jsonFilePath}...`);

  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`File not found: ${jsonFilePath}`);
  }

  const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
  const data: InstagramDataEntry[] = JSON.parse(jsonContent);

  console.log(`✓ JSON file loaded\n`);

  // Extract usernames from various Instagram JSON formats
  const usernames: string[] = [];

  for (const entry of data) {
    // Format 1: string_list_data structure (most common)
    if (entry.string_list_data && Array.isArray(entry.string_list_data)) {
      for (const item of entry.string_list_data) {
        if (item.value) {
          usernames.push(item.value);
        } else if (item.href) {
          // Extract username from URL: https://www.instagram.com/username
          const match = item.href.match(/instagram\.com\/([^/]+)/);
          if (match && match[1]) {
            usernames.push(match[1]);
          }
        }
      }
    }
    // Format 2: Direct username field
    else if (entry.username) {
      usernames.push(entry.username);
    }
    // Format 3: href field
    else if (entry.href) {
      const match = entry.href.match(/instagram\.com\/([^/]+)/);
      if (match && match[1]) {
        usernames.push(match[1]);
      }
    }
  }

  // Remove duplicates
  const uniqueUsernames = Array.from(new Set(usernames));

  console.log(`📊 Found ${uniqueUsernames.length} unique usernames in JSON file\n`);

  if (uniqueUsernames.length === 0) {
    throw new Error('No usernames found in JSON file. Please check the file format.');
  }

  // Now proceed with the normal scraping flow
  const config = getConfig();
  console.log(`📋 Configuration loaded`);
  console.log(`   Output Format: ${config.outputFormat}`);
  console.log(`   Headless Mode: ${config.headless}`);
  console.log(`   Scrape Delay: ${config.scrapeDelay}ms`);
  console.log(`   Cache Duration: ${config.cacheDays} days\n`);

  // Initialize output service (CSV or Google Sheets)
  let sheetsService: GoogleSheetsService | null = null;
  let csvDatabase: CSVDatabase | null = null;

  if (config.outputFormat === 'google-sheets') {
    console.log('📊 Initializing Google Sheets...');
    sheetsService = new GoogleSheetsService(
      config.googleSheetId!,
      config.googleServiceAccountKeyPath!
    );
    await sheetsService.initializeSheet();
    console.log('✓ Google Sheets initialized\n');
  } else {
    console.log('📄 Initializing CSV Database...');
    csvDatabase = new CSVDatabase('instagram_followers.csv');
    await csvDatabase.load();
    console.log('✓ CSV Database initialized\n');
  }

  // Initialize Instagram Scraper
  console.log('🌐 Initializing Instagram Scraper...');
  const scraper = new InstagramScraper(config.headless);
  await scraper.init();
  console.log('✓ Browser initialized\n');

  // Login to Instagram
  console.log('🔐 Logging into Instagram...');
  await scraper.login(config.igUsername, config.igPassword);
  console.log('✓ Successfully logged in\n');

  // Mark unfollowed users (only for CSV database)
  if (csvDatabase) {
    const unfollowedCount = csvDatabase.markUnfollowed(uniqueUsernames);
    if (unfollowedCount > 0) {
      console.log(`⚠️  Marked ${unfollowedCount} users as unfollowed (no longer in follower list)\n`);
    }
  }

  // Scrape profile information for each username
  console.log(`📝 Processing ${uniqueUsernames.length} followers...`);
  console.log('   This may take a while...\n');

  const profiles: IGProfile[] = [];
  const batchSize = 10; // Save every 10 profiles
  let scrapedCount = 0;
  let cachedCount = 0;

  for (let i = 0; i < uniqueUsernames.length; i++) {
    const username = uniqueUsernames[i];
    const progress = `[${i + 1}/${uniqueUsernames.length}]`;

    try {
      // Check if we should update this profile (cache logic for CSV)
      if (csvDatabase && !csvDatabase.shouldUpdate(username, config.cacheDays)) {
        const cached = csvDatabase.get(username);
        if (cached) {
          console.log(`${progress} @${username} (cached)`);
          console.log(`   → ${cached.fullName || 'N/A'} | Followers: ${cached.followers} | Using cached data`);
          // Still upsert to mark as not unfollowed
          csvDatabase.upsert(cached);
          cachedCount++;
          continue;
        }
      }

      console.log(`${progress} Scraping @${username}...`);
      const profile = await scraper.getProfileInfo(username);

      if (csvDatabase) {
        csvDatabase.upsert(profile);
      } else {
        profiles.push(profile);
      }

      scrapedCount++;

      // Display quick stats
      console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

      // Save in batches (Google Sheets only, CSV saves at end)
      if (sheetsService && profiles.length >= batchSize) {
        await sheetsService.addProfiles(profiles);
        console.log(`   ✓ Saved batch of ${profiles.length} profiles to Google Sheets\n`);
        profiles.length = 0; // Clear array
      }

      // Save CSV database periodically
      if (csvDatabase && scrapedCount % batchSize === 0) {
        await csvDatabase.save();
        console.log(`   ✓ Saved progress to database\n`);
      }

      // Delay to avoid rate limiting
      if (i < uniqueUsernames.length - 1) {
        await delay(config.scrapeDelay);
      }
    } catch (error) {
      console.error(`   ✗ Error scraping @${username}:`, (error as Error).message);
      // Continue with next follower
    }
  }

  // Save final data
  if (sheetsService && profiles.length > 0) {
    await sheetsService.addProfiles(profiles);
    console.log(`\n✓ Saved final batch of ${profiles.length} profiles to Google Sheets`);
  }

  if (csvDatabase) {
    await csvDatabase.save();
    const stats = csvDatabase.getStats();
    console.log(`\n✓ Database saved with ${stats.total} profiles (${stats.active} active, ${stats.unfollowed} unfollowed)`);
  }

  console.log('\n✅ Import completed successfully!');
  console.log(`📊 Total followers in JSON: ${uniqueUsernames.length}`);
  console.log(`   • New/Updated profiles: ${scrapedCount}`);
  console.log(`   • Cached profiles: ${cachedCount}`);

  if (config.outputFormat === 'google-sheets') {
    console.log(`🔗 View your Google Sheet: https://docs.google.com/spreadsheets/d/${config.googleSheetId}`);
  } else if (csvDatabase) {
    console.log(`📁 CSV database saved to: ${csvDatabase.getFilePath()}`);
  }

  // Close browser
  await scraper.close();
  console.log('\n👋 Browser closed. Goodbye!');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get JSON file path from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Please provide a JSON file path');
  console.error('\nUsage:');
  console.error('  npm run import followers.json');
  console.error('  npm run import /path/to/followers.json');
  console.error('\nYou can get this file by:');
  console.error('  1. Go to Instagram Settings → Security → Download Data');
  console.error('  2. Wait for email (can take up to 48 hours)');
  console.error('  3. Download and extract the ZIP file');
  console.error('  4. Find followers.json or following.json in the extracted folder');
  process.exit(1);
}

const jsonFilePath = args[0];

importFromJSON(jsonFilePath).catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
