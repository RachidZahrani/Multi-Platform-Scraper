🚀 Professional Multi-Platform Web Scraper

This is a powerful and versatile web scraping tool built with Node.js, Puppeteer, and ExcelJS. It's designed to go beyond basic scraping by intelligently searching across multiple platforms like Google Maps, LinkedIn, and local business directories to find comprehensive information for a specific profession or service in a given location.



✨ Features

  - Multi-Platform Search: Scrapes data from various sources to ensure maximum coverage.
  - Configurable Search Depth: Choose between "Quick," "Comprehensive," "Deep," and "Ultra Professional" search modes to control the intensity of the scrape.
  - Intelligent Data Extraction: Dynamically extracts key information such as names, profile URLs, and contact details from diverse websites.
  - Duplicate Detection: Ensures that you get a list of unique records, eliminating redundant data.
  - Professional Excel Output: Generates a clean, well-formatted Excel file with all the scraped data and a summary of the search.



📦 Prerequisites

Before you begin, make sure you have the following installed:

  - Node.js: [Download and Install Node.js](https://nodejs.org/) (which includes npm).



💻 Installation

1.  Clone the repository to your local machine:
    bash
    git clone https://github.com/RachidZahrani/Multi-Platform-Scraper.git
    cd Multi-Platform-Scraper
2.  Install the necessary packages:
    bash
    npm install



🚀 How to Use

Simply run the script from your terminal and follow the interactive prompts.

1.  Start the scraper:

    bash
    node index.js

2.  Answer the prompts:

      - Search Query: Enter the profession or service you're looking for (e.g., `médecin`, `avocat`).
      - Country & City: Provide the location to narrow down the search.
      - Search Intensity: Select the desired level of depth for your scrape. The "Ultra Professional" option will search the most sources.
      - Record Limit: Set the maximum number of records you want to find.

3.  Wait for the magic\! The script will begin scraping and show its progress in the console.

4.  Find your data: Once the scraping is complete, a new Excel file named `scraped[profession][city][strategy][timestamp].xlsx` will be generated in your project folder.



📂 File Structure

The generated Excel file contains two sheets:

  - `Professional Directory`: The main sheet with all the scraped data, including names, profile URLs, contact info (if found), and the source platform.
  - `Search Summary`: A summary of your search parameters, including the total number of records found and a breakdown of records by platform.



💡 Contributions

Got an idea to make this tool even better? Contributions are welcome\! Feel free to open a pull request or submit an issue on the GitHub repository.