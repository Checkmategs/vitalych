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
