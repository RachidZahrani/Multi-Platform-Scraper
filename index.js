const { input, select, confirm } = require("@inquirer/prompts");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const fs = require("fs");

async function main() {
  // More flexible data type selection
  let dataType = await select({
    message: "Select the type of data to scrape:",
    choices: [
      { name: "People/Services (Google Maps)", value: "maps" },
      { name: "Products (Google Shopping)", value: "products" },
      { name: "Custom Search", value: "custom" },
    ],
  });

  let specificType;
  if (dataType === "custom") {
    specificType = await input({
      message: "Enter your custom search query:",
      validate: (input) => (input ? true : "Search query is required."),
    });
    // Determine if it's more like maps or products based on keywords
    const productKeywords = ["buy", "price", "shop", "store", "product"];
    const isProduct = productKeywords.some((keyword) =>
      specificType.toLowerCase().includes(keyword)
    );
    dataType = isProduct ? "products" : "maps";
  } else {
    specificType = await input({
      message: `Enter the specific type (e.g., ${
        dataType === "maps"
          ? "doctor, restaurant, lawyer"
          : "laptop, shoes, books"
      })`,
      validate: (input) => (input ? true : "Specific type is required."),
    });
  }

  const country = await input({
    message: "Enter the country (e.g., Morocco):",
    validate: (input) => (input ? true : "Country is required."),
  });

  const city = await input({
    message: "Enter the city (optional):",
  });

  const limitOption = await select({
    message: "Select the number of records:",
    choices: [
      { name: "10", value: "10" },
      { name: "30", value: "30" },
      { name: "50", value: "50" },
      { name: "100", value: "100" },
      { name: "200", value: "200" },
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
  const area = city ? `${city}, ${country}` : country;
  const query = `${specificType} in ${area}`;

  console.log(`Scraping for: ${query} (limit: ${limit})`);
  console.log("Starting browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let data = [];
  let detectedFields = [];

  try {
    if (dataType === "products") {
      const result = await scrapeProducts(browser, query, limit);
      data = result.data;
      detectedFields = result.fields;
    } else {
      const result = await scrapeMaps(browser, query, limit);
      data = result.data;
      detectedFields = result.fields;
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  if (data.length > 0) {
    await generateExcel(data, detectedFields, specificType);
    console.log(`\nScraping complete! Found ${data.length} records.`);
    console.log(`Fields detected: ${detectedFields.join(", ")}`);
    console.log("Excel file saved as scraped_data.xlsx");
  } else {
    console.log("No data found. Please try a different search query.");
  }
}

async function scrapeMaps(browser, query, limit) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for results to load
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 30000 });
  } catch (e) {
    console.log("Feed not found, trying alternative selectors...");
    await page.waitForSelector(".Nv2PK, .hfpxzc", { timeout: 15000 });
  }

  // Scroll to load more results
  console.log("Loading results...");
  await scrollAndLoadResults(page, limit);

  // Get all business cards
  const cards = await page.$$(".Nv2PK");
  console.log(`Found ${cards.length} business listings`);

  const data = [];
  const seenNames = new Set();
  let detectedFields = new Set(["name"]); // Always have name

  // Sample first few items to detect available fields
  console.log("Analyzing available data fields...");
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
  console.log(`Detected fields: ${detectedFields.join(", ")}`);

  // Extract data from all cards
  for (let i = 0; i < Math.min(limit, cards.length); i++) {
    try {
      const businessData = await extractBusinessData(browser, cards[i], false);

      if (!businessData.name || seenNames.has(businessData.name)) {
        continue;
      }

      // Create clean data object with only detected fields
      const cleanData = {};
      detectedFields.forEach((field) => {
        cleanData[field] = businessData[field] || "";
      });

      data.push(cleanData);
      seenNames.add(businessData.name);

      console.log(`Scraped ${data.length}/${limit}: ${businessData.name}`);

      if (data.length >= limit) break;
    } catch (error) {
      console.error(`Error extracting data for item ${i}:`, error.message);
      continue;
    }
  }

  await page.close();
  return { data, fields: detectedFields };
}

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
    // Extract basic info from card
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

    // Get detail URL and extract more info
    let detailUrl = "";
    try {
      detailUrl = await card.$eval("a.hfpxzc", (el) => el.href);
    } catch (e) {}

    if (detailUrl && !isSample) {
      const detailData = await extractDetailedInfo(browser, detailUrl);
      Object.assign(data, detailData);
    }
  } catch (error) {
    console.error("Error extracting basic business data:", error.message);
  }

  return data;
}

async function extractDetailedInfo(browser, url) {
  const detailPage = await browser.newPage();
  const data = {};

  try {
    await detailPage.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Extract phone
    try {
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
    } catch (e) {}

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

    // Extract hours
    try {
      const hoursEl = await detailPage.$(".t39EBf .G8aQO, .OqCZI .G8aQO");
      if (hoursEl) {
        data.hours = await detailPage.evaluate(
          (el) => el.textContent.trim(),
          hoursEl
        );
      }
    } catch (e) {}
  } catch (error) {
    console.error("Error extracting detailed info:", error.message);
  } finally {
    await detailPage.close();
  }

  return data;
}

async function scrapeProducts(browser, query, limit) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const url = `https://www.google.com/search?q=${encodeURIComponent(
    query
  )}&tbm=shop`;
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for products to load
  try {
    await page.waitForSelector(".sh-dgr__grid-result, .pla-unit", {
      timeout: 30000,
    });
  } catch (e) {
    console.log("Product grid not found");
    await page.close();
    return { data: [], fields: [] };
  }

  const data = [];
  const seenNames = new Set();
  const detectedFields = ["name", "price", "store", "image_url", "product_url"];

  let currentPage = 1;
  const maxPages = Math.ceil(limit / 20);

  while (data.length < limit && currentPage <= maxPages) {
    console.log(`Scraping page ${currentPage}...`);

    // Extract products from current page
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
        } catch (e) {
          console.error("Error extracting product:", e);
        }
      });

      return results;
    });

    // Add unique products
    for (const product of products) {
      if (data.length >= limit) break;

      if (!seenNames.has(product.name)) {
        data.push(product);
        seenNames.add(product.name);
        console.log(`Scraped ${data.length}/${limit}: ${product.name}`);
      }
    }

    // Try to navigate to next page
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
          console.log("No more pages available");
          break;
        }
      } catch (e) {
        console.log("Could not navigate to next page");
        break;
      }
    } else {
      break;
    }
  }

  await page.close();
  return { data, fields: detectedFields };
}

async function scrollAndLoadResults(page, limit) {
  const scrollableSelector = 'div[role="feed"]';
  let previousCount = 0;
  let stableCount = 0;
  const maxScrolls = Math.ceil(limit / 10) + 5;

  for (let i = 0; i < maxScrolls; i++) {
    // Count current results
    const currentCards = await page.$$(".Nv2PK");
    const currentCount = currentCards.length;

    console.log(`Scroll ${i + 1}: Found ${currentCount} items`);

    if (currentCount >= limit) {
      console.log(`Reached desired limit of ${limit} items`);
      break;
    }

    // Check if we're getting new results
    if (currentCount === previousCount) {
      stableCount++;
      if (stableCount >= 3) {
        console.log("No new results loading, stopping scroll");
        break;
      }
    } else {
      stableCount = 0;
    }

    previousCount = currentCount;

    // Scroll down
    try {
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      }, scrollableSelector);
    } catch (e) {
      // Try alternative scroll method
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    // Wait for new content to load
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function generateExcel(data, fields, searchType) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Scraped Data");

  // Add headers
  sheet.addRow(fields);

  // Style headers
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
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

  // Add metadata
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `scraped_data_${searchType.replace(
    /\s+/g,
    "_"
  )}_${timestamp}.xlsx`;

  await workbook.xlsx.writeFile(filename);
  console.log(`Excel file saved as: ${filename}`);
}

main().catch(console.error);
