import { InstagramScraper } from './instagram-scraper';
import { CSVDatabase } from './csv-database';
import { GoogleSheetsService } from './google-sheets';
import { getConfig } from './config';
import { AccountManager } from './account-manager';
import { IGProfile } from './types';

async function main() {
  console.log('🚀 Instagram Follower Scraper Starting...\n');

  try {
    // Get Instagram username from command line arguments
    const args = process.argv.slice(2);
    const igUsername = args[0]; // Can be undefined (will use .env)

    // Load configuration with account-specific credentials
    const config = getConfig(igUsername);
    const accountName = config.igUsername; // Use the IG username as the account name

    console.log(`📱 Instagram Account: @${accountName}\n`);
    console.log(`📋 Configuration loaded`);
    console.log(`   Instagram Account: ${config.igUsername}`);
    console.log(`   Output Format: ${config.outputFormat}`);
    console.log(`   Headless Mode: ${config.headless}`);
    console.log(`   Scrape Delay: ${config.scrapeDelay}ms`);
    console.log(`   Cache Duration: ${config.cacheDays} days\n`);

    // Initialize database (CSV or Google Sheets)
    let csvDatabase: CSVDatabase | null = null;
    let sheetsService: GoogleSheetsService | null = null;
    let followers: string[] = [];

    if (config.outputFormat === 'google-sheets') {
      console.log('📊 Initializing Google Sheets...');
      sheetsService = new GoogleSheetsService(
        config.googleSheetId!,
        config.googleServiceAccountKeyPath!,
        accountName
      );
      // Load existing data from the sheet
      await sheetsService.initializeSheet(false); // Don't clear - load existing data
      console.log('✓ Google Sheets initialized\n');

      // Get followers list from Google Sheets
      console.log('👥 Loading followers list from sheet...');
      followers = sheetsService.getActiveFollowers();
      console.log(`✓ Found ${followers.length} active followers in sheet\n`);
    } else {
      console.log('📄 Initializing CSV Database...');
      const csvFilename = `instagram_followers_${accountName}.csv`;
      csvDatabase = new CSVDatabase(csvFilename);
      await csvDatabase.load();
      console.log('✓ CSV Database initialized\n');

      // Get followers list from CSV database
      console.log('👥 Loading followers list from database...');
      followers = csvDatabase.getActiveFollowers();
      console.log(`✓ Found ${followers.length} active followers in database\n`);
    }

    if (followers.length === 0) {
      console.log('⚠️  No followers found in database.');
      console.log('\n📝 To get started, you need to import your follower list:');
      console.log('   1. Go to Instagram Settings → Security → Download Data');
      console.log('   2. Wait for email (can take up to 48 hours)');
      console.log('   3. Download and extract the ZIP file');
      console.log(`   4. Run: npm run import followers.json ${accountName !== 'default' ? accountName : ''}`);
      console.log('\n   The follower list can only be uploaded via JSON, not scraped.');
      return;
    }

    // Initialize Instagram Scraper with account-specific session
    console.log('🌐 Initializing Instagram Scraper...');
    const accountManager = new AccountManager();
    const sessionPath = accountManager.getSessionPath(accountName);
    const scraper = new InstagramScraper(config.headless, sessionPath);
    await scraper.init();
    console.log('✓ Browser initialized\n');

    // Login to Instagram
    console.log('🔐 Logging into Instagram...');
    await scraper.login(config.igUsername, config.igPassword);
    console.log('✓ Successfully logged in\n');

    // Scrape profile information for each follower
    console.log(`📝 Processing ${followers.length} followers...`);
    console.log('   This may take a while...\n');

    const batchSize = 10; // Save every 10 profiles
    let scrapedCount = 0;
    let cachedCount = 0;
    const failedProfiles: string[] = []; // Track failed profiles for retry

    for (let i = 0; i < followers.length; i++) {
      const username = followers[i];
      const progress = `[${i + 1}/${followers.length}]`;

      try {
        // Check if we should update this profile (cache logic)
        const shouldUpdate = csvDatabase
          ? csvDatabase.shouldUpdate(username, config.cacheDays)
          : sheetsService!.shouldUpdate(username, config.cacheDays);

        if (!shouldUpdate) {
          const cached = csvDatabase ? csvDatabase.get(username) : sheetsService!.get(username);
          if (cached) {
            console.log(`${progress} @${username} (cached)`);
            console.log(`   → ${cached.fullName || 'N/A'} | Followers: ${cached.followers} | Using cached data`);
            // Still upsert to mark as not unfollowed
            if (csvDatabase) {
              csvDatabase.upsert(cached);
            } else if (sheetsService) {
              await sheetsService.upsert(cached);
            }
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
        } else if (sheetsService) {
          await sheetsService.upsert(profile);
        }

        scrapedCount++;

        // Display quick stats
        console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

        // Show progress save message every 10 profiles
        if (scrapedCount % batchSize === 0) {
          console.log(`   ✓ Saved progress to ${csvDatabase ? 'database' : 'sheet'} (${scrapedCount} profiles)\n`);
        }

        // Delay to avoid rate limiting
        if (i < followers.length - 1) {
          await delay(config.scrapeDelay);
        }
      } catch (error) {
        console.error(`   ✗ Error scraping @${username}:`, error);
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
          } else if (sheetsService) {
            await sheetsService.upsert(profile);
          }

          scrapedCount++;

          console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

          // Delay to avoid rate limiting
          if (i < failedProfiles.length - 1) {
            await delay(config.scrapeDelay);
          }
        } catch (error) {
          console.error(`   ✗ Retry failed for @${username}:`, error);
          // Don't add to failed list again, just skip
        }
      }
    }

    // Save final data and show stats
    if (csvDatabase) {
      await csvDatabase.save();
      const stats = csvDatabase.getStats();
      console.log(`\n✓ Database saved with ${stats.total} profiles (${stats.active} active, ${stats.unfollowed} unfollowed)`);
    } else if (sheetsService) {
      const stats = sheetsService.getStats();
      console.log(`\n✓ Sheet saved with ${stats.total} profiles (${stats.active} active, ${stats.unfollowed} unfollowed)`);
    }

    console.log('\n✅ Scraping completed successfully!');
    console.log(`📊 Total followers: ${followers.length}`);
    console.log(`   • New/Updated profiles: ${scrapedCount}`);
    console.log(`   • Cached profiles: ${cachedCount}`);

    if (csvDatabase) {
      console.log(`📁 CSV database saved to: ${csvDatabase.getFilePath()}`);
    } else if (sheetsService) {
      console.log(`🔗 View your Google Sheet: https://docs.google.com/spreadsheets/d/${config.googleSheetId}`);
      console.log(`   Sheet tab: "${accountName}"`);
    }

    // Close browser
    await scraper.close();
    console.log('\n👋 Browser closed. Goodbye!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the main function
main().catch(console.error);
