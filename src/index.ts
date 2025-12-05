import { InstagramScraper } from './instagram-scraper';
import { GoogleSheetsService } from './google-sheets';
import { CSVWriter } from './csv-writer';
import { CSVDatabase } from './csv-database';
import { getConfig } from './config';
import { IGProfile } from './types';

async function main() {
  console.log('🚀 Instagram Follower Scraper Starting...\n');

  try {
    // Load configuration
    const config = getConfig();
    console.log(`📋 Configuration loaded`);
    console.log(`   Instagram Account: ${config.igUsername}`);
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

    // Determine the Instagram handle to use
    let igHandle: string;
    if (config.igHandle) {
      igHandle = config.igHandle;
      console.log(`Using provided Instagram handle: @${igHandle}\n`);
    } else {
      console.log('📍 Detecting Instagram handle...');
      igHandle = await scraper.getCurrentUsername();
      console.log(`✓ Detected Instagram handle: @${igHandle}\n`);
    }

    // Get followers list
    console.log('👥 Fetching followers list...');
    const followers = await scraper.getFollowersList(igHandle);
    console.log(`✓ Found ${followers.length} followers\n`);

    if (followers.length === 0) {
      console.log('⚠️  No followers found. Exiting...');
      await scraper.close();
      return;
    }

    // Mark unfollowed users (only for CSV database)
    if (csvDatabase) {
      const unfollowedCount = csvDatabase.markUnfollowed(followers);
      if (unfollowedCount > 0) {
        console.log(`⚠️  Marked ${unfollowedCount} users as unfollowed (no longer in follower list)\n`);
      }
    }

    // Scrape profile information for each follower
    console.log(`📝 Processing ${followers.length} followers...`);
    console.log('   This may take a while...\n');

    const profiles: IGProfile[] = [];
    const batchSize = 10; // Save to sheet every 10 profiles
    let scrapedCount = 0;
    let cachedCount = 0;

    for (let i = 0; i < followers.length; i++) {
      const username = followers[i];
      const progress = `[${i + 1}/${followers.length}]`;

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
        if (i < followers.length - 1) {
          await delay(config.scrapeDelay);
        }
      } catch (error) {
        console.error(`   ✗ Error scraping @${username}:`, error);
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

    console.log('\n✅ Scraping completed successfully!');
    console.log(`📊 Total followers: ${followers.length}`);
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
