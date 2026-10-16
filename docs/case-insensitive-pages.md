# Case-insensitive page addresses

The production build generates `dist/page-case-routes.json` from full HTML pages, including content-generated pages and standalone documents. `public/404.html` looks up a mistyped page address and replaces it with its canonical casing, retaining the query string and fragment. Examples: `/acf` → `/ACF/`, `/EAD` → `/ead/`, and mixed-case nested project addresses.

Existing canonical pages, assets, deferred HTML fragments, verification files, and unknown addresses are not redirected. Case collisions fail the build. The lookup contains path hashes and capitalization positions instead of a new plaintext directory of unlisted pages; this preserves discovery boundaries, not authentication. Existing page privacy metadata is unchanged.

GitHub Pages serves static content and supports a [custom404 document](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site). A differently cased address initially receives HTTP404, then JavaScript navigates to the canonical page. This is not a server301/308 or a universal case-insensitive filesystem. JavaScript-disabled clients must use the canonical address. Case-only alias folders are intentionally avoided because local Windows checkouts cannot safely represent them beside the canonical folders.

Run `npm run build` then `node --test scripts/test-case-page-routes.mjs`. Tests cover mixed casing, trailing slashes, nested and static pages, query/fragment preservation, unsafe and unknown addresses, collisions, generated-page discovery, and404 navigation/failure behavior. Production checks should request a mixed-case URL, confirm the404 response contains the fallback script, then verify navigation to the canonical page in a browser.
