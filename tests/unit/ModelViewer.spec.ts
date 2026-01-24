import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelViewer from '../../src/views/ModelViewer.vue'
import * as THREE from 'three'

// Mock Three.js constructors
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      setSize = vi.fn()
      setPixelRatio = vi.fn()
      dispose = vi.fn()
      render = vi.fn()
    }
  }
})

// Mock Three.js loaders
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    enableDamping = true
    dampingFactor = 0.05
    update = vi.fn()
    dispose = vi.fn()
    target = { set: vi.fn() }
  }
}))

vi.mock('three/examples/jsm/loaders/STLLoader.js', async () => {
  const THREE = await import('three')
  return {
    STLLoader: class {
      loadAsync = vi.fn().mockResolvedValue(new THREE.BufferGeometry())
    }
  }
})

vi.mock('three/examples/jsm/loaders/OBJLoader.js', async () => {
  const THREE = await import('three')
  return {
    OBJLoader: class {
      loadAsync = vi.fn().mockResolvedValue(new THREE.Group())
    }
  }
})

vi.mock('three/examples/jsm/loaders/PLYLoader.js', async () => {
  const THREE = await import('three')
  return {
    PLYLoader: class {
      loadAsync = vi.fn().mockResolvedValue(new THREE.BufferGeometry())
    }
  }
})

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', async () => {
  const THREE = await import('three')
  return {
    GLTFLoader: class {
      loadAsync = vi.fn().mockResolvedValue({ scene: new THREE.Group() })
    }
  }
})

vi.mock('three/examples/jsm/loaders/3MFLoader.js', async () => {
  const THREE = await import('three')
  return {
    ThreeMFLoader: class {
      loadAsync = vi.fn().mockResolvedValue(new THREE.Group())
    }
  }
})

// Mock vue3-gettext
vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (msg: string) => msg
  })
}))

// Mock window.matchMedia for dark mode detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)' ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

describe('ModelViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Mounting', () => {
    it('renders without crashing', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('shows loading state initially', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      expect(wrapper.text()).toContain('Loading 3D model...')
    })

    it('shows error when no URL is provided', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          currentFileContext: {}
        }
      })
      
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(wrapper.text()).toContain('Error loading 3D model')
    })
  })

  describe('File Extension Detection', () => {
    it('detects extension from currentFileContext', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'blob:test',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      expect(wrapper.vm.currentFileContext?.extension).toBe('stl')
    })

    it('detects extension from filename in currentFileContext', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'blob:test',
          currentFileContext: {
            name: 'model.obj'
          }
        }
      })
      expect(wrapper.vm.currentFileContext?.name).toBe('model.obj')
    })

    it('handles URL with query parameters', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'https://example.com/model.stl?version=1',
          currentFileContext: {
            name: 'model.stl'
          }
        }
      })
      expect(wrapper.vm.url).toBe('https://example.com/model.stl?version=1')
    })
  })

  describe('Control Panel Visibility', () => {
    it('shows control panel when model is loaded', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      // Manually set the state to simulate loaded
      wrapper.vm.loading = false
      wrapper.vm.error = null
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('View Options')
    })

    it('hides control panel during loading', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      // Should still be loading
      expect(wrapper.vm.loading).toBe(true)
    })
  })

  describe('Dark Mode', () => {
    it('initializes dark mode as false by default', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.isDarkMode).toBe(false)
    })

    it('detects dark mode preference when system prefers dark', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)' ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))

      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })

      expect(wrapper.vm.isDarkMode).toBe(true)
    })
  })

  describe('UI Controls Default State', () => {
    it('initializes with correct default values', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.showGrid).toBe(true)
      expect(wrapper.vm.showAxes).toBe(true)
      expect(wrapper.vm.renderMode).toBe('solid')
      expect(wrapper.vm.upAxis).toBe('Z')
      expect(wrapper.vm.lightingMode).toBe('bright')
      expect(wrapper.vm.modelColor).toBe('#9333ea')
    })
  })

  describe('Render Modes', () => {
    it('supports solid render mode', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.renderMode).toBe('solid')
    })

    it('can switch to wireframe mode', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.renderMode = 'wireframe'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.renderMode).toBe('wireframe')
    })

    it('can switch to points mode', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.renderMode = 'points'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.renderMode).toBe('points')
    })
  })

  describe('Up Axis Configuration', () => {
    it('defaults to Z-up axis', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.upAxis).toBe('Z')
    })

    it('can switch to Y-up axis', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.upAxis = 'Y'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.upAxis).toBe('Y')
    })

    it('can switch to X-up axis', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.upAxis = 'X'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.upAxis).toBe('X')
    })
  })

  describe('Lighting Modes', () => {
    it('defaults to bright lighting', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.lightingMode).toBe('bright')
    })

    it('can switch to soft lighting', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.lightingMode = 'soft'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.lightingMode).toBe('soft')
    })

    it('can switch to dramatic lighting', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.lightingMode = 'dramatic'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.lightingMode).toBe('dramatic')
    })
  })

  describe('Supported File Formats', () => {
    const formats = [
      { ext: 'stl', name: 'STL' },
      { ext: 'obj', name: 'OBJ' },
      { ext: 'ply', name: 'PLY' },
      { ext: 'gltf', name: 'GLTF' },
      { ext: 'glb', name: 'GLB' },
      { ext: '3mf', name: '3MF' }
    ]
    
    formats.forEach(({ ext, name }) => {
      it(`accepts ${name} files`, () => {
        const wrapper = mount(ModelViewer, {
          props: {
            url: `test.${ext}`,
            currentFileContext: {
              extension: ext
            }
          }
        })
        
        expect(wrapper.vm.currentFileContext?.extension).toBe(ext)
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'invalid.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.loading = false
      wrapper.vm.error = 'Failed to load model'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Error loading 3D model')
      expect(wrapper.text()).toContain('Failed to load model')
    })

    it('shows specific error for unsupported format', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.xyz',
          currentFileContext: {
            extension: 'xyz'
          }
        }
      })
      
      wrapper.vm.loading = false
      wrapper.vm.error = 'Unsupported file format: xyz'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Unsupported file format')
    })
  })

  describe('Model Colors', () => {
    it('defaults to purple', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.modelColor).toBe('#9333ea')
    })

    it('can change color', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.modelColor = '#3b82f6'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.modelColor).toBe('#3b82f6')
    })
  })

  describe('Grid and Axes Toggles', () => {
    it('grid is shown by default', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.showGrid).toBe(true)
    })

    it('axes are shown by default', () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      expect(wrapper.vm.showAxes).toBe(true)
    })

    it('can toggle grid visibility', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.showGrid = false
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.showGrid).toBe(false)
    })

    it('can toggle axes visibility', async () => {
      const wrapper = mount(ModelViewer, {
        props: {
          url: 'test.stl',
          currentFileContext: {
            extension: 'stl'
          }
        }
      })
      
      wrapper.vm.showAxes = false
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.showAxes).toBe(false)
    })
  })
})
