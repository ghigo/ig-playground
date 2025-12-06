import * as fs from 'fs';
import * as path from 'path';
import { InstagramScraper } from './instagram-scraper';
import { GoogleSheetsService } from './google-sheets';
import { GoogleDriveService } from './google-drive';
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

/**
 * Find all related JSON files (e.g., followers_1.json, followers_2.json, etc.)
 */
function findRelatedJsonFiles(jsonFilePath: string): string[] {
  const dir = path.dirname(jsonFilePath);
  const basename = path.basename(jsonFilePath, '.json');

  // Check if the file is numbered (e.g., followers_1.json)
  const match = basename.match(/^(.+?)_(\d+)$/);

  if (!match) {
    // Not a numbered file, return just the original
    return [jsonFilePath];
  }

  const [, baseName, startNum] = match;
  const files: string[] = [];

  // Find all numbered files
  let fileNum = 1;
  while (true) {
    const testPath = path.join(dir, `${baseName}_${fileNum}.json`);
    if (fs.existsSync(testPath)) {
      files.push(testPath);
      fileNum++;
    } else {
      break;
    }
  }

  return files.length > 0 ? files : [jsonFilePath];
}

/**
 * Load JSON data from Google Drive
 */
async function loadFromGoogleDrive(driveService: GoogleDriveService, filePattern: string): Promise<InstagramDataEntry[]> {
  console.log(`📂 Loading from Google Drive...`);
  console.log(`   Folder ID: ${driveService.getFolderId()}`);
  console.log(`   Pattern: ${filePattern}\n`);

  // Download and parse files matching the pattern
  const allData = await driveService.downloadAndParseFiles(filePattern);

  console.log(`✓ Loaded ${allData.length} entries from Google Drive\n`);
  return allData;
}

/**
 * Load JSON data from local filesystem
 */
function loadFromLocalFiles(jsonFilePath: string): InstagramDataEntry[] {
  console.log(`📂 Loading from local filesystem...`);

  // Find all related JSON files
  console.log(`Searching for JSON files...`);
  const jsonFiles = findRelatedJsonFiles(jsonFilePath);

  if (jsonFiles.length > 1) {
    console.log(`✓ Found ${jsonFiles.length} related JSON files:`);
    jsonFiles.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${path.basename(file)}`);
    });
    console.log();
  } else {
    console.log(`Reading JSON file: ${path.basename(jsonFilePath)}...`);
  }

  // Read and parse all JSON files
  let allData: InstagramDataEntry[] = [];

  for (const file of jsonFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`File not found: ${file}`);
    }

    const jsonContent = fs.readFileSync(file, 'utf-8');
    const data: InstagramDataEntry[] = JSON.parse(jsonContent);
    allData = allData.concat(data);
  }

  console.log(`✓ Loaded ${allData.length} entries from ${jsonFiles.length} file(s)\n`);
  return allData;
}

async function importFromJSON(jsonFilePath: string, accountName: string = 'default') {
  console.log('📂 Instagram JSON Importer\n');
  console.log(`📱 Account: ${accountName}\n`);

  // Load configuration first to check for Google Drive
  const config = getConfig();

  // Determine if we should use Google Drive or local filesystem
  // Use Google Drive if:
  // 1. GOOGLE_DRIVE_FOLDER_ID is configured
  // 2. The path looks like a filename (not an absolute path)
  const useGoogleDrive = config.googleDriveFolderId && !path.isAbsolute(jsonFilePath);

  let allData: InstagramDataEntry[] = [];

  if (useGoogleDrive) {
    // Load from Google Drive
    console.log('🌐 Google Drive mode enabled\n');
    const driveService = new GoogleDriveService(
      config.googleDriveFolderId!,
      config.googleServiceAccountKeyPath!
    );

    // Convert filename to pattern (e.g., "followers.json" -> "followers*.json")
    const basename = path.basename(jsonFilePath, '.json');
    const pattern = `${basename}*.json`;

    allData = await loadFromGoogleDrive(driveService, pattern);
  } else {
    // Load from local filesystem
    allData = loadFromLocalFiles(jsonFilePath);
  }

  // Extract usernames from various Instagram JSON formats
  const usernames: string[] = [];

  for (const entry of allData) {
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

  console.log(`📊 Found ${uniqueUsernames.length} unique followers\n`);

  if (uniqueUsernames.length === 0) {
    throw new Error('No usernames found in JSON file. Please check the file format.');
  }

  // Configuration summary
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
      config.googleServiceAccountKeyPath!,
      accountName // Use account name as sheet name
    );
    await sheetsService.initializeSheet();
    console.log('✓ Google Sheets initialized\n');
  } else {
    console.log('📄 Initializing CSV Database...');
    // Use account-specific CSV file
    const csvFilename = `instagram_followers_${accountName}.csv`;
    csvDatabase = new CSVDatabase(csvFilename);
    await csvDatabase.load();
    console.log('✓ CSV Database initialized\n');
  }

  // Mark unfollowed users and add placeholders (only for CSV database)
  if (csvDatabase) {
    const unfollowedCount = csvDatabase.markUnfollowed(uniqueUsernames);
    if (unfollowedCount > 0) {
      console.log(`⚠️  Marked ${unfollowedCount} users as unfollowed (no longer in follower list)\n`);
    }

    // Add placeholder entries for all new followers immediately
    // This ensures they're in the CSV even if the script is interrupted
    console.log('📝 Adding follower list to database...');
    const addedCount = csvDatabase.addPlaceholders(uniqueUsernames);
    if (addedCount > 0) {
      console.log(`   ✓ Added ${addedCount} new followers to database`);
    }

    // Save the database with all followers before scraping
    await csvDatabase.save();
    console.log(`   ✓ Saved follower list to database\n`);
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

  // Scrape profile information for each username
  console.log(`📝 Scraping profile information for ${uniqueUsernames.length} followers...`);
  console.log('   This may take a while...\n');

  const profiles: IGProfile[] = [];
  const batchSize = 10; // Save every 10 profiles
  let scrapedCount = 0;
  let cachedCount = 0;
  const failedProfiles: string[] = []; // Track failed profiles for retry

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
        // Save immediately after each profile to prevent data loss on interruption
        await csvDatabase.save();
      } else {
        profiles.push(profile);
      }

      scrapedCount++;

      // Display quick stats
      console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

      // Save in batches (Google Sheets only)
      if (sheetsService && profiles.length >= batchSize) {
        await sheetsService.addProfiles(profiles);
        console.log(`   ✓ Saved batch of ${profiles.length} profiles to Google Sheets\n`);
        profiles.length = 0; // Clear array
      }

      // Show progress save message every 10 profiles
      if (csvDatabase && scrapedCount % batchSize === 0) {
        console.log(`   ✓ Saved progress to database (${scrapedCount} profiles)\n`);
      }

      // Delay to avoid rate limiting
      if (i < uniqueUsernames.length - 1) {
        await delay(config.scrapeDelay);
      }
    } catch (error) {
      console.error(`   ✗ Error scraping @${username}:`, (error as Error).message);
      failedProfiles.push(username);
      // Continue with next follower
    }
  }

  // Retry failed profiles once
  if (failedProfiles.length > 0) {
    console.log(`\n🔄 Retrying ${failedProfiles.length} failed profiles...\n`);

    for (let i = 0; i < failedProfiles.length; i++) {
      const username = failedProfiles[i];
      const progress = `[${i + 1}/${failedProfiles.length}]`;

      try {
        console.log(`${progress} Retrying @${username}...`);
        const profile = await scraper.getProfileInfo(username);

        if (csvDatabase) {
          csvDatabase.upsert(profile);
          await csvDatabase.save();
        } else {
          profiles.push(profile);
        }

        scrapedCount++;

        console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

        // Delay to avoid rate limiting
        if (i < failedProfiles.length - 1) {
          await delay(config.scrapeDelay);
        }
      } catch (error) {
        console.error(`   ✗ Retry failed for @${username}:`, (error as Error).message);
        // Don't add to failed list again, just skip
      }
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

// Get JSON file path and account name from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Please provide a JSON file path');
  console.error('\nUsage:');
  console.error('  npm run import followers.json');
  console.error('  npm run import followers.json accountName');
  console.error('  npm run import accountName followers.json');
  console.error('  npm run import /path/to/followers.json');
  console.error('\nMulti-Account Support:');
  console.error('  Each account will get its own:');
  console.error('  - Sheet tab in Google Sheets (named after the account)');
  console.error('  - CSV file (instagram_followers_accountName.csv)');
  console.error('\nYou can get the JSON file by:');
  console.error('  1. Go to Instagram Settings → Security → Download Data');
  console.error('  2. Wait for email (can take up to 48 hours)');
  console.error('  3. Download and extract the ZIP file');
  console.error('  4. Find followers.json or following.json in the extracted folder');
  process.exit(1);
}

// Parse arguments - support both orders:
// 1. "followers.json accountName"
// 2. "accountName followers.json"
let jsonFilePath: string;
let accountName: string = 'default';

if (args.length === 1) {
  // Single argument: just the file path
  jsonFilePath = args[0];
} else if (args.length >= 2) {
  // Two arguments: determine which is file and which is account name
  // Files typically end in .json or contain path separators
  const isFirstArgFile = args[0].endsWith('.json') || args[0].includes('/') || args[0].includes('\\');
  const isSecondArgFile = args[1].endsWith('.json') || args[1].includes('/') || args[1].includes('\\');

  if (isFirstArgFile && !isSecondArgFile) {
    // "followers.json accountName"
    jsonFilePath = args[0];
    accountName = args[1];
  } else if (!isFirstArgFile && isSecondArgFile) {
    // "accountName followers.json"
    accountName = args[0];
    jsonFilePath = args[1];
  } else if (isFirstArgFile) {
    // Both look like files, or first is a file - use first as file
    jsonFilePath = args[0];
    accountName = args[1];
  } else {
    // Neither looks like a file, assume first order
    jsonFilePath = args[0];
    accountName = args[1];
  }
} else {
  jsonFilePath = args[0];
}

importFromJSON(jsonFilePath, accountName).catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
