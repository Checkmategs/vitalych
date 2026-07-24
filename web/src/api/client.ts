export type ProjectData = Record<string, unknown>
export type TemplateKey = 'tz' | 'pz'
export type RenderTemplate = 'tz' | 'pz' | 'all'
export type RenderFormat = 'md' | 'docx' | 'both'

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

export async function getProject(): Promise<ProjectData> {
  const res = await fetch('/api/project')
  return parseJson<ProjectData>(res)
}

export async function putProject(data: ProjectData): Promise<ProjectData> {
  const res = await fetch('/api/project', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  return parseJson<ProjectData>(res)
}

export async function getTemplate(key: TemplateKey): Promise<{ key: string; content: string }> {
  const res = await fetch(`/api/template/${key}`)
  return parseJson<{ key: string; content: string }>(res)
}

export async function putTemplate(
  key: TemplateKey,
  content: string,
): Promise<{ key: string; content: string }> {
  const res = await fetch(`/api/template/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  return parseJson<{ key: string; content: string }>(res)
}

export async function render(
  template: RenderTemplate = 'all',
  format: RenderFormat = 'both',
): Promise<{ written: string[] }> {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, format }),
  })
  return parseJson<{ written: string[] }>(res)
}

export async function fetchDocxBlob(filename: string): Promise<Blob> {
  const name = filename.split('/').pop() ?? filename
  const res = await fetch(`/api/download/${encodeURIComponent(name)}`)
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
