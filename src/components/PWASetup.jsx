import { useEffect } from 'react';

export default function PWASetup() {
  useEffect(() => {
    // Base icon URL
    const baseIconUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/render/image/public/base44-prod/public/68f57bc793cdb2e8cacf36e4/75103db94_logo.png";
    
    // Create manifest dynamically
    const manifest = {
      id: "/?source=pwa",
      name: "Globeskimmers",
      short_name: "Globeskimmers",
      description: "Your ultimate travel companion. Discover personalized adventures, manage expenses in your preferred currencies, and explore the world with confidence. Seamlessly integrated with your location for curated experiences.",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#4A90A4",
      orientation: "any",
      lang: "en",
      dir: "ltr",
      scope: "/",
      icons: [
        {
          src: `${baseIconUrl}?width=48&height=48`,
          sizes: "48x48",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `${baseIconUrl}?width=72&height=72`,
          sizes: "72x72",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `${baseIconUrl}?width=96&height=96`,
          sizes: "96x96",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `${baseIconUrl}?width=144&height=144`,
          sizes: "144x144",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `${baseIconUrl}?width=180&height=180`,
          sizes: "180x180",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `${baseIconUrl}?width=192&height=192`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: `${baseIconUrl}?width=512&height=512`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ],
      categories: ["travel", "lifestyle", "utilities"],
      screenshots: [
        {
          src: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f57bc793cdb2e8cacf36e4/45f765c31_Image10-28-25at833PM.jpg",
          sizes: "809x1490",
          type: "image/jpeg",
          form_factor: "narrow",
          label: "Home screen with personalized travel tools and weather"
        },
        {
          src: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f57bc793cdb2e8cacf36e4/637082bec_Image10-28-25at834PM.jpg",
          sizes: "816x1490",
          type: "image/jpeg",
          form_factor: "narrow",
          label: "Currency exchange with nearby locations"
        },
        {
          src: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f57bc793cdb2e8cacf36e4/d018c45ff_Image10-28-25at847PM.jpg",
          sizes: "805x1455",
          type: "image/jpeg",
          form_factor: "narrow",
          label: "Discover convenience stores, gas stations, and pharmacies"
        }
      ],
      shortcuts: [
        {
          name: "Currency Exchange",
          short_name: "Exchange",
          description: "Find money exchange locations",
          url: "/MoneyExchange",
          icons: [{ src: `${baseIconUrl}?width=96&height=96`, sizes: "96x96" }]
        },
        {
          name: "Price Scanner",
          short_name: "Scanner",
          description: "Scan and convert prices",
          url: "/SmartPriceScanner",
          icons: [{ src: `${baseIconUrl}?width=96&height=96`, sizes: "96x96" }]
        },
        {
          name: "Convenience Stores",
          short_name: "Stores",
          description: "Find nearby stores",
          url: "/ConvenienceStore",
          icons: [{ src: `${baseIconUrl}?width=96&height=96`, sizes: "96x96" }]
        }
      ],
      prefer_related_applications: false,
      related_applications: []
    };

    // Create manifest blob and URL
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(manifestBlob);

    // Add manifest link
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestURL;
    document.head.appendChild(manifestLink);

    // Service Worker v1.1 (Updated for better caching)
    const swCode = `
      const CACHE_NAME = 'globeskimmers-v1.1';
      const urlsToCache = [
        '/',
        '/index.html'
      ];

      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => {
              console.log('✅ Globeskimmers: Cache opened');
              return cache.addAll(urlsToCache);
            })
        );
        self.skipWaiting();
      });

      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((cacheNames) => {
            return Promise.all(
              cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                  console.log('🗑️ Deleting old cache:', cacheName);
                  return caches.delete(cacheName);
                }
              })
            );
          })
        );
        return self.clients.claim();
      });

      self.addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              
              const fetchRequest = event.request.clone();
              
              return fetch(fetchRequest).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                  return response;
                }
                
                const responseToCache = response.clone();
                
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
                
                return response;
              });
            })
        );
      });
    `;

    // Register service worker
    if ('serviceWorker' in navigator) {
      const swBlob = new Blob([swCode], { type: 'application/javascript' });
      const swURL = URL.createObjectURL(swBlob);

      navigator.serviceWorker.register(swURL)
        .then(registration => {
          console.log('✅ Service Worker registered');
        })
        .catch(error => {
          console.log('❌ Service Worker registration failed:', error);
        });
    }

    // Add PWA meta tags
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Globeskimmers' },
      { name: 'theme-color', content: '#4A90A4' },
      { name: 'mobile-web-app-capable', content: 'yes' }
    ];

    metaTags.forEach(tag => {
      const meta = document.createElement('meta');
      meta.name = tag.name;
      meta.content = tag.content;
      document.head.appendChild(meta);
    });

    // Add apple touch icon
    const appleTouchIcon = document.createElement('link');
    appleTouchIcon.rel = 'apple-touch-icon';
    appleTouchIcon.href = `${baseIconUrl}?width=180&height=180`;
    document.head.appendChild(appleTouchIcon);

    // Add favicon
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = `${baseIconUrl}?width=48&height=48`;
    document.head.appendChild(favicon);

  }, []);

  return null;
}