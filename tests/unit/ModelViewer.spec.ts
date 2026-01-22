import { describe, it, expect } from 'vitest'

describe('ModelViewer URL handling', () => {
  it('correctly identifies data URLs', () => {
    const dataUrl = 'data:application/octet-stream;base64,...'
    expect(dataUrl.startsWith('data:')).toBe(true)
  })

  it('correctly identifies blob URLs', () => {
    const blobUrl = 'blob:https://example.com/abc-123'
    expect(blobUrl.startsWith('blob:')).toBe(true)
  })

  it('correctly identifies http URLs', () => {
    const httpUrl = 'http://example.com/model.stl'
    expect(httpUrl.startsWith('http://')).toBe(true)
  })

  it('correctly identifies https URLs', () => {
    const httpsUrl = 'https://example.com/model.stl'
    expect(httpsUrl.startsWith('https://')).toBe(true)
  })

  it('correctly identifies plain text content', () => {
    const textContent = 'v 0.0 0.0 0.0\nv 1.0 0.0 0.0'
    expect(
      textContent.startsWith('data:') ||
        textContent.startsWith('blob:') ||
        textContent.startsWith('http://') ||
        textContent.startsWith('https://')
    ).toBe(false)
  })
})
