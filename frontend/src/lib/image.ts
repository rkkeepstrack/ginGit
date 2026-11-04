/** Raster formats the webview can show; SVG stays a text diff. */
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico)$/i

export const isImage = (path: string) => IMAGE.test(path)

/** Served by the Go side from the open repository; the name only gives the URL an extension. */
export const blobUrl = (blob: string, path: string) => `/blob/${blob}/${encodeURIComponent(path.split('/').pop() ?? 'image')}`
