# Cozy Concierge maintenance review — October 20, 2026

## Address autofill

The missing suggestions were traced to a closed Google Cloud billing account after the free trial ended. Places API (New) was already enabled. After the authorized billing upgrade, autocomplete and address details both returned HTTP 200.

The address component now cancels obsolete search and details requests, preserves manual corrections, supports arrow-key and Enter selection, and keeps dismissed suggestions closed. Returning to an address field restarts a search that was cancelled before results arrived. Partial address results replace city, state, and postal code together so fields from a previous address cannot remain mixed in.

Added `npm run check:places` to diagnose autocomplete and details using a public sample address without printing credentials.

## Security and tooling

- Next.js and eslint-config-next: 15.5.19 → 15.5.28.
- PostCSS override: 8.5.15 → 8.5.31.
- Sharp override: 0.35.5.
- Compatible brace-expansion and js-yaml transitive patches.
- ESLint excludes temporary packaged copies under tmp/.

The dependency audit fell from 13 findings (one critical, 11 high, one moderate) to six (five high, one moderate). The high findings are in the development lint dependency chain. The production dependency finding is csv-parse (moderate), currently imported only by the airport and airline import scripts. Resolving that finding requires a separately tested major-version upgrade. Avoid npm audit fix --force, which proposes unrelated framework/tooling changes.

## Verification

- Production build, lint, and TypeScript validation.
- Browser regression checks for mouse and keyboard selection, provider failure/manual entry, stale requests, delayed details during manual edits, partial results, dismissal, and returning to a cancelled search.
- Live local verification using the actual address component, API route handlers, and Google Places: suggestions appeared and selecting one filled street, city, state, and postal code.
- No client records were saved during testing. The deployed production form and production environment variables were not independently verified.

## Follow-up items

- Address autocomplete currently restricts suggestions to the United States. International supplier/venue support needs an explicit country-design decision.
- Use separate server and browser Google keys if browser Maps integrations are introduced; the address routes require a server-compatible key.
- Review the remaining development-tool advisories and csv-parse major upgrade separately.
- README.md and project_status.md still describe older stages of the application.

## References

- [Places API setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Places API billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Next.js Windows-hosting security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
