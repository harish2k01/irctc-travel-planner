# Mobile installation and verification

RailWatch exposes a same-origin manifest with standalone display, regular/maskable PNG icons and an Apple touch icon. The application uses its normal login, backend and PostgreSQL workspace when opened from the home screen. Provider connections remain outgoing; installation adds no webhook or inbound integration port.

## Install

- Android Chrome: open the HTTPS RailWatch address, use **Install RailWatch** under **More**, or the browser menu's **Install app / Add to Home screen** option. The in-app button opens a native prompt only when the browser offers one.
- iPhone/iPad: open the address in Safari, tap **Share → Add to Home Screen**, and launch the new icon. If the browser offers an **Open as Web App** option, enable it.
- Desktop: **Install RailWatch** uses the browser prompt where supported, otherwise shows instructions.

An ordinary bookmark opens in a browser tab. Home-screen installation is the option intended for a separate app window. Production needs HTTPS; localhost is supported for development. Self-hosted plain HTTP remains a normal website and does not promise installability or a service worker.

## Offline and update behavior

Only `/offline.html`, a public reconnect screen, is stored by the service worker. Account HTML, API responses, login credentials and PDF tickets are not added to Cache Storage. Navigation goes to the network first, so deployments do not require an old application shell to expire. Private tickets remain on the server and need connectivity; browser push is not introduced by this change. On worker updates, old RailWatch offline-document caches are removed and the worker is revalidated without HTTP caching.

## Device acceptance after deployment

Responsive Chrome checks at 320, 390, 768 and 1482 pixels cover both themes. They do not substitute for these physical-device checks:

1. Install and relaunch on Android Chrome and iPhone Safari; confirm icon, standalone window and login behavior.
2. Verify all four bottom navigation destinations, More pages, settings tabs, journeys, agenda and ticket viewer.
3. Focus forms with the keyboard open; confirm no unwanted zoom, obscured save controls or safe-area overlap.
4. Turn the network off, relaunch and verify the reconnect page; reconnect and confirm normal access.
5. Deploy an update and relaunch; verify fresh application assets and private-account separation after sign-out/sign-in.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [MDN installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing), [MDN install prompt](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
