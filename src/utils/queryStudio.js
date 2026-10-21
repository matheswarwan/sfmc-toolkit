// Query Studio hosts whose runs are saved as queries. Both are in the manifest's
// host_permissions (Query Studio 2 since 2.0.10, user: on by default; it was an
// optional permission from 2.0.3, feedback #32). Settings > Running queries turns
// Query Studio 2 saving off with QUERY_STUDIO_2_SETTING. Both send the SQL as
// `querytext` in POST /query/create.
export const QUERY_STUDIO_2_SETTING = '_saveQueryStudio2'

export const QUERY_STUDIO_2_ORIGINS = ['https://querystudio2-dev-89f7e4653c61.herokuapp.com/*']

export const QUERY_STUDIO_CREATE_URLS = [
  'https://querystudio.herokuapp.com/query/create',
  ...QUERY_STUDIO_2_ORIGINS.map((o) => o.replace(/\*$/, 'query/create')),
]

export function isQueryStudio2(url) {
  return QUERY_STUDIO_2_ORIGINS.some((o) => String(url || '').startsWith(o.replace(/\*$/, '')))
}
