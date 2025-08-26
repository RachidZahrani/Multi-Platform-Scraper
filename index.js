const { input, select, confirm } = require("@inquirer/prompts");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const fs = require("fs");

async function main() {
  console.log("🚀 Professional Web Scraper v2.0\n");

  // Get search query
  const specificType = await input({
    message:
      "What do you want to search for? (e.g., doctors, laptops, restaurants, lawyers, etc.):",
    validate: (input) => (input ? true : "Search query is required."),
  });

  // Determine search strategy
  const searchStrategy = await select({
    message: "How would you like to search?",
    choices: [
      { name: "🎯 Dynamic Search (AI chooses best sources)", value: "dynamic" },
      { name: "🗺️  Google Maps only", value: "maps" },
      { name: "🛍️  Google Shopping only", value: "shopping" },
      { name: "🔍 Google Search only", value: "google" },
      { name: "🌐 All sources (Maps + Shopping + Google)", value: "all" },
    ],
  });

  let country = "";
  let city = "";

  // For Maps or location-based searches, require location
  if (
    searchStrategy === "maps" ||
    searchStrategy === "all" ||
    (searchStrategy === "dynamic" && isLocationBasedQuery(specificType))
  ) {
    country = await input({
      message: "🌍 Enter the country (required for location-based searches):",
      validate: (input) =>
        input ? true : "Country is required for location-based searches.",
    });

    city = await input({
      message:
        "🏙️  Enter the city (optional, but recommended for better results):",
    });
  } else {
    // For product searches, location is optional but can help
    country = await input({
      message: "🌍 Enter the country (optional, helps find local stores):",
    });

    if (country) {
      city = await input({
        message: "🏙️  Enter the city (optional):",
      });
    }
  }

  const limitOption = await select({
    message: "📊 How many records do you want?",
    choices: [
      { name: "10 (Quick test)", value: "10" },
      { name: "30 (Small dataset)", value: "30" },
      { name: "50 (Medium dataset)", value: "50" },
      { name: "100 (Large dataset)", value: "100" },
      { name: "200 (Very large dataset)", value: "200" },
      { name: "Custom amount", value: "custom" },
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
  const location = city ? `${city}, ${country}` : country;

  console.log("\n" + "=".repeat(50));
  console.log(`🔍 Search Query: ${specificType}`);
  console.log(`📍 Location: ${location || "Global"}`);
  console.log(`🎯 Strategy: ${searchStrategy}`);
  console.log(`📊 Target Records: ${limit}`);
  console.log("=".repeat(50) + "\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let allData = [];
  let allFields = new Set();

  try {
    if (searchStrategy === "dynamic") {
      const result = await dynamicSearch(
        browser,
        specificType,
        location,
        limit
      );
      allData = result.data;
      result.fields.forEach((field) => allFields.add(field));
    } else if (searchStrategy === "all") {
      const results = await searchAllSources(
        browser,
        specificType,
        location,
        limit
      );
      allData = results.data;
      results.fields.forEach((field) => allFields.add(field));
    } else {
      const result = await searchSingleSource(
        browser,
        specificType,
        location,
        limit,
        searchStrategy
      );
      allData = result.data;
      result.fields.forEach((field) => allFields.add(field));
    }
  } catch (error) {
    console.error("❌ Error during scraping:", error);
  } finally {
    await browser.close();
  }

  if (allData.length > 0) {
    const finalFields = Array.from(allFields);
    await generateExcel(allData, finalFields, specificType, searchStrategy);

    console.log("\n" + "✅ ".repeat(25));
    console.log(`🎉 Scraping complete! Found ${allData.length} records.`);
    console.log(`📋 Fields detected: ${finalFields.join(", ")}`);
    console.log(`📁 Excel file saved successfully!`);
    console.log("✅ ".repeat(25));
  } else {
    console.log("\n❌ No data found. Please try:");
    console.log("   • Different search terms");
    console.log("   • Different location");
    console.log("   • Different search strategy");
  }
}

function isLocationBasedQuery(query) {
  const locationKeywords = [
    "doctor",
    "dentist",
    "lawyer",
    "restaurant",
    "cafe",
    "shop",
    "store",
    "hospital",
    "clinic",
    "salon",
    "barber",
    "mechanic",
    "garage",
    "hotel",
    "gym",
    "pharmacy",
    "bank",
    "atm",
    "gas station",
    "repair",
    "service",
    "plumber",
    "electrician",
    "contractor",
    "real estate",
    "agent",
  ];

  return locationKeywords.some((keyword) =>
    query.toLowerCase().includes(keyword.toLowerCase())
  );
}

async function dynamicSearch(browser, query, location, limit) {
  console.log(
    "🤖 AI Dynamic Search: Analyzing best sources for your query...\n"
  );

  // Determine the best search strategy based on query analysis
  const strategies = await analyzeQuery(query, location);
  console.log(
    `🎯 Selected strategies: ${strategies.map((s) => s.name).join(", ")}\n`
  );

  let allData = [];
  let allFields = new Set(["source"]); // Add source field to track where data came from

  for (const strategy of strategies) {
    if (allData.length >= limit) break;

    const remainingLimit = limit - allData.length;
    console.log(
      `🔍 Searching ${strategy.name} (targeting ${remainingLimit} records)...`
    );

    try {
      const result = await executeStrategy(
        browser,
        strategy,
        query,
        location,
        remainingLimit
      );

      // Add source information to each record
      const dataWithSource = result.data.map((item) => ({
        ...item,
        source: strategy.name,
      }));

      allData = [...allData, ...dataWithSource];
      result.fields.forEach((field) => allFields.add(field));

      console.log(
        `✅ Found ${result.data.length} records from ${strategy.name}`
      );

      if (result.data.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Rate limiting
      }
    } catch (error) {
      console.error(`❌ Error with ${strategy.name}:`, error.message);
    }
  }

  return { data: allData, fields: Array.from(allFields) };
}

async function analyzeQuery(query, location) {
  const strategies = [];
  const queryLower = query.toLowerCase();

  // Product indicators
  const productKeywords = [
    "laptop",
    "phone",
    "computer",
    "book",
    "clothes",
    "shoes",
    "watch",
    "camera",
    "tv",
    "tablet",
    "headphones",
  ];
  const isProduct =
    productKeywords.some((k) => queryLower.includes(k)) ||
    queryLower.includes("buy") ||
    queryLower.includes("price") ||
    queryLower.includes("cheap");

  // Service/location indicators
  const serviceKeywords = [
    "doctor",
    "dentist",
    "lawyer",
    "restaurant",
    "repair",
    "service",
    "clinic",
    "salon",
  ];
  const isService =
    serviceKeywords.some((k) => queryLower.includes(k)) || location;

  // E-commerce indicators
  const ecommerceKeywords = [
    "store",
    "shop",
    "market",
    "seller",
    "vendor",
    "supplier",
  ];
  const isEcommerce = ecommerceKeywords.some((k) => queryLower.includes(k));

  // Prioritize strategies based on query type
  if (isProduct) {
    strategies.push(
      { name: "Google Shopping", type: "shopping", priority: 1 },
      { name: "E-commerce Sites", type: "ecommerce", priority: 2 }
    );
  }

  if (isService && location) {
    strategies.push({ name: "Google Maps", type: "maps", priority: 1 });
  }

  if (isEcommerce || (!isProduct && !isService)) {
    strategies.push({ name: "Google Search", type: "google", priority: 3 });
  }

  // Always add general search as fallback
  if (!strategies.some((s) => s.type === "google")) {
    strategies.push({ name: "Google Search", type: "google", priority: 4 });
  }

  return strategies.sort((a, b) => a.priority - b.priority);
}

async function executeStrategy(browser, strategy, query, location, limit) {
  switch (strategy.type) {
    case "shopping":
      return await scrapeGoogleShopping(browser, query, location, limit);
    case "maps":
      return await scrapeGoogleMaps(browser, query, location, limit);
    case "google":
      return await scrapeGoogleSearch(browser, query, location, limit);
    case "ecommerce":
      return await scrapeEcommerceSites(browser, query, location, limit);
    default:
      return { data: [], fields: [] };
  }
}

async function searchAllSources(browser, query, location, limit) {
  console.log("🌐 Searching all sources...\n");

  const perSourceLimit = Math.ceil(limit / 3);
  let allData = [];
  let allFields = new Set(["source"]);

  const sources = [
    { name: "Google Maps", func: scrapeGoogleMaps },
    { name: "Google Shopping", func: scrapeGoogleShopping },
    { name: "Google Search", func: scrapeGoogleSearch },
  ];

  for (const source of sources) {
    if (allData.length >= limit) break;

    try {
      console.log(`🔍 Searching ${source.name}...`);
      const result = await source.func(
        browser,
        query,
        location,
        perSourceLimit
      );

      const dataWithSource = result.data.map((item) => ({
        ...item,
        source: source.name,
      }));

      allData = [...allData, ...dataWithSource];
      result.fields.forEach((field) => allFields.add(field));

      console.log(`✅ Found ${result.data.length} records from ${source.name}`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error with ${source.name}:`, error.message);
    }
  }

  return { data: allData.slice(0, limit), fields: Array.from(allFields) };
}

async function searchSingleSource(browser, query, location, limit, strategy) {
  console.log(`🎯 Searching ${strategy} only...\n`);

  switch (strategy) {
    case "maps":
      return await scrapeGoogleMaps(browser, query, location, limit);
    case "shopping":
      return await scrapeGoogleShopping(browser, query, location, limit);
    case "google":
      return await scrapeGoogleSearch(browser, query, location, limit);
    default:
      return { data: [], fields: [] };
  }
}

async function scrapeGoogleMaps(browser, query, location, limit) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const searchQuery = location ? `${query} in ${location}` : query;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(
    searchQuery
  )}`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
  } catch (e) {
    console.log("Maps feed not found, trying alternative approach...");
    await page.waitForSelector(".Nv2PK, .hfpxzc", { timeout: 15000 });
  }

  await scrollAndLoadResults(page, limit);
  const cards = await page.$$(".Nv2PK");

  const data = [];
  const seenNames = new Set();
  let detectedFields = new Set(["name", "location"]);

  // Sample first few items to detect fields
  const sampleSize = Math.min(3, cards.length);
  for (let i = 0; i < sampleSize; i++) {
    const sampleData = await extractBusinessData(browser, cards[i], true);
    Object.keys(sampleData).forEach((field) => {
      if (sampleData[field] && sampleData[field].trim()) {
        detectedFields.add(field);
      }
    });
  }

  detectedFields = Array.from(detectedFields);

  // Extract data from all cards
  for (let i = 0; i < Math.min(limit, cards.length); i++) {
    try {
      const businessData = await extractBusinessData(browser, cards[i], false);

      if (!businessData.name || seenNames.has(businessData.name)) {
        continue;
      }

      // Ensure location is included since it was required
      businessData.location =
        businessData.address || location || "Not specified";

      const cleanData = {};
      detectedFields.forEach((field) => {
        cleanData[field] = businessData[field] || "";
      });

      data.push(cleanData);
      seenNames.add(businessData.name);

      if (data.length >= limit) break;
    } catch (error) {
      continue;
    }
  }

  await page.close();
  return { data, fields: detectedFields };
}

async function scrapeGoogleShopping(browser, query, location, limit) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const searchQuery = location ? `${query} ${location}` : query;
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    searchQuery
  )}&tbm=shop`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  try {
    await page.waitForSelector(".sh-dgr__grid-result, .pla-unit", {
      timeout: 30000,
    });
  } catch (e) {
    await page.close();
    return { data: [], fields: [] };
  }

  const data = [];
  const seenNames = new Set();
  const detectedFields = ["name", "price", "store", "image_url", "product_url"];

  let currentPage = 1;
  const maxPages = Math.ceil(limit / 20);

  while (data.length < limit && currentPage <= maxPages) {
    const products = await page.evaluate(() => {
      const productElements = document.querySelectorAll(
        ".sh-dgr__grid-result, .pla-unit"
      );
      const results = [];

      productElements.forEach((element) => {
        try {
          const nameEl = element.querySelector(
            "h3, .sh-dgr__product-title, .plassld"
          );
          const priceEl = element.querySelector(
            ".T14wmb, .sh-dgr__price, .pla-unit-price"
          );
          const storeEl = element.querySelector(
            ".aULzUe, .sh-dgr__store-name, .pla-unit-store"
          );
          const imageEl = element.querySelector("img");
          const linkEl = element.querySelector("a");

          const product = {
            name: nameEl ? nameEl.textContent.trim() : "",
            price: priceEl ? priceEl.textContent.trim() : "",
            store: storeEl ? storeEl.textContent.trim() : "",
            image_url: imageEl ? imageEl.src : "",
            product_url: linkEl ? linkEl.href : "",
          };

          if (product.name) {
            results.push(product);
          }
        } catch (e) {}
      });

      return results;
    });

    for (const product of products) {
      if (data.length >= limit) break;

      if (!seenNames.has(product.name)) {
        data.push(product);
        seenNames.add(product.name);
      }
    }

    // Navigate to next page
    if (data.length < limit && currentPage < maxPages) {
      try {
        const nextButton = await page.$("#pnnext");
        if (nextButton) {
          await nextButton.click();
          await page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          currentPage++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }

  await page.close();
  return { data, fields: detectedFields };
}

async function scrapeGoogleSearch(browser, query, location, limit) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const searchQuery = location ? `${query} ${location}` : query;
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    searchQuery
  )}`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  const data = [];
  const detectedFields = ["title", "url", "description", "domain"];
  let currentPage = 1;
  const maxPages = Math.ceil(limit / 10);

  while (data.length < limit && currentPage <= maxPages) {
    const results = await page.evaluate(() => {
      const searchResults = [];
      const resultElements = document.querySelectorAll(".g, .tF2Cxc");

      resultElements.forEach((element) => {
        try {
          const titleEl = element.querySelector("h3");
          const linkEl = element.querySelector('a[href^="http"]');
          const descEl = element.querySelector(".VwiC3b, .s3v9rd, .IsZvec");

          if (titleEl && linkEl) {
            const url = linkEl.href;
            const domain = new URL(url).hostname;

            searchResults.push({
              title: titleEl.textContent.trim(),
              url: url,
              description: descEl ? descEl.textContent.trim() : "",
              domain: domain,
            });
          }
        } catch (e) {}
      });

      return searchResults;
    });

    data.push(...results);

    if (data.length < limit && currentPage < maxPages) {
      try {
        const nextButton = await page.$("#pnnext");
        if (nextButton) {
          await nextButton.click();
          await page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          currentPage++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }

  await page.close();
  return { data: data.slice(0, limit), fields: detectedFields };
}

async function scrapeEcommerceSites(browser, query, location, limit) {
  // This would scrape popular e-commerce sites based on location
  // For now, return empty as this would require specific site scrapers
  console.log("🛒 E-commerce scraping not yet implemented");
  return { data: [], fields: [] };
}

// Keep all the existing helper functions...
async function extractBusinessData(browser, card, isSample = false) {
  const data = {
    name: "",
    phone: "",
    website: "",
    address: "",
    rating: "",
    reviews_count: "",
    category: "",
    hours: "",
    price_level: "",
  };

  try {
    try {
      data.name = await card.$eval(".qBF1Pd", (el) => el.textContent.trim());
    } catch (e) {
      try {
        data.name = await card.$eval(".fontHeadlineSmall", (el) =>
          el.textContent.trim()
        );
      } catch (e2) {}
    }

    try {
      data.rating = await card.$eval(".MW4etd", (el) => el.textContent.trim());
    } catch (e) {}

    try {
      data.reviews_count = await card.$eval(".UY7F9", (el) =>
        el.textContent.trim()
      );
    } catch (e) {}

    try {
      data.category = await card.$eval(".W4Efsd:last-child .W4Efsd", (el) =>
        el.textContent.trim()
      );
    } catch (e) {}

    let detailUrl = "";
    try {
      detailUrl = await card.$eval("a.hfpxzc", (el) => el.href);
    } catch (e) {}

    if (detailUrl && !isSample) {
      const detailData = await extractDetailedInfo(browser, detailUrl);
      Object.assign(data, detailData);
    }
  } catch (error) {}

  return data;
}

async function extractDetailedInfo(browser, url) {
  const detailPage = await browser.newPage();
  const data = {};

  try {
    await detailPage.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Extract phone
    const phoneSelectors = [
      '[data-item-id*="phone"]',
      '[aria-label*="Phone"]',
      'button[data-item-id*="phone"]',
      ".rogA2c .Io6YTe",
    ];

    for (const selector of phoneSelectors) {
      try {
        const phoneEl = await detailPage.$(selector);
        if (phoneEl) {
          let phoneText = await detailPage.evaluate((el) => {
            return el.textContent || el.getAttribute("aria-label") || "";
          }, phoneEl);

          phoneText = phoneText.replace(/Phone:?\s*/i, "").trim();
          if (phoneText && phoneText.length > 5) {
            data.phone = phoneText;
            break;
          }
        }
      } catch (e) {}
    }

    // Extract website
    try {
      const websiteEl = await detailPage.$(
        '[data-item-id*="authority"], a[href*="http"]:not([href*="google.com"])'
      );
      if (websiteEl) {
        data.website = await detailPage.evaluate((el) => el.href, websiteEl);
      }
    } catch (e) {}

    // Extract address
    try {
      const addressEl = await detailPage.$(
        '[data-item-id*="address"], .Io6YTe[data-item-id*="address"]'
      );
      if (addressEl) {
        data.address = await detailPage.evaluate(
          (el) => el.textContent.trim(),
          addressEl
        );
      }
    } catch (e) {}
  } catch (error) {
  } finally {
    await detailPage.close();
  }

  return data;
}

async function scrollAndLoadResults(page, limit) {
  const scrollableSelector = 'div[role="feed"]';
  let previousCount = 0;
  let stableCount = 0;
  const maxScrolls = Math.ceil(limit / 10) + 5;

  for (let i = 0; i < maxScrolls; i++) {
    const currentCards = await page.$$(".Nv2PK");
    const currentCount = currentCards.length;

    if (currentCount >= limit) break;

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
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function generateExcel(data, fields, searchType, strategy) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Scraped Data");

  // Add metadata sheet
  const metaSheet = workbook.addWorksheet("Metadata");
  metaSheet.addRow(["Search Query", searchType]);
  metaSheet.addRow(["Search Strategy", strategy]);
  metaSheet.addRow(["Date", new Date().toLocaleString()]);
  metaSheet.addRow(["Total Records", data.length]);
  metaSheet.addRow(["Fields Detected", fields.join(", ")]);

  // Add headers to main sheet
  sheet.addRow(fields);

  // Style headers
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F81BD" },
  };

  // Add data rows
  data.forEach((row) => {
    const rowData = fields.map((field) => row[field] || "");
    sheet.addRow(rowData);
  });

  // Auto-fit columns
  fields.forEach((field, index) => {
    const column = sheet.getColumn(index + 1);
    let maxLength = field.length;

    data.forEach((row) => {
      const cellValue = String(row[field] || "");
      maxLength = Math.max(maxLength, cellValue.length);
    });

    column.width = Math.min(maxLength + 2, 50);
  });

  // Add borders
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const filename = `scraped_${searchType.replace(
    /\s+/g,
    "_"
  )}_${strategy}_${timestamp}.xlsx`;

  await workbook.xlsx.writeFile(filename);
  return filename;
}

main().catch(console.error);
