// Single source of truth for the build-verification stamp shown in the popup footer
// and the Query Workspace / Query Builder headers. Bump BUILD_VERSION on every rebuild
// during active debugging so it's unambiguous whether a given browser tab is running
// current code or a stale cached bundle — increment the last segment each time.
export const BUILD_VERSION = '1.4.0.00000'

// Gates visibility of the badge above. Set to `true` while actively debugging locally
// (rebuild, reload the unpacked extension) — the badge helps confirm a tab isn't
// running stale code. Set back to `false` before committing/pushing or packaging a
// release zip; end users should never see a raw build-verification stamp.
export const DEV_MODE = false
