export type ProjectData = Record<string, unknown>
export type TemplateKey = 'tz' | 'pz'
export type RenderTemplate = 'tz' | 'pz' | 'all'
export type RenderFormat = 'md' | 'docx' | 'both'

export type ProjectSummary = {
  id: string
  slug: string
  name: string
  updated_at: string
}

export type Project = {
  id: string
  slug: string
  name: string
  data: ProjectData
  template_tz: string
  template_pz: string
  style_profile: string
  created_at: string
  updated_at: string
}

export type ProjectPutBody = {
  data: ProjectData
  template_tz?: string
  template_pz?: string
  style_profile?: string
  name?: string
}

export type VersionItem = {
  id: string
  label: string | null
  note: string | null
  created_at: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects')
  return parseJson<ProjectSummary[]>(res)
}

export async function createProject(body: {
  name: string
  slug?: string
}): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<Project>(res)
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`)
  return parseJson<Project>(res)
}

export async function putProject(id: string, body: ProjectPutBody): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<Project>(res)
}

export async function listVersions(projectId: string): Promise<VersionItem[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/versions`)
  return parseJson<VersionItem[]>(res)
}

export async function createVersion(
  projectId: string,
  body: { label?: string; note?: string } = {},
): Promise<VersionItem> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<VersionItem>(res)
}

export async function restoreVersion(projectId: string, versionId: string): Promise<Project> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/restore`,
    { method: 'POST' },
  )
  return parseJson<Project>(res)
}

export async function renderProject(
  projectId: string,
  template: RenderTemplate = 'all',
  format: RenderFormat = 'both',
): Promise<{ written: string[] }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, format }),
  })
  return parseJson<{ written: string[] }>(res)
}

export async function fetchDocxBlob(projectId: string, filename: string): Promise<Blob> {
  const name = filename.split('/').pop() ?? filename
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/download/${encodeURIComponent(name)}`,
  )
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`)
  }
  return res.blob()
}

/** Save a blob via Save As picker when available; otherwise trigger a download. */
export async function saveDocxAs(blob: Blob, suggestedName: string): Promise<'saved' | 'cancelled' | 'downloaded'> {
  const w = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>
  }

  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Word document',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return 'cancelled'
      }
      // Fall through to anchor download if picker fails for other reasons
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
