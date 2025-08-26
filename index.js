const { input, select, confirm } = require("@inquirer/prompts");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const fs = require("fs");

async function main() {
  console.log("🚀 Professional Multi-Platform Scraper v4.0\n");

  const specificType = await input({
    message:
      "What profession/service are you looking for? (e.g., médecin, avocat, dentiste, etc.):",
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

  console.log("\n" + "=".repeat(60));
  console.log(`🔍 Searching for: ${specificType} in ${city}, ${country}`);
  console.log(`🎯 Search Depth: ${searchDepth.toUpperCase()}`);
  console.log(`📊 Target Results: ${limit}`);
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

  await browser.close();

  if (results.data.length > 0) {
    await generateProfessionalExcel(
      results.data,
      results.fields,
      specificType,
      city,
      country,
      searchDepth
    );
    console.log("\n" + "🎉 ".repeat(20));
    console.log(`✅ SCRAPING COMPLETE!`);
    console.log(`📊 Total Records Found: ${results.data.length}`);
    console.log(`🌐 Platforms Searched: ${results.platformsSearched}`);
    console.log(`📋 Data Fields: ${results.fields.length}`);
    console.log(`📁 Excel file saved with comprehensive data!`);
    console.log("🎉 ".repeat(20));
  } else {
    console.log("\n❌ No data found. This might indicate:");
    console.log("    • Very specific search criteria");
    console.log("    • Platform access issues");
    console.log("    • Need to adjust search terms");
  }
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
    ]);
    this.seenProfiles = new Set();
    this.platformsSearched = [];
  }

  async executeProfessionalSearch(depth) {
    const platforms = this.getPlatformsByDepth(depth);

    for (const platform of platforms) {
      if (this.allData.length >= this.limit) break;

      console.log(`🔍 Searching ${platform.name}...`);
      this.platformsSearched.push(platform.name);

      try {
        const remainingLimit = this.limit - this.allData.length;
        const platformData = await this.searchPlatform(
          platform,
          remainingLimit
        );

        console.log(
          `✅ Found ${platformData.length} unique profiles on ${platform.name}`
        );

        platformData.forEach((profile) => {
          profile.platform = platform.name;
          this.addUniqueProfile(profile);
        });

        await this.delay(2000);
      } catch (error) {
        console.error(`❌ Error with ${platform.name}: ${error.message}`);
        continue;
      }
    }

    return {
      data: this.allData,
      fields: Array.from(this.allFields),
      platformsSearched: this.platformsSearched.join(", "),
    };
  }

  getPlatformsByDepth(depth) {
    const platforms = {
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

  async searchPlatform(platform, limit) {
    switch (platform.type) {
      case "maps":
        return await this.scrapeGoogleMaps(limit);
      case "linkedin":
        return await this.scrapeLinkedIn(limit);
      case "google":
        return await this.scrapeGoogleSearch(limit);
      case "yellowpages":
        return await this.scrapeYellowPages(limit);
      case "facebook":
        return await this.scrapeFacebook(limit);
      case "directories":
        return await this.scrapeProfessionalDirectories(limit);
      case "medical":
        return await this.scrapeMedicalDirectories(limit);
      case "local":
        return await this.scrapeLocalBusinessSites(limit);
      default:
        return [];
    }
  }

  // New and improved scraping functions

  async scrapeGoogleMaps(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const query = `${this.profession} ${this.city} ${this.country}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(
      query
    )}`;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
      await this.scrollAndLoad(page, limit);
      const data = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll(".Nv2PK");
        cards.forEach((card) => {
          try {
            const nameEl = card.querySelector(".qBF1Pd, .fontHeadlineSmall");
            const linkEl = card.querySelector("a.hfpxzc");
            const categoryEl = card.querySelector(".W4Efsd");
            const ratingEl = card.querySelector(".MW4etd");
            const addressEl = card.querySelector(".W4Efsd:last-child");
            if (nameEl && linkEl) {
              results.push({
                name: nameEl.textContent.trim(),
                profile_url: linkEl.href,
                profession_title: categoryEl
                  ? categoryEl.textContent.trim()
                  : "",
                location: addressEl ? addressEl.textContent.trim() : "",
                rating: ratingEl ? ratingEl.textContent.trim() : "",
                phone: "",
                website: "",
              });
            }
          } catch (e) {}
        });
        return results;
      });
      for (let i = 0; i < Math.min(data.length, limit); i++) {
        try {
          const detailData = await this.extractGoogleMapsDetails(
            data[i].profile_url
          );
          Object.assign(data[i], detailData);
          Object.keys(data[i]).forEach((key) => {
            if (data[i][key]) this.allFields.add(key);
          });
        } catch (e) {
          continue;
        }
      }
      await page.close();
      return data.slice(0, limit);
    } catch (error) {
      await page.close();
      return [];
    }
  }

  async scrapeLinkedIn(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const searches = [
      `site:linkedin.com/in "${this.profession}" "${this.city}"`,
      `site:linkedin.com/in "${this.profession}" "${this.country}"`,
    ];
    const data = [];
    for (const searchQuery of searches) {
      if (data.length >= limit) break;
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
        data.push(...results);
        await this.delay(2000);
      } catch (e) {
        continue;
      }
    }
    await page.close();
    return data.slice(0, limit);
  }

  async scrapeGoogleSearch(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const searches = [
      `"${this.profession}" "${this.city}" "${this.country}" contact`,
      `cabinet ${this.profession} ${this.city} adresse`,
    ];
    const data = [];
    for (const searchQuery of searches) {
      if (data.length >= limit) break;
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
        data.push(...results);
        await this.delay(2000);
      } catch (e) {
        continue;
      }
    }
    await page.close();
    return data.slice(0, limit);
  }

  async scrapeYellowPages(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const yellowPagesQueries = [
      `site:pagesjaunes.ma "${this.profession}" "${this.city}"`,
      `site:telecontact.ma "${this.profession}" "${this.city}"`,
    ];
    return await this.searchGeneralDirectories(
      page,
      yellowPagesQueries,
      limit,
      "Yellow Pages"
    );
  }

  async scrapeFacebook(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const facebookQueries = [
      `site:facebook.com/pages "${this.profession}" "${this.city}"`,
      `site:facebook.com/public/${this.profession.replace(
        /\s+/g,
        "-"
      )}-${this.city.replace(/\s+/g, "-")}`,
    ];
    return await this.searchGeneralDirectories(
      page,
      facebookQueries,
      limit,
      "Facebook Business"
    );
  }

  async scrapeProfessionalDirectories(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const directories = [
      `annuaire "${this.profession}" "${this.city}" "${this.country}"`,
    ];
    return await this.searchGeneralDirectories(
      page,
      directories,
      limit,
      "Professional Directory"
    );
  }

  async scrapeMedicalDirectories(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    if (
      !this.profession.toLowerCase().includes("médecin") &&
      !this.profession.toLowerCase().includes("docteur")
    ) {
      return [];
    }
    const medicalDirectories = [
      `"ordre des médecins" "${this.city}" "${this.country}"`,
      `annuaire médecin ${this.city} maroc`,
    ];
    return await this.searchGeneralDirectories(
      page,
      medicalDirectories,
      limit,
      "Medical Directory"
    );
  }

  async scrapeLocalBusinessSites(limit) {
    const page = await this.browser.newPage();
    await this.setupPage(page);
    const localQueries = [
      `${this.profession} ${this.city} maroc contact telephone`,
      `cabinet ${this.profession} ${this.city} rendez-vous`,
    ];
    return await this.searchGeneralDirectories(
      page,
      localQueries,
      limit,
      "Local Business Site"
    );
  }

  async searchGeneralDirectories(page, queries, limit, sourceType) {
    const data = [];
    for (const query of queries) {
      if (data.length >= limit) break;
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
          sourceType,
          this.profession,
          this.city
        );
        data.push(...results);
        await this.delay(2000);
      } catch (e) {
        continue;
      }
    }
    await page.close();
    return data.slice(0, limit);
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

  async scrollAndLoad(page, targetCount) {
    const scrollableSelector = 'div[role="feed"]';
    let previousCount = 0;
    let stableCount = 0;
    const maxScrolls = Math.ceil(targetCount / 10) + 10;
    for (let i = 0; i < maxScrolls; i++) {
      const currentCards = await page.$$(".Nv2PK");
      const currentCount = currentCards.length;
      if (currentCount >= targetCount) break;
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 3) break;
      } else {
        stableCount = 0;
      }
      previousCount = currentCount;
      try {
        await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            element.scrollTop = element.scrollHeight;
          }
        }, scrollableSelector);
      } catch (e) {
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight)
        );
      }
      await this.delay(3000);
    }
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function generateProfessionalExcel(
  data,
  fields,
  profession,
  city,
  country,
  searchDepth
) {
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
  summarySheet.addRow(["Country", country]);
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

main().catch(console.error);
