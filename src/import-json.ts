import * as fs from 'fs';
import * as path from 'path';
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

async function importFromJSON(jsonFilePath: string) {
  console.log('📂 Instagram JSON Importer\n');

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
