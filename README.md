<div align="center">

<img src="Tax Calculator/icon.png" alt="FinSource Tax Calculator" width="96" height="96">

# FinSource Tax Calculator

**Bangladesh Income Tax FY 2025-26 · NBR Compliant · Offline-First**

[![Version](https://img.shields.io/badge/version-1.0.1-10b981?style=flat-square)](https://github.com/NIROB066/FinSource-Tax-Calculator/releases/latest)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-10b981?style=flat-square&logo=github)](https://nirob066.github.io/FinSource-Tax-Calculator/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Android-6366f1?style=flat-square)](#-download)
[![NBR](https://img.shields.io/badge/NBR-Compliant-f59e0b?style=flat-square)](https://nbr.gov.bd)
[![License](https://img.shields.io/badge/license-MIT-94a3b8?style=flat-square)](LICENSE)

[🌐 **Live Web App**](https://nirob066.github.io/FinSource-Tax-Calculator/) &nbsp;·&nbsp; [📖 Docs](#-features) &nbsp;·&nbsp; [🐛 Issues](https://github.com/NIROB066/FinSource-Tax-Calculator/issues)

---

</div>

## 🌐 Web Version

**[→ Open in Browser (no download required)](https://nirob066.github.io/FinSource-Tax-Calculator/)**

Works on any device with a browser — desktop, mobile, tablet. No installation needed.

---

## ⬇ Download

| Platform | Download | Notes |
|---|---|---|
| 🪟 **Windows** | [**FinSource Tax Calc 1.0.0.exe**](https://github.com/NIROB066/FinSource-Tax-Calculator/releases/latest/download/FinSource.Tax.Calc.1.0.0.exe) | Double-click to run — no install needed |
| 🍎 **macOS** (Apple Silicon) | [**FinSource Tax Calc-1.0.0-arm64.dmg**](https://github.com/NIROB066/FinSource-Tax-Calculator/releases/latest/download/FinSource.Tax.Calc-1.0.0-arm64.dmg) | Open DMG → drag to Applications or run directly |
| 📱 **Android** | [**FinSource_Tax_Calc.apk**](https://github.com/NIROB066/FinSource-Tax-Calculator/releases/latest/download/FinSource_Tax_Calc.apk) | Enable *Install from Unknown Sources* before installing |

---

## ✨ Features

| | Feature | Detail |
|---|---|---|
| 💰 | **Smart Salary Breakdown** | Auto-splits Gross → Basic 60% · HRA 30% · Medical 6% · Conveyance 4% |
| 📅 | **Increment & Join-Date Handling** | July (pre-increment) and Aug–June (1–11 months) processed separately |
| 🏦 | **Employer TDS & PF** | Office PF contribution + exact tax the office pays on your Basic salary |
| 📊 | **Investment Rebate Visualizer** | Live bar chart — tracks 14 NBR Section 78 categories vs. max limit |
| 🎯 | **Filing Quarter Incentives** | 5% rebate for Jul–Sep filers · surcharge warnings for Jan–Jun filers |
| 🧮 | **Step-by-Step Calculation** | Full visual walkthrough: Gross Income → Taxable → Slabs → Rebate → Final |
| 🖨️ | **Print / Save as PDF** | Works on all devices via native print dialog |
| ✈️ | **Fully Offline** | No server, no login, no internet required after first load |

---

## 🧮 Tax Rules (FY 2025-26)

<details>
<summary><strong>Click to expand — NBR rules implemented</strong></summary>

### Tax-Free Thresholds

| Category | Threshold |
|---|---|
| General | ৳3,75,000 |
| Women / Senior (65+) | ৳4,25,000 |
| Person with Disability | ৳5,00,000 |
| Third Gender | ৳5,00,000 |
| War-Wounded Freedom Fighter | ৳5,25,000 |
| + Each Disabled Child | +৳50,000 |

### Progressive Tax Slabs

| Taxable Income (BDT) | Rate |
|---|---|
| First ৳3,75,000 | 0% |
| Next ৳3,00,000 | 10% |
| Next ৳4,00,000 | 15% |
| Next ৳5,00,000 | 20% |
| Next ৳20,00,000 | 25% |
| Balance | 30% |

### Investment Rebate (Section 78)

- **Rate:** 10% of admissible investment
- **Admissible** = `min(3% of taxable income, 10% of total investment, ৳7,50,000)`
- DPS annual cap: ৳1,20,000
- 14 approved investment categories supported

### Filing Quarter Adjustments

| Quarter | Effect |
|---|---|
| July – September | −5% rebate on net tax (max ৳25,000) |
| October – December | No change |
| January – March | +2% surcharge (min ৳3,000) |
| April – June | +5% surcharge (min ৳5,000) |

### Minimum Tax by Area

| Area | Minimum |
|---|---|
| Dhaka N/S & Chattogram City Corp. | ৳5,000 |
| Other City Corporations | ৳4,000 |
| Outside City Corp. | ৳3,000 |

</details>

---

## 🏗️ Development

```bash
# Clone
git clone https://github.com/NIROB066/FinSource-Tax-Calculator.git
cd "FinSource-Tax-Calculator/Tax Calculator"

# Install dependencies
npm install

# Run locally (Electron)
npm start

# Build desktop apps
npm run build:electron:mac       # macOS DMG
npm run build:electron:win       # Windows Portable
npm run build:electron:all       # Both

# Build Android (Capacitor)
npm run cap:sync                 # Sync web assets → Android project
npm run cap:open:android         # Open in Android Studio → build APK there
```

### Project Structure

```
Tax Calculator/
├── index.html          # Main app UI
├── calculator.js       # All tax calculation logic
├── styles.css          # Dark-theme stylesheet
├── main.js             # Electron entry point
├── sw.js               # Service worker (offline PWA)
├── www/                # Capacitor web assets (auto-synced)
├── android/            # Capacitor Android project
└── dist/               # Electron build output
```

---

## 📋 Changelog

### v1.0.1
- Added **Aug–June month picker** (1–11, default 11) for employees who join mid-year
- Added **bonus count selector** for Festival and Performance bonuses (0–2, default 2)
- Fixed **Print / PDF** — now works on all devices including mobile using native print dialog

### v1.0.0
- Initial release

---

## ⚠️ Disclaimer

This calculator is for **reference purposes only**. For official income tax filing, consult a registered tax advisor or visit:

- 🌐 [etaxnbr.gov.bd](https://etaxnbr.gov.bd) — Official e-Return portal
- 🌐 [nbr.gov.bd](https://nbr.gov.bd) — National Board of Revenue
- ☎️ NBR Helpline: **09643717171**

---

<div align="center">

Developed by **Mohammad Rifat Anwar**  
Based on NBR Income Tax Act 2023 & Finance Act 2025

</div>
