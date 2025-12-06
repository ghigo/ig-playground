import { InstagramScraper } from './instagram-scraper';
import { CSVDatabase } from './csv-database';
import { getConfig } from './config';

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

    // Initialize CSV Database (Google Sheets not supported for live scraping)
    if (config.outputFormat === 'google-sheets') {
      console.error('❌ Error: Google Sheets mode is not supported for live scraping');
      console.error('   The follower list must be imported from a JSON file');
      console.error('   Please set OUTPUT_FORMAT=csv in your .env file');
      console.error('   Or use: npm run import followers.json');
      process.exit(1);
    }

    console.log('📄 Initializing CSV Database...');
    const csvDatabase = new CSVDatabase('instagram_followers.csv');
    await csvDatabase.load();
    console.log('✓ CSV Database initialized\n');

    // Get followers list from CSV database
    console.log('👥 Loading followers list from database...');
    const followers = csvDatabase.getActiveFollowers();
    console.log(`✓ Found ${followers.length} active followers in database\n`);

    if (followers.length === 0) {
      console.log('⚠️  No followers found in database.');
      console.log('\n📝 To get started, you need to import your follower list:');
      console.log('   1. Go to Instagram Settings → Security → Download Data');
      console.log('   2. Wait for email (can take up to 48 hours)');
      console.log('   3. Download and extract the ZIP file');
      console.log('   4. Run: npm run import followers.json');
      console.log('\n   The follower list can only be uploaded via JSON, not scraped.');
      return;
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

    // Scrape profile information for each follower
    console.log(`📝 Processing ${followers.length} followers...`);
    console.log('   This may take a while...\n');

    const batchSize = 10; // Save every 10 profiles
    let scrapedCount = 0;
    let cachedCount = 0;

    for (let i = 0; i < followers.length; i++) {
      const username = followers[i];
      const progress = `[${i + 1}/${followers.length}]`;

      try {
        // Check if we should update this profile (cache logic)
        if (!csvDatabase.shouldUpdate(username, config.cacheDays)) {
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
        csvDatabase.upsert(profile);
        // Save immediately after each profile to prevent data loss on interruption
        await csvDatabase.save();
        scrapedCount++;

        // Display quick stats
        console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

        // Show progress save message every 10 profiles
        if (scrapedCount % batchSize === 0) {
          console.log(`   ✓ Saved progress to database (${scrapedCount} profiles)\n`);
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
    await csvDatabase.save();
    const stats = csvDatabase.getStats();
    console.log(`\n✓ Database saved with ${stats.total} profiles (${stats.active} active, ${stats.unfollowed} unfollowed)`);

    console.log('\n✅ Scraping completed successfully!');
    console.log(`📊 Total followers: ${followers.length}`);
    console.log(`   • New/Updated profiles: ${scrapedCount}`);
    console.log(`   • Cached profiles: ${cachedCount}`);
    console.log(`📁 CSV database saved to: ${csvDatabase.getFilePath()}`);

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
