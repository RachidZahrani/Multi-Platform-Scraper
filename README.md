 # 🚀 Professional Multi-Platform Web Scraper

A powerful Node.js web scraper designed to extract professional and business information from multiple online platforms. This tool aggregates data from various sources including Google Maps, LinkedIn, professional directories, and more, providing comprehensive business intelligence in clean, exportable formats.

## ✨ Features

- **🌐 Multi-Platform Search**: Comprehensive data collection from Google Maps, LinkedIn, professional directories, Yellow Pages, Facebook, and specialized medical directories
- **🎯 Intelligent Search Depth**: Configurable search intensity levels from quick map-only scrapes to deep multi-source investigations
- **🔍 Smart Deduplication**: Advanced filtering system that automatically removes duplicate entries based on name and profile URL combinations
- **📊 Multiple Export Formats**: Export your data as Excel (.xlsx) files with detailed summaries or structured JSON files
- **📈 Real-time Progress Tracking**: Visual progress bars and live updates during scraping operations
- **🗺️ Geographic Data**: Automatic extraction of coordinates and location details for mapping and analysis
- **📋 Comprehensive Reporting**: Detailed search summaries including platform breakdowns and field analysis

## 🛠️ Technical Stack

- **Runtime**: Node.js
- **Web Automation**: Puppeteer
- **Data Export**: ExcelJS for spreadsheet generation
- **User Interface**: Inquirer.js for interactive CLI prompts
- **Progress Visualization**: CLI-Progress for real-time feedback

## 💻 Installation

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Setup

1. **Clone the repository**:
```bash
git clone https://github.com/RachidZahrani/Multi-Platform-Scraper.git
cd Multi-Platform-Scraper
A powerful Node.js web scraper designed to extract professional and business information from multiple online platforms. This tool aggregates data from various sources including Google Maps, LinkedIn, professional directories, and more, providing comprehensive business intelligence in clean, exportable formats.

## ✨ Features

- **🌐 Multi-Platform Search**: Comprehensive data collection from Google Maps, LinkedIn, professional directories, Yellow Pages, Facebook, and specialized medical directories
- **🎯 Intelligent Search Depth**: Configurable search intensity levels from quick map-only scrapes to deep multi-source investigations
- **🔍 Smart Deduplication**: Advanced filtering system that automatically removes duplicate entries based on name and profile URL combinations
- **📊 Multiple Export Formats**: Export your data as Excel (.xlsx) files with detailed summaries or structured JSON files
- **📈 Real-time Progress Tracking**: Visual progress bars and live updates during scraping operations
- **🗺️ Geographic Data**: Automatic extraction of coordinates and location details for mapping and analysis
- **📋 Comprehensive Reporting**: Detailed search summaries including platform breakdowns and field analysis

## 💻 Installation

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Setup

1. **Clone the repository**:
```bash
git clone https://github.com/RachidZahrani/Multi-Platform-Scraper.git
cd Multi-Platform-Scraper
cd Multi-Platform-Scraper
Install all dependencies:

Bash

npm install @inquirer/prompts puppeteer exceljs cli-progress
Start the scraper:

Bash

npm start


🚀 How to Use
Simply run the command and follow the interactive prompts:

Search Query: The profession or service you are looking for.

Location: The country and city for your search.

Search Depth: Choose a search level, from Only Google Maps to Ultra Professional.

Record Limit: Set the number of records you want to find.

Output Format: Select either Excel or JSON.

Once finished, your output file will be saved in the project folder.