import * as fs from 'fs';
import { InstagramScraper } from './instagram-scraper';
import { GoogleSheetsService } from './google-sheets';
import { CSVWriter } from './csv-writer';
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
  console.log(`   Scrape Delay: ${config.scrapeDelay}ms\n`);

  // Initialize output service (CSV or Google Sheets)
  let sheetsService: GoogleSheetsService | null = null;
  let csvWriter: CSVWriter | null = null;

  if (config.outputFormat === 'google-sheets') {
    console.log('📊 Initializing Google Sheets...');
    sheetsService = new GoogleSheetsService(
      config.googleSheetId!,
      config.googleServiceAccountKeyPath!
    );
    await sheetsService.initializeSheet();
    console.log('✓ Google Sheets initialized\n');
  } else {
    console.log('📄 Initializing CSV Writer...');
    csvWriter = new CSVWriter('instagram_followers_from_json.csv');
    await csvWriter.initialize();
    console.log('✓ CSV Writer initialized\n');
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

  for (let i = 0; i < uniqueUsernames.length; i++) {
    const username = uniqueUsernames[i];
    const progress = `[${i + 1}/${uniqueUsernames.length}]`;

    try {
      console.log(`${progress} Scraping @${username}...`);
      const profile = await scraper.getProfileInfo(username);
      profiles.push(profile);

      // Display quick stats
      console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

      // Save in batches
      if (profiles.length >= batchSize) {
        if (sheetsService) {
          await sheetsService.addProfiles(profiles);
          console.log(`   ✓ Saved batch of ${profiles.length} profiles to Google Sheets\n`);
        } else if (csvWriter) {
          await csvWriter.addProfiles(profiles);
          console.log(`   ✓ Saved batch of ${profiles.length} profiles to CSV\n`);
        }
        profiles.length = 0; // Clear array
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

  // Save remaining profiles
  if (profiles.length > 0) {
    if (sheetsService) {
      await sheetsService.addProfiles(profiles);
      console.log(`\n✓ Saved final batch of ${profiles.length} profiles to Google Sheets`);
    } else if (csvWriter) {
      await csvWriter.addProfiles(profiles);
      console.log(`\n✓ Saved final batch of ${profiles.length} profiles to CSV`);
    }
  }

  // Close CSV writer if used
  if (csvWriter) {
    await csvWriter.close();
  }

  console.log('\n✅ Import completed successfully!');
  console.log(`📊 Total profiles scraped: ${uniqueUsernames.length}`);

  if (config.outputFormat === 'google-sheets') {
    console.log(`🔗 View your Google Sheet: https://docs.google.com/spreadsheets/d/${config.googleSheetId}`);
  } else if (csvWriter) {
    console.log(`📁 CSV file saved to: ${csvWriter.getFilePath()}`);
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
