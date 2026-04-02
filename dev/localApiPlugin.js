import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_JSON_BODY_SIZE = 1024 * 1024

function createHttpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function sendJson(res, status, payload) {
  res.statusCode = status
  if (!res.headersSent && !res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
  }
  res.end(JSON.stringify(payload))
}

function enhanceResponse(res) {
  if (typeof res.status !== 'function') {
    res.status = (statusCode) => {
      res.statusCode = statusCode
      return res
    }
  }

  if (typeof res.json !== 'function') {
    res.json = (payload) => {
      if (!res.headersSent && !res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      res.end(JSON.stringify(payload))
      return res
    }
  }
}

function isJsonRequest(req) {
  const contentType = req.headers['content-type'] || ''
  return contentType.toLowerCase().includes('application/json')
}

async function readJsonBody(req) {
  const declaredLength = Number(req.headers['content-length'] || 0)
  if (declaredLength > MAX_JSON_BODY_SIZE) {
    throw createHttpError(413, 'Request body too large')
  }

  const chunks = []
  let total = 0

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length

    if (total > MAX_JSON_BODY_SIZE) {
      throw createHttpError(413, 'Request body too large')
    }

    chunks.push(buffer)
  }

  if (!chunks.length) return {}

  const rawBody = Buffer.concat(chunks).toString('utf8').trim()
  if (!rawBody) return {}

  try {
    return JSON.parse(rawBody)
  } catch {
    throw createHttpError(400, 'Invalid JSON body')
  }
}

function isInvalidSegment(segment) {
  return (
    !segment ||
    segment === '.' ||
    segment === '..' ||
    segment.startsWith('_') ||
    segment.includes('\\') ||
    segment.includes('.')
  )
}

function resolveRoute(projectRoot, pathname) {
  const apiRoot = path.resolve(projectRoot, 'api')
  const normalizedPath = pathname.replace(/\/+$/, '') || '/api'

  if (!normalizedPath.startsWith('/api')) {
    return null
  }

  const rawSegments = normalizedPath === '/api'
    ? ['index']
    : normalizedPath.slice('/api/'.length).split('/').map((segment) => decodeURIComponent(segment))

  if (rawSegments.some(isInvalidSegment)) {
    return { type: 'blocked' }
  }

  const filePath = path.resolve(apiRoot, `${rawSegments.join('/')}.js`)
  const relativePath = path.relative(apiRoot, filePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { type: 'blocked' }
  }

  if (!fs.existsSync(filePath)) {
    return { type: 'missing' }
  }

  return {
    type: 'file',
    filePath,
    modulePath: `/${path.relative(projectRoot, filePath).split(path.sep).join('/')}`,
  }
}

async function handleApiRequest(req, res, loadModule, projectRoot, fixStacktrace) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (!url.pathname.startsWith('/api')) {
    return false
  }

  const route = resolveRoute(projectRoot, url.pathname)
  if (!route || route.type !== 'file') {
    sendJson(res, 404, { success: false, error: 'API route not found' })
    return true
  }

  enhanceResponse(res)
  req.path = url.pathname
  req.query = Object.fromEntries(url.searchParams.entries())

  try {
    if (isJsonRequest(req) && req.body == null) {
      req.body = await readJsonBody(req)
    }

    const mod = await loadModule(route)
    if (typeof mod?.default !== 'function') {
      throw createHttpError(500, `Invalid API handler for ${route.modulePath}`)
    }

    await mod.default(req, res)

    if (!res.writableEnded) {
      throw createHttpError(500, `API handler for ${route.modulePath} completed without sending a response`)
    }
  } catch (error) {
    if (typeof fixStacktrace === 'function') {
      fixStacktrace(error)
    }

    const status = error?.status || 500

    if (status >= 500) {
      console.error('[Local API Error]', error)
    } else {
      console.error(`[Local API Error ${status}]`, error?.message || 'Request failed')
    }

    if (!res.headersSent) {
      sendJson(res, status, { success: false, error: error?.message || 'Internal server error' })
    } else if (!res.writableEnded) {
      res.end()
    }
  }

  return true
}

export function localApiPlugin(options = {}) {
  const projectRoot = options.projectRoot || process.cwd()

  return {
    name: 'studymind-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(
          req,
          res,
          (route) => server.ssrLoadModule(route.modulePath),
          projectRoot,
          (error) => server.ssrFixStacktrace(error),
        )

        if (!handled) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(
          req,
          res,
          (route) => import(pathToFileURL(route.filePath).href),
          projectRoot,
        )

        if (!handled) next()
      })
    },
  }
}
