const express = require("express");
const cors = require("cors");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const moment = require("moment");
const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.static(path.join(__dirname, "public")));

function extractDate(url) {
  const parseURL = new URL(url);
  const date = parseURL.searchParams.get("date");
  return date;
}

async function captureScreenshot(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    timeout: 60000,
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 630 });

    await page.goto(url, { waitUntil: "load", timeout: 60000 });

    // Replaced waitForTimeout with manual Promise-based delay
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for dynamic content

    const element = await page.waitForSelector("#screenshot", {
      visible: true,
      timeout: 5000,
    });

    const date = extractDate(url); // assuming this function exists
    const screenshotPath = path.join(__dirname, "public/images", `${date}.png`);

    if (element) {
      await element.screenshot({ path: screenshotPath });
    } else {
      await page.screenshot({ path: screenshotPath });
    }

    await browser.close();
    return screenshotPath;
  } catch (err) {
    console.error("Error during screenshot capture:", err);
    await browser.close();
    throw new Error("Error capturing screenshot");
  }
}
app.get("/", (req, res) => {
  res.send("VIKO EIF Timetable app preview manager!");
});
// Route to handle the preview_image request
app.get("/preview/:date", async (req, res) => {
  const { date } = req.params;

  const html = `
 <!DOCTYPE html>
    <html>
    <head>
      <meta property="og:title" content="Lecture Schedule for ${moment(date)
        .format("ddd MMM DD YYYY")
        .toString()}" />
      <meta property="og:description" content="VIKO EIF Timetable" />
      <meta property="og:image" content="https://vikoeif.imranhasan.dev/images/${date.toString()}.png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content="https://viko-eif.imranhasan.dev/preview/${date.toString()}" />
      <meta property="og:type" content="article" />
      <title>VIKO EIF Timetable-${date.toString()}</title>
    </head>
    <body>
      <p>Redirecting...</p>
      <script>
        window.location.href = "https://viko-eif.imranhasan.dev/?date=${date}";
      </script>
    </body>
    </html>`;
  res.send(html);
});

function getFullImageURL(req, date) {
  return `${req.protocol}://${req.get("host")}/images/${date}.png`;
}

app.get("/generate_og_image", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL is required");
  }
  const date = extractDate(url);

  const imagePath = path.join(__dirname, "public/images", `${date}.png`);

  if (fs.existsSync(imagePath)) {
    console.log("Servering from existing image");
    const image = getFullImageURL(req, date);
    return res.json({ image });
  }

  try {
    // Capture the screenshot of the page at the URL and save it to the public/images directory
    const imagePath = await captureScreenshot(url);
    const date = extractDate(url);
    // Send the relative path of the saved image to the frontend
    const image = getFullImageURL(req, date);
    console.log("generating");
    res.json({ image });
  } catch (err) {
    console.error("Error capturing screenshot:", err);
    res.status(500).send("Error capturing screenshot");
  }
});

app.get("/ice/delete-all", (req, res) => {
  fs.readdir(path.join(__dirname, "public/images"), (err, files) => {
    if (err)
      return res.status(500).send({ error: "Unable to read directory." });

    files.forEach((file) => {
      const filePath = path.join(__dirname, "public/images", file);
      fs.unlinkSync(filePath);
    });
    return res.json({ message: "All image deleted successfully" });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
