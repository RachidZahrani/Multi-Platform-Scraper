const { input, select } = require("@inquirer/prompts");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");
const fs = require("fs");

async function main() {
  const dataType = await select({
    message: "Select the type of data to scrape:",
    choices: [
      { name: "people", value: "people" },
      { name: "places", value: "places" },
      { name: "products", value: "products" },
    ],
  });

  const specificType = await input({
    message: "Enter the specific type (e.g., doctor, computer):",
    validate: (input) => (input ? true : "Specific type is required."),
  });

  const country = await input({
    message: "Enter the country (e.g., Morocco):",
    validate: (input) => (input ? true : "Country is required."),
  });

  const city = await input({
    message: "Enter the city (e.g., Casablanca):",
  });

  const limitOption = await select({
    message: "Select the number of records:",
    choices: [
      { name: "10", value: "10" },
      { name: "30", value: "30" },
      { name: "50", value: "50" },
      { name: "100", value: "100" },
      { name: "200", value: "200" },
      { name: "1000", value: "1000" },
      { name: "custom", value: "custom" },
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

  const answers = {
    dataType,
    specificType,
    country,
    city,
    limitOption,
    customLimit,
  };

  const limit =
    answers.limitOption === "custom"
      ? parseInt(answers.customLimit)
      : parseInt(answers.limitOption);
  const area = answers.city
    ? `${answers.city}, ${answers.country}`
    : answers.country;
  const query = `${answers.specificType} in ${area}`;

  console.log(`Scraping for: ${query} (limit: ${limit})`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  let data;
  try {
    if (answers.dataType === "products") {
      const url = `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}&tbm=shop`;
      await page.goto(url, { waitUntil: "networkidle2" });
      data = await scrapeShopping(page, limit, browser);
    } else {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(
        query
      )}`;
      await page.goto(url, { waitUntil: "networkidle2" });
      data = await scrapeMaps(page, limit, browser, answers.dataType);
    }
  } catch (error) {
    console.error("Error during scraping:", error);
    data = [];
  } finally {
    await browser.close();
  }

  await generateExcel(data, answers.dataType);
  console.log("Scraping complete. Excel file saved as scraped_data.xlsx");
}
async function scrapeMaps(page, limit, browser, dataType) {
  await page
    .waitForSelector('div[role="feed"]', { timeout: 30000 })
    .catch(() => {});

  const scrollableSelector = 'div[role="feed"]';
  let currentLength = 0;
  const maxScrolls = Math.ceil(limit / 20) + 5; // Estimate, as ~20 per load
  for (let i = 0; i < maxScrolls; i++) {
    const cards = await page.$$("div.Nv2PK");
    currentLength = cards.length;
    if (currentLength >= limit) break;
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollTop = el.scrollHeight;
    }, scrollableSelector);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const cards = await page.$$("div.Nv2PK");
  const data = [];

  for (let i = 0; i < Math.min(limit, cards.length); i++) {
    const card = cards[i];
    let name = "";
    let detailUrl = "";
    try {
      name = await card.$eval(".qBF1Pd", (el) => el.textContent.trim());
      detailUrl = await card.$eval("a.hfpxzc", (el) => el.href);
    } catch {}

    if (!detailUrl) continue;

    const detailPage = await browser.newPage();
    await detailPage.goto(detailUrl, { waitUntil: "networkidle2" });

    let phone = "";
    let location = "";
    try {
      phone =
        (await detailPage.$eval('a[href^="tel:"]', (el) =>
          el.textContent.trim()
        )) || "";
    } catch {}
    try {
      location =
        (await detailPage.$eval(
          'button[data-tooltip="Copy address"] .Io6YTe',
          (el) => el.textContent.trim()
        )) || "";
    } catch {}

    data.push({ name, phone, location });

    await detailPage.close();
  }

  return data;
}

async function scrapeShopping(page, limit, browser) {
  await page
    .waitForSelector("div.sh-dgr__grid-result", { timeout: 30000 })
    .catch(() => {});

  const data = [];
  while (data.length < limit) {
    const titles = await page.$$eval("div.sh-dgr__grid-result h4", (els) =>
      els.map((el) => el.textContent.trim())
    );
    const prices = await page.$$eval(
      "div.sh-dgr__grid-result a span span span",
      (els) => els.map((el) => el.textContent.trim())
    );
    const images = await page.$$eval("div.sh-dgr__grid-result img", (els) =>
      els.map((el) => el.src)
    );

    const pageLength = Math.min(titles.length, prices.length, images.length);
    for (let j = 0; j < pageLength; j++) {
      if (data.length >= limit) break;
      data.push({
        name: titles[j] || "",
        price: prices[j] || "",
        image: images[j] || "",
      });
    }

    const nextButton = await page.$("#pnnext");
    if (!nextButton) break;
    await nextButton.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return data.slice(0, limit);
}

async function generateExcel(data, dataType) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Scraped Data");

  let columns;
  if (dataType === "products") {
    columns = ["name", "price", "image"];
  } else {
    columns = ["name", "phone", "location"];
  }
  sheet.addRow(columns);

  data.forEach((row) => {
    sheet.addRow([
      row.name,
      dataType === "products" ? row.price : row.phone,
      dataType === "products" ? row.image : row.location,
    ]);
  });

  await workbook.xlsx.writeFile("scraped_data.xlsx");
}

main().catch(console.error);
