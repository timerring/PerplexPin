# PerplexPin

Pin your preferred AI model on [Perplexity.ai](https://www.perplexity.ai) in [Comet](https://www.perplexity.ai/comet) — never get reset again.

## What It Does

Perplexity.ai tends to reset your selected AI model (e.g., Claude, GPT, Grok) back to a default after page reloads or navigations. **PerplexPin** locks in your chosen model so it stays pinned across page loads, even in the sidebar (Sidecar) assistant.

### How It Works

1. Click the extension icon → **Copy Script**
2. Open Perplexity.ai → press **F12** → Console tab
3. Paste & run — a model picker appears
4. Select your model (with optional Thinking mode toggle)
5. Done — the guard persists across page loads

To **switch models** later, just paste the script again. The picker always appears.

### Under the Hood

- Injects a guard script into Perplexity's **Service Worker cache** (`pplx-html-v2`)
- The guard runs at `<head>` on every page load, before any Perplexity JS
- Monkey-patches `localStorage.setItem` to block model drift
- Polls every 3s as a safety net to correct any drift that slips through
- Self-healing: periodically re-injects itself into the SW cache if Perplexity updates it
- Sidecar (sidebar assistant): auto-selects the pinned model via DOM manipulation every 10s

## Approaches Tried & Why They Didn't Work

This extension is built for the [Comet browser](https://www.perplexity.ai/comet), which enforces a strict `runtime_blocked_hosts` policy that blocks **all** extension access to `perplexity.ai` pages. Here's what was tried before arriving at the current solution:

### 1. Content Scripts (Manifest & Dynamic)

**Approach:** Declare a content script in `manifest.json` targeting `perplexity.ai`, or inject dynamically via `chrome.scripting.executeScript`.

**Why it failed:** Comet's `ExtensionsSettings` policy adds `perplexity.ai` to `runtime_blocked_hosts`, which completely prevents content scripts from running on that domain — both manifest-declared and dynamically injected.

### 2. `chrome.scripting.executeScript` with `activeTab`

**Approach:** Use the `activeTab` permission to inject script when the user clicks the extension icon.

**Why it failed:** Same `runtime_blocked_hosts` restriction. Even with `activeTab` granted, the API call throws an error because the host is blocked at the policy level.

### 3. DevTools Extension (`chrome.devtools.inspectedWindow.eval`)

**Approach:** Create a `devtools_page` that uses `chrome.devtools.inspectedWindow.eval()` to inject the guard script into the page context. This API typically bypasses content script restrictions.

**Why it failed:** Comet also blocks `devtools_page` from loading on blocked hosts. The DevTools panel never appeared for `perplexity.ai` tabs.

### 4. `chrome.debugger` API

**Approach:** Attach the Chrome Debugger Protocol to the tab and execute script via `Runtime.evaluate`.

**Why it failed:** `chrome.debugger` is also blocked by the same `runtime_blocked_hosts` policy.

### 5. `declarativeNetRequest` Redirect

**Approach:** Use `declarativeNetRequest` to redirect Perplexity's HTML response through a modified version that includes the guard script.

**Why it failed:** Requires `host_permissions` for `perplexity.ai`, which are stripped by the policy.

## Why the Console Paste Approach Works

The DevTools Console is a **browser-native** feature, not an extension API. Comet's extension restrictions don't apply to code the user manually executes in the console. Once pasted:

1. The script injects the guard into Perplexity's SW cache — a **browser-native storage** mechanism
2. On subsequent page loads, the browser itself serves the cached HTML (with our guard) before any extension restrictions apply
3. The guard runs as first-party JavaScript, indistinguishable from Perplexity's own code

This makes the solution **persistent** (survives page reloads) and **unblockable** (uses no extension APIs at runtime).

## Build

```bash
pnpm install
pnpm run build
```

Output goes to `dist/`. Load it as an unpacked extension.

## Tech Stack

- **Vite** — build tool
- **TypeScript** — popup UI
- **Vanilla JS** — guard script (must be self-contained, no bundler dependencies)
