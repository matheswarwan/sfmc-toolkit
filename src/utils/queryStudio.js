// Query Studio hosts whose runs are saved as queries. Query Studio 1 is in the
// manifest's host_permissions. Query Studio 2 (feedback #32) is an optional host
// permission: Settings > Running queries asks for it, so installing or updating
// the Toolkit needs no new approval. Both send the SQL as `querytext` in
// POST /query/create.
export const QUERY_STUDIO_2_ORIGINS = ['https://querystudio2-dev-89f7e4653c61.herokuapp.com/*']

export const QUERY_STUDIO_CREATE_URLS = [
  'https://querystudio.herokuapp.com/query/create',
  ...QUERY_STUDIO_2_ORIGINS.map((o) => o.replace(/\*$/, 'query/create')),
]
