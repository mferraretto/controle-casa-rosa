# Controle Pedidos Casa Rosa

This repository contains the static files of the **Controle Pedidos Casa Rosa** web application. The project is a simple Progressive Web App (PWA) built to manage Casa Rosa orders.

## Prerequisites

To run the application locally you only need a web browser and a way to serve the files over HTTP. Common options include:

- Python 3
- Node.js with `http-server` (or any similar tool)

Service workers require the files to be served via `http://` or `https://`; opening `index.html` directly from the filesystem will not register the service worker.

## Setup

1. Clone this repository or download its contents.
2. Open a terminal in the project directory and run a simple HTTP server. Examples:

   **Using Python** (available by default on most systems):
   ```bash
   python3 -m http.server 8000
   ```
   Then access `http://localhost:8000` in your browser.

   **Using Node.js**:
   ```bash
   npx http-server -p 8000
   ```
   Then visit `http://localhost:8000`.

3. Once the page is loaded, the service worker defined in `service-worker.js` will attempt to register automatically (see code around line 920 of `index.html`). When registered successfully, you should see a message in the browser console: `✅ Service Worker registrado com sucesso`.

## Registering the Service Worker

The service worker registration is handled in `index.html`:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(() => {
      console.log("✅ Service Worker registrado com sucesso");
    });
  }
</script>
```

As long as the page is served over HTTP(s), simply loading `index.html` will register the service worker and cache the application files (see `service-worker.js`).

## Troubleshooting

- **Service worker not registering?** Ensure you are accessing the site via `http://` or `https://` (not `file://`).
- **Cache not updating?** Try clearing the browser cache or unregistering the service worker via your browser's developer tools.
- **Blocked network requests?** Some features fetch resources from CDNs (e.g., Firebase, Font Awesome). Make sure your network allows these domains if you see console errors.

Enjoy managing your orders with Casa Rosa!
