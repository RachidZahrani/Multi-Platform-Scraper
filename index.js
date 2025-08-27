const { input, select } = require("@inquirer/prompts");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const cliProgress = require("cli-progress");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Professional Multi-Platform Scraper v2.0\n");

  const specificType = await input({
    message:
      "What profession/service are you looking for? (e.g., doctor, lawyer, dentist, etc.):",
    validate: (input) => (input ? true : "Search query is required."),
  });

  const country = await input({
    message: "🌍 Enter the country:",
    validate: (input) => (input ? true : "Country is required."),
  });

  const city = await input({
    message: "🏙️ Enter the city:",
    validate: (input) =>
      input ? true : "City is required for comprehensive search.",
  });

  const searchDepth = await select({
    message: "🎯 Search intensity level:",
    choices: [
      { name: "🗺️ Only Google Maps", value: "maps-only" },
      { name: "🔍 Quick Search (Google Maps + Basic Web)", value: "quick" },
      {
        name: "🌐 Comprehensive (Maps, LinkedIn, Local Directories)",
        value: "comprehensive",
      },
      {
        name: "🚀 Deep Search (All platforms + Social networks)",
        value: "deep",
      },
      { name: "🎯 Ultra Professional (Maximum coverage)", value: "ultra" },
    ],
  });

  const limitOption = await select({
    message: "📊 Target number of results:",
    choices: [
      { name: "100 (Small)", value: "100" },
      { name: "250 (Medium)", value: "250" },
      { name: "500 (Large)", value: "500" },
      { name: "1000 (Very Large)", value: "1000" },
      { name: "Custom", value: "custom" },
    ],
  });

  let customLimit;
  if (limitOption === "custom") {
    customLimit = await input({
      message: "Enter custom limit:",
      validate: (input) =>
        !isNaN(parseInt(input)) && parseInt(input) > 0
          ? true
          : "Must be a positive number.",
    });
  }
  const limit =
    limitOption === "custom" ? parseInt(customLimit) : parseInt(limitOption);

  // Updated file format options
  const fileFormat = await select({
    message: "💾 Select the output file format:",
    choices: [
      { name: "📄 Excel (.xlsx)", value: "excel" },
      { name: "📜 JSON (.json)", value: "json" },
    ],
  });

  console.log("\n" + "=".repeat(60));
  console.log(`🔍 Searching for: ${specificType} in ${city}, ${country}`);
  console.log(`🎯 Search Depth: ${searchDepth.toUpperCase()}`);
  console.log(`📊 Target Records: ${limit}`);
  console.log(`💾 Output Format: ${fileFormat.toUpperCase()}`);
  console.log("=".repeat(60) + "\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  const scrapeManager = new ComprehensiveScraper(
    browser,
    specificType,
    city,
    country,
    limit
  );
  const results = await scrapeManager.executeProfessionalSearch(searchDepth);

  if (results.data.length > 0) {
    let filename;
    switch (fileFormat) {
      case "excel":
        filename = await generateExcel(
          results.data,
          results.fields,
          specificType,
          city,
          searchDepth
        );
        break;
      case "json":
        filename = await generateJSON(
          results.data,
          specificType,
          city,
          searchDepth
        );
        break;
      default:
        console.log("❌ Invalid file format selected.");
        return;
    }

    console.log("\n" + "🎉 ".repeat(20));
    console.log(`✅ SCRAPING COMPLETE!`);
    console.log(`📊 Total Records Found: ${results.data.length}`);
    console.log(`🌐 Platforms Searched: ${results.platformsSearched}`);
    console.log(`📋 Data Fields: ${results.fields.length}`);
    console.log(`📁 File saved as ${filename}!`);
    console.log("🎉 ".repeat(20));
  } else {
    console.log("\n❌ No data found. This might indicate:");
    console.log("    • Very specific search criteria");
    console.log("    • Platform access issues");
    console.log("    • Need to adjust search terms");
  }
  await browser.close();
}

class ComprehensiveScraper {
  constructor(browser, profession, city, country, limit) {
    this.browser = browser;
    this.profession = profession;
    this.city = city;
    this.country = country;
    this.limit = limit;
    this.allData = [];
    this.allFields = new Set([
      "name",
      "profile_url",
      "platform",
      "location",
      "profession_title",
      "latitude",
      "longitude",
    ]);
    this.seenProfiles = new Set();
    this.platformsSearched = [];

    this.progressBar = new cliProgress.SingleBar({
      format:
        "🔍 Scraping Progress |{bar}| {percentage}% | {value}/{total} Records | Current: {platform}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });
  }

  async executeProfessionalSearch(depth) {
    const platforms = this.getPlatformsByDepth(depth);
    this.progressBar.start(this.limit, 0, { platform: "Initializing..." });

    for (const platform of platforms) {
      if (this.allData.length >= this.limit) break;
      this.platformsSearched.push(platform.name);

      const scrapedCountBefore = this.allData.length;
      try {
        await this.searchPlatform(platform);
      } catch (error) {
        console.error(`❌ Error with ${platform.name}: ${error.message}`);
        continue;
      }

      const scrapedCountAfter = this.allData.length;
      if (scrapedCountAfter > scrapedCountBefore) {
        console.log(
          `\n✅ Found ${
            scrapedCountAfter - scrapedCountBefore
          } new records on ${platform.name}`
        );
      }
    }
    this.progressBar.update(this.allData.length);
    this.progressBar.stop();
    return {
      data: this.allData,
      fields: Array.from(this.allFields),
      platformsSearched: this.platformsSearched.join(", "),
    };
  }

  async searchPlatform(platform) {
    const methodName = `scrape${platform.name.replace(/\s/g, "")}`;
    if (typeof this[methodName] === "function") {
      await this[methodName]();
    } else {
      console.error(`❌ Scraper for ${platform.name} not implemented.`);
    }
  }

  async scrapeGoogleMaps() {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const query = `${this.profession} ${this.city} ${this.country}`;
    const url = `https://www.google.com/maps/search/$${encodeURIComponent(
      query
    )}`;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
      let previousCount = 0;
      let stableCount = 0;
      const maxScrolls = Math.ceil(this.limit / 10) + 10;
      const scrollableSelector = 'div[role="feed"]';

      for (let i = 0; i < maxScrolls; i++) {
        const cards = await page.$$(".Nv2PK");
        const currentCount = cards.length;

        if (currentCount > previousCount) {
          stableCount = 0;
          for (let j = previousCount; j < currentCount; j++) {
            if (this.allData.length >= this.limit) break;
            const businessData = await this.extractBusinessData(cards[j]);
            if (businessData) {
              businessData.platform = "Google Maps";
              this.addUniqueProfile(businessData);
              this.progressBar.update(this.allData.length, {
                platform: "Google Maps",
              });
            }
          }
        } else {
          stableCount++;
          if (stableCount >= 3) break;
        }

        previousCount = currentCount;
        if (this.allData.length >= this.limit) break;

        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollTop = element.scrollHeight;
          }
        }, scrollableSelector);

        await this.delay(3000);
      }
    } catch (error) {
      if (error.message.includes("Waiting for selector")) {
        console.error(
          "\n❌ No relevant records found on Google Maps. Moving on to the next platform."
        );
      } else {
        console.error(
          `❌ An unexpected error occurred while scraping Google Maps: ${error.message}`
        );
      }
    } finally {
      await page.close();
    }
  }

  async scrapeGoogleSearch() {
    const searches = [
      `"${this.profession}" "${this.city}" "${this.country}" contact`,
      `cabinet ${this.profession} ${this.city} adresse`,
    ];
    for (const searchQuery of searches) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          searchQuery
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href^="http"]');
                const titleEl = result.querySelector("h3");
                const descEl = result.querySelector(".VwiC3b, .s3v9rd");
                if (linkEl && titleEl) {
                  const description = descEl ? descEl.textContent : "";
                  profiles.push({
                    name: titleEl.textContent.trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    location: city,
                    description: description.substring(0, 200),
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Google Search";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Google Search",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Google Search. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Google Search: ${e.message}`
        );
      } finally {
        await page.close();
      }
    }
  }

  async scrapeLinkedIn() {
    const searches = [
      `site:linkedin.com/in "${this.profession}" "${this.city}"`,
      `site:linkedin.com/in "${this.profession}" "${this.country}"`,
    ];
    for (const searchQuery of searches) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          searchQuery
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(() => {
          const profiles = [];
          const searchResults = document.querySelectorAll(".g, .tF2Cxc");
          searchResults.forEach((result) => {
            try {
              const linkEl = result.querySelector('a[href*="linkedin.com"]');
              const titleEl = result.querySelector("h3");
              const descEl = result.querySelector(".VwiC3b, .s3v9rd");
              if (linkEl && titleEl && linkEl.href.includes("linkedin.com")) {
                profiles.push({
                  name: titleEl.textContent.trim().split("|")[0].trim(),
                  profile_url: linkEl.href,
                  profession_title: descEl ? descEl.textContent.trim() : "",
                  location: "",
                });
              }
            } catch (e) {}
          });
          return profiles;
        });
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "LinkedIn";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "LinkedIn",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on LinkedIn. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping LinkedIn: ${e.message}`
        );
      } finally {
        await page.close();
      }
    }
  }

  async scrapeProfessionalDirectories() {
    const directories = [
      `annuaire "${this.profession}" "${this.city}" "${this.country}"`,
    ];
    for (const query of directories) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (sourceType, profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href^="http"]');
                const titleEl = result.querySelector("h3");
                const descEl = result.querySelector(".VwiC3b, .s3v9rd");
                if (linkEl && titleEl) {
                  const description = descEl ? descEl.textContent : "";
                  profiles.push({
                    name: titleEl.textContent.trim().split("|")[0].trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    location: city,
                    source_type: sourceType,
                    description: description.substring(0, 200),
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          "Professional Directory",
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Professional Directories";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Professional Directories",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Professional Directories. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Professional Directories: ${e.message}`
        );
      } finally {
        await page.close();
      }
    }
  }

  async scrapeYellowPages() {
    const yellowPagesQueries = [
      `site:pagesjaunes.ma "${this.profession}" "${this.city}"`,
      `site:telecontact.ma "${this.profession}" "${this.city}"`,
    ];
    for (const query of yellowPagesQueries) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (sourceType, profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href^="http"]');
                const titleEl = result.querySelector("h3");
                const descEl = result.querySelector(".VwiC3b, .s3v9rd");
                if (linkEl && titleEl) {
                  const description = descEl ? descEl.textContent : "";
                  profiles.push({
                    name: titleEl.textContent.trim().split("|")[0].trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    location: city,
                    source_type: sourceType,
                    description: description.substring(0, 200),
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          "Yellow Pages",
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Yellow Pages";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Yellow Pages",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Yellow Pages. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Yellow Pages: ${e.message}`
        );
      } finally {
        await page.close();
      }
    }
  }

  async scrapeFacebook() {
    const facebookQueries = [
      `site:facebook.com/pages "${this.profession}" "${this.city}"`,
      `site:facebook.com/public/${this.profession.replace(
        /\s+/g,
        "-"
      )}-${this.city.replace(/\s+/g, "-")}`,
    ];
    for (const query of facebookQueries) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (sourceType, profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href*="facebook.com"]');
                const titleEl = result.querySelector("h3");
                if (
                  linkEl &&
                  titleEl &&
                  !linkEl.href.includes("facebook.com/login")
                ) {
                  profiles.push({
                    name: titleEl.textContent.trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    platform_specific: "Facebook Business Page",
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Facebook";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Facebook",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Facebook. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Facebook: ${e.message}`
        );
      } finally {
        await page.close();
      }
    }
  }

  async scrapeLocalBusinessSites() {
    const localQueries = [
      `${this.profession} ${this.city} maroc contact telephone`,
      `cabinet ${this.profession} ${this.city} rendez-vous`,
    ];
    for (const query of localQueries) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (sourceType, profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href^="http"]');
                const titleEl = result.querySelector("h3");
                const descEl = result.querySelector(".VwiC3b, .s3v9rd");
                if (linkEl && titleEl) {
                  const description = descEl ? descEl.textContent : "";
                  profiles.push({
                    name: titleEl.textContent.trim().split("|")[0].trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    location: city,
                    source_type: sourceType,
                    description: description.substring(0, 200),
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          "Local Business Site",
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Local Business Sites";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Local Business Sites",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Local Business Sites. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Local Business Sites: ${e.message}`
        );
        continue;
      } finally {
        await page.close();
      }
    }
  }

  async scrapeMedicalDirectories() {
    const medicalDirectories = [
      `"ordre des médecins" "${this.city}" "${this.country}"`,
      `annuaire médecin ${this.city} maroc`,
    ];
    if (
      !this.profession.toLowerCase().includes("médecin") &&
      !this.profession.toLowerCase().includes("docteur")
    ) {
      return;
    }
    for (const query of medicalDirectories) {
      const page = await this.browser.newPage();
      await this.setupPage(page);
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(
          query
        )}&num=50`;
        await page.goto(url, { waitUntil: "networkidle2" });
        const results = await page.evaluate(
          (sourceType, profession, city) => {
            const profiles = [];
            const searchResults = document.querySelectorAll(".g, .tF2Cxc");
            searchResults.forEach((result) => {
              try {
                const linkEl = result.querySelector('a[href^="http"]');
                const titleEl = result.querySelector("h3");
                const descEl = result.querySelector(".VwiC3b, .s3v9rd");
                if (linkEl && titleEl) {
                  const description = descEl ? descEl.textContent : "";
                  profiles.push({
                    name: titleEl.textContent.trim().split("|")[0].trim(),
                    profile_url: linkEl.href,
                    profession_title: profession,
                    location: city,
                    source_type: sourceType,
                    description: description.substring(0, 200),
                  });
                }
              } catch (e) {}
            });
            return profiles;
          },
          "Medical Directory",
          this.profession,
          this.city
        );
        if (results.length > 0) {
          for (const profile of results) {
            if (this.allData.length >= this.limit) break;
            profile.platform = "Medical Directories";
            this.addUniqueProfile(profile);
            this.progressBar.update(this.allData.length, {
              platform: "Medical Directories",
            });
          }
        } else {
          console.log(
            "\n❌ No relevant records found on Medical Directories. Moving on to the next platform."
          );
        }
        await this.delay(2000);
      } catch (e) {
        console.error(
          `❌ An unexpected error occurred while scraping Medical Directories: ${e.message}`
        );
        continue;
      } finally {
        await page.close();
      }
    }
  }

  getPlatformsByDepth(depth) {
    const platforms = {
      "maps-only": [{ name: "Google Maps", type: "maps" }],
      quick: [
        { name: "Google Maps", type: "maps" },
        { name: "Google Search", type: "google" },
      ],
      comprehensive: [
        { name: "Google Maps", type: "maps" },
        { name: "LinkedIn", type: "linkedin" },
        { name: "Professional Directories", type: "directories" },
        { name: "Google Search", type: "google" },
      ],
      deep: [
        { name: "Google Maps", type: "maps" },
        { name: "LinkedIn", type: "linkedin" },
        { name: "Professional Directories", type: "directories" },
        { name: "Google Search", type: "google" },
        { name: "Facebook Business", type: "facebook" },
        { name: "Local Business Sites", type: "local" },
      ],
      ultra: [
        { name: "Google Maps", type: "maps" },
        { name: "LinkedIn", type: "linkedin" },
        { name: "Professional Directories", type: "directories" },
        { name: "Google Search", type: "google" },
        { name: "Facebook Business", type: "facebook" },
        { name: "Local Business Sites", type: "local" },
        { name: "Yellow Pages", type: "yellowpages" },
        { name: "Medical Directories", type: "medical" },
      ],
    };
    return platforms[depth] || platforms.comprehensive;
  }

  async extractBusinessData(card) {
    const data = {};
    try {
      data.name = await card
        .$eval(".qBF1Pd, .fontHeadlineSmall", (el) => el.textContent.trim())
        .catch(() => "");
      data.profile_url = await card
        .$eval("a.hfpxzc", (el) => el.href)
        .catch(() => "");
      data.profession_title = await card
        .$eval(".W4Efsd", (el) => el.textContent.trim())
        .catch(() => "");
      data.location = await card
        .$eval(".W4Efsd:last-child", (el) => el.textContent.trim())
        .catch(() => "");
      data.rating = await card
        .$eval(".MW4etd", (el) => el.textContent.trim())
        .catch(() => "");

      if (data.profile_url) {
        const coords = this.extractCoordinatesFromUrl(data.profile_url);
        data.latitude = coords.latitude;
        data.longitude = coords.longitude;

        const detailData = await this.extractGoogleMapsDetails(
          data.profile_url
        );
        Object.assign(data, detailData);
      }
    } catch (e) {
      return null;
    }
    return data;
  }

  extractCoordinatesFromUrl(url) {
    const latLongRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
    const match = url.match(latLongRegex);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
      };
    }
    return { latitude: "", longitude: "" };
  }

  async extractGoogleMapsDetails(url) {
    const detailPage = await this.browser.newPage();
    await this.setupPage(detailPage);
    try {
      await detailPage.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const details = await detailPage.evaluate(() => {
        const data = {};
        const phoneSelectors = [
          '[data-item-id*="phone"]',
          'button[data-item-id*="phone"]',
          '[aria-label*="Phone"]',
        ];
        for (const selector of phoneSelectors) {
          const phoneEl = document.querySelector(selector);
          if (phoneEl) {
            let phoneText =
              phoneEl.textContent || phoneEl.getAttribute("aria-label") || "";
            phoneText = phoneText.replace(/Phone:?\s*/i, "").trim();
            phoneText = phoneText.replace(/^0+/, "").replace(/-/g, "");
            if (phoneText && phoneText.length > 5) {
              data.phone = phoneText;
              break;
            }
          }
        }
        const websiteEl = document.querySelector(
          '[data-item-id*="authority"], a[href*="http"]:not([href*="google.com"])'
        );
        if (websiteEl) {
          data.website = websiteEl.href;
        }
        const addressEl = document.querySelector('[data-item-id*="address"]');
        if (addressEl) {
          data.full_address = addressEl.textContent.trim();
        }
        return data;
      });
      await detailPage.close();
      return details;
    } catch (error) {
      await detailPage.close();
      return {};
    }
  }

  addUniqueProfile(profile) {
    const identifier = `${profile.name}_${profile.profile_url}`.toLowerCase();
    if (
      !this.seenProfiles.has(identifier) &&
      profile.name &&
      profile.profile_url
    ) {
      this.allData.push(profile);
      this.seenProfiles.add(identifier);
      Object.keys(profile).forEach((key) => {
        if (profile[key]) this.allFields.add(key);
      });
    }
  }

  async setupPage(page) {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function generateExcel(data, fields, profession, city, searchDepth) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Professional Directory");
  const headers = ["#", ...fields];
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2F5597" },
  };
  data.forEach((row, index) => {
    const rowData = [index + 1, ...fields.map((field) => row[field] || "")];
    sheet.addRow(rowData);
  });
  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    let maxLength = header.length;
    data.forEach((row) => {
      const cellValue = String(row[header] || "");
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(maxLength + 2, 60);
  });
  const summarySheet = workbook.addWorksheet("Search Summary");
  summarySheet.addRow(["Search Parameter", "Value"]);
  summarySheet.addRow(["Profession/Service", profession]);
  summarySheet.addRow(["City", city]);
  summarySheet.addRow(["Search Depth", searchDepth]);
  summarySheet.addRow(["Total Records Found", data.length]);
  summarySheet.addRow(["Search Date", new Date().toLocaleString()]);
  summarySheet.addRow(["Unique Fields Detected", fields.length]);
  summarySheet.addRow(["Fields List", fields.join(", ")]);
  const platformCounts = {};
  data.forEach((record) => {
    const platform = record.platform || "Unknown";
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });
  summarySheet.addRow(["", ""]);
  summarySheet.addRow(["Platform Breakdown", "Count"]);
  Object.entries(platformCounts).forEach(([platform, count]) => {
    summarySheet.addRow([platform, count]);
  });
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const filename = `scraped_${profession.replace(/\s+/g, "_")}_${city.replace(
    /\s+/g,
    "_"
  )}_${searchDepth}_${timestamp}.xlsx`;
  await workbook.xlsx.writeFile(filename);
  return filename;
}

async function generateJSON(data, profession, city, searchDepth) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const filename = `scraped_${profession.replace(/\s+/g, "_")}_${city.replace(
    /\s+/g,
    "_"
  )}_${searchDepth}_${timestamp}.json`;
  const jsonData = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(filename, jsonData);
  return filename;
}

main().catch((error) => {
  if (error.name === "ExitPromptError") {
    console.log("\n👋 Operation cancelled by user. Goodbye!");
    process.exit(0);
  } else {
    console.error("❌ An error occurred:", error.message);
    process.exit(1);
  }
});
