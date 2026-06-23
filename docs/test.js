const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync("/Users/md.rifatanwarnirob/Library/CloudStorage/GoogleDrive-netflixrifat55@gmail.com/My Drive/Private (X)/FIVERR_DEV/Fiverr/Tax Calculator/index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;
const scriptContent = fs.readFileSync("/Users/md.rifatanwarnirob/Library/CloudStorage/GoogleDrive-netflixrifat55@gmail.com/My Drive/Private (X)/FIVERR_DEV/Fiverr/Tax Calculator/calculator.js", "utf8");
try {
    window.eval(scriptContent);
    // document.DOMContentLoaded event is already passed, let's call calculate directly
    window.calculate();
    console.log("Success");
} catch (e) {
    console.error("Error:", e);
}
