# Feature developer consoles

Every portal route has a Dev Console launcher at the bottom right. Open it to watch that feature's actions, API requests, wallet operations, CKB calls and Fiber operations as they run. The same console is available in the Mainnet build. FiberOps tool tabs have distinct console scopes.

Each event includes its timestamp, source, operation name, start/completion/error state and operation ID. Completed requests show elapsed time; supported CKB responses also show public transaction hashes or transaction status. Errors show safe numeric codes and a troubleshooting hint. Read the feature's status message for detailed validation errors.

- Filter by level or operation/status text.
- Pause the visible log while capture continues; Resume catches up.
- Follow keeps the newest events visible.
- Clear removes only the current feature/network history, including late completions from cleared operations.
- Export JSONL downloads the current history (or the frozen history while paused). Filters affect the display; export includes all retained levels.

Logs survive navigation within the app and remain separated by feature and selected network. Reloading the page clears them. Retention is limited to 250 entries per scope and 80 scopes per browser session. Nothing is sent to a log service or written to browser storage.

Request arguments, bodies, headers, signatures, preimages, private keys and raw error/response payloads are excluded. The console does not mirror arbitrary `console.log` calls or stream Rust process stdout/Fiber worker stdout. It reports browser-observed operations; a Rust startup failure before the API becomes available still requires the terminal error output.

## Adding a feature

Register its route/title in `portal/src/dev-console/features.ts`. Use `useFeatureCcc`, `useFeatureSigner` or `useFeatureObject` for feature-bound clients. API objects exported by `backend.ts` are instrumented centrally. Use `beginOperation` for local preparation and validation, capturing the scope before asynchronous work begins. Call `fail(error)` even when the feature handles the error itself, then complete in the success path. Only pass static source-code labels, never user input, to the logger.

## Checks

From `portal`:

```sh
npm test
npm run build
npx playwright test e2e/dev-console.spec.ts --reporter=line
npm run build:mainnet
npx playwright test --config=playwright.mainnet.config.ts --reporter=line
```
