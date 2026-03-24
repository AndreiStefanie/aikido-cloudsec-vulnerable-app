const express = require("express");

const app = express();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const APP_TITLE = process.env.APP_TITLE || "Lifecycle Lookup";
const APP_SUBTITLE =
  process.env.APP_SUBTITLE ||
  "Check end-of-life and release cadence data for common technologies before approving upgrades.";
const WORKSHOP_HINT =
  process.env.WORKSHOP_HINT ||
  "The team usually starts with built-in feeds, but the fetcher also accepts a custom JSON source when vendor data lives elsewhere.";

const DEFAULT_FEEDS = [
  { id: "python", label: "Python", url: "https://endoflife.date/api/python.json" },
  { id: "nodejs", label: "Node.js", url: "https://endoflife.date/api/nodejs.json" },
  { id: "ubuntu", label: "Ubuntu", url: "https://endoflife.date/api/ubuntu.json" },
  { id: "kubernetes", label: "Kubernetes", url: "https://endoflife.date/api/kubernetes.json" },
];

app.use("/static", express.static("public"));

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage(initialUrl = "") {
  const safeInitialUrl = escapeHtml(initialUrl);
  const feedCards = DEFAULT_FEEDS.map(
    (feed) => `<button class="feed-chip" type="button" data-url="${escapeHtml(feed.url)}">${escapeHtml(feed.label)}</button>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(APP_TITLE)}</title>
    <link rel="stylesheet" href="/static/styles.css" />
  </head>
  <body>
    <main class="page-shell">
      <section class="hero-card">
        <p class="eyebrow">Lifecycle Intelligence</p>
        <h1>${escapeHtml(APP_TITLE)}</h1>
        <p class="subtitle">${escapeHtml(APP_SUBTITLE)}</p>
        <div class="feed-group">
          <p class="feed-label">Common feeds</p>
          <div class="feed-list">
            ${feedCards}
          </div>
        </div>
        <button id="toggle-custom-source" class="secondary-button" type="button" aria-expanded="false">
          Use custom source
        </button>
        <form id="preview-form" class="preview-form">
          <div id="custom-source-panel" class="custom-source-panel" hidden>
            <label for="url">Custom source URL</label>
            <div class="row">
              <input
                id="url"
                name="url"
                type="text"
                inputmode="url"
                spellcheck="false"
                placeholder="https://endoflife.date/api/python.json"
                value="${safeInitialUrl || escapeHtml(DEFAULT_FEEDS[0].url)}"
                required
              />
              <button type="submit">Fetch Data</button>
            </div>
          </div>
        </form>
        <p class="hint">${escapeHtml(WORKSHOP_HINT)}</p>
      </section>

      <section class="result-card">
        <div class="result-header">
          <h2>Response</h2>
          <p>Server-side lifecycle feed output appears here.</p>
        </div>
        <pre id="output">Loading default technology lifecycle data...</pre>
      </section>
    </main>

    <script>
      const form = document.getElementById("preview-form");
      const output = document.getElementById("output");
      const urlInput = document.getElementById("url");
      const feedButtons = Array.from(document.querySelectorAll("[data-url]"));
      const toggleButton = document.getElementById("toggle-custom-source");
      const customSourcePanel = document.getElementById("custom-source-panel");

      async function fetchFeed(url) {
        output.textContent = "Fetching...";

        try {
          const response = await fetch("/fetch?url=" + encodeURIComponent(url));
          const payload = await response.json();
          output.textContent = JSON.stringify(payload, null, 2);
        } catch (error) {
          output.textContent = JSON.stringify({ error: error.message }, null, 2);
        }
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await fetchFeed(urlInput.value);
      });

      feedButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const url = button.dataset.url;
          urlInput.value = url;
          await fetchFeed(url);
        });
      });

      toggleButton.addEventListener("click", () => {
        const isHidden = customSourcePanel.hasAttribute("hidden");
        customSourcePanel.toggleAttribute("hidden");
        toggleButton.setAttribute("aria-expanded", String(isHidden));
        toggleButton.textContent = isHidden ? "Hide custom source" : "Use custom source";

        if (isHidden) {
          urlInput.focus();
          urlInput.select();
        }
      });

      fetchFeed(urlInput.value);
    </script>
  </body>
</html>`;
}

app.get("/", (req, res) => {
  res.type("html").send(renderPage(req.query.url || ""));
});

app.get("/fetch", async (req, res) => {
  const target = req.query.url;

  if (!target || typeof target !== "string") {
    res.status(400).json({ error: "Missing url query parameter." });
    return;
  }

  try {
    const upstream = await fetch(target);
    const body = await upstream.text();
    const headers = {};

    upstream.headers.forEach((value, key) => {
      headers[key] = value;
    });

    res.status(200).json({
      requestedUrl: target,
      finalUrl: upstream.url,
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
      body,
    });
  } catch (error) {
    res.status(502).json({
      requestedUrl: target,
      error: error.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Preview service listening on port ${PORT}`);
});
