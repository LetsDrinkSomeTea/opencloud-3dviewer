<template>
  <div class="ext:flex ext:flex-col ext:h-full">
    <div v-if="error" class="ext:p-4 ext:text-red-600">
      <p>{{ $gettext('Error loading 3D model:') }} {{ error }}</p>
    </div>
    <div v-else-if="loading" class="ext:p-4">
      <p>{{ $gettext('Loading 3D model...') }}</p>
    </div>
    <div ref="canvasContainer" class="ext:flex-1 ext:relative ext:bg-gray-100" @wheel="onWheel">
      <!-- Control Panel -->
      <div v-if="!loading && !error" class="ext:absolute ext:top-4 ext:right-4 ext:bg-white ext:rounded-lg ext:shadow-lg ext:p-3 ext:space-y-3 ext:z-10">
        <div class="ext:text-sm ext:font-semibold ext:text-gray-700 ext:mb-2">
          {{ $gettext('View Options') }}
        </div>

        <!-- Grid Toggle -->
        <label class="ext:flex ext:items-center ext:cursor-pointer">
          <input
            type="checkbox"
            v-model="showGrid"
            @change="toggleGrid"
            class="ext:mr-2"
          />
          <span class="ext:text-sm ext:text-gray-700">{{ $gettext('Show Grid') }}</span>
        </label>

        <!-- Axes Toggle -->
        <label class="ext:flex ext:items-center ext:cursor-pointer">
          <input
            type="checkbox"
            v-model="showAxes"
            @change="toggleAxes"
            class="ext:mr-2"
          />
          <span class="ext:text-sm ext:text-gray-700">{{ $gettext('Show Axes') }}</span>
        </label>

        <!-- Up Axis Selection -->
        <div class="ext:border-t ext:pt-2">
          <div class="ext:text-xs ext:font-semibold ext:text-gray-600 ext:mb-1">
            {{ $gettext('Up Axis') }}
          </div>
          <select
            v-model="upAxis"
            @change="changeUpAxis"
            class="ext:w-full ext:text-sm ext:border ext:rounded ext:px-2 ext:py-1 ext:text-gray-700"
          >
            <option value="Y">{{ $gettext('Y-up') }}</option>
            <option value="Z">{{ $gettext('Z-up (CAD/3D Print)') }}</option>
            <option value="X">{{ $gettext('X-up') }}</option>
          </select>
        </div>

        <!-- Render Mode -->
        <div class="ext:border-t ext:pt-2">
          <div class="ext:text-xs ext:font-semibold ext:text-gray-600 ext:mb-1">
            {{ $gettext('Render Mode') }}
          </div>
          <select
            v-model="renderMode"
            @change="changeRenderMode"
            class="ext:w-full ext:text-sm ext:border ext:rounded ext:px-2 ext:py-1 ext:text-gray-700"
          >
            <option value="solid">{{ $gettext('Solid') }}</option>
            <option value="wireframe">{{ $gettext('Wireframe') }}</option>
            <option value="points">{{ $gettext('Points') }}</option>
          </select>
        </div>

        <!-- Model Color -->
        <div class="ext:border-t ext:pt-2">
          <div class="ext:text-xs ext:font-semibold ext:text-gray-600 ext:mb-1">
            {{ $gettext('Model Color') }}
          </div>
          <div class="ext:flex ext:gap-2 ext:flex-wrap">
            <button
              v-for="color in AVAILABLE_COLORS"
              :key="color"
              @click="changeModelColor(color)"
              :class="[
                'ext:w-6 ext:h-6 ext:rounded ext:border-2 ext:cursor-pointer ext:transition-transform hover:ext:scale-110',
                modelColor === color ? 'ext:border-gray-800' : 'ext:border-gray-300'
              ]"
              :style="{ backgroundColor: color }"
              :title="color"
            />
          </div>
        </div>

        <!-- Lighting Mode -->
        <div class="ext:border-t ext:pt-2">
          <div class="ext:text-xs ext:font-semibold ext:text-gray-600 ext:mb-1">
            {{ $gettext('Lighting') }}
          </div>
          <select
            v-model="lightingMode"
            @change="changeLighting"
            class="ext:w-full ext:text-sm ext:border ext:rounded ext:px-2 ext:py-1 ext:text-gray-700"
          >
            <option value="bright">{{ $gettext('Bright') }}</option>
            <option value="soft">{{ $gettext('Soft') }}</option>
            <option value="dramatic">{{ $gettext('Dramatic') }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'

const { $gettext } = useGettext()

// Constants
const AVAILABLE_COLORS = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
const TARGET_MODEL_SIZE = 4
const CAMERA_POSITION = { x: 3, y: 2, z: 3 }
const GRID_SIZE = 10
const AXES_SIZE = 5

const MATERIAL_CONFIG = {
  specular: 0x444444,
  shininess: 30,
  flatShading: false,
  side: THREE.DoubleSide
}

const LIGHTING_PRESETS = {
  bright: {
    ambient: 0.4,
    key: { intensity: 1.0, position: [5, 5, 5] as [number, number, number] },
    fill: { intensity: 0.5, position: [-3, -2, -3] as [number, number, number] }
  },
  soft: {
    ambient: 0.6,
    key: { intensity: 0.6, position: [2, 4, 2] as [number, number, number] },
    fill: { intensity: 0.4, position: [-2, -2, -2] as [number, number, number] }
  },
  dramatic: {
    ambient: 0.2,
    key: { intensity: 1.5, position: [4, 6, 3] as [number, number, number] },
    fill: { intensity: 0.2, position: [-2, -1, -2] as [number, number, number] }
  }
}

// Props
const props = defineProps<{
  url?: string
  currentFileContext?: {
    name?: string
    path?: string
    extension?: string
  }
}>()

// Refs
const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const showGrid = ref(true)
const showAxes = ref(true)
const renderMode = ref<'solid' | 'wireframe' | 'points'>('solid')
const modelColor = ref(AVAILABLE_COLORS[0])
const lightingMode = ref<'bright' | 'soft' | 'dramatic'>('bright')
const upAxis = ref<'Y' | 'Z' | 'X'>('Z') // Default Z-up (common for CAD/3D printing)

// Three.js scene objects
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationFrameId: number | null = null
let currentModel: THREE.Object3D | null = null
let gridHelper: THREE.GridHelper | null = null
let axesHelper: THREE.AxesHelper | null = null
let ambientLight: THREE.AmbientLight | null = null
let directionalLight1: THREE.DirectionalLight | null = null
let directionalLight2: THREE.DirectionalLight | null = null

const initScene = () => {
  if (!canvasContainer.value) return

  // Scene setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf3f4f6)

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z)

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)

  // Add helpers
  gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0xcccccc, 0xe0e0e0)
  scene.add(gridHelper)

  axesHelper = new THREE.AxesHelper(AXES_SIZE)
  scene.add(axesHelper)

  // Lighting setup
  const preset = LIGHTING_PRESETS[lightingMode.value]

  ambientLight = new THREE.AmbientLight(0xffffff, preset.ambient)
  scene.add(ambientLight)

  directionalLight1 = new THREE.DirectionalLight(0xffffff, preset.key.intensity)
  directionalLight1.position.set(...preset.key.position)
  scene.add(directionalLight1)

  directionalLight2 = new THREE.DirectionalLight(0xffffff, preset.fill.intensity)
  directionalLight2.position.set(...preset.fill.position)
  scene.add(directionalLight2)

  // Rim light for edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
  rimLight.position.set(0, -5, 0)
  scene.add(rimLight)

  // Controls setup
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Animation loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // Window resize handler
  const handleResize = () => {
    if (!canvasContainer.value) return
    camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }
  window.addEventListener('resize', handleResize)
}

const createMaterial = () => {
  const color = new THREE.Color(modelColor.value)
  return new THREE.MeshPhongMaterial({
    color,
    ...MATERIAL_CONFIG
  })
}

const getFileExtension = (): string => {
  let extension = props.currentFileContext?.extension?.toLowerCase() || ''
  if (!extension && props.url) {
    const fileName = props.currentFileContext?.name || props.currentFileContext?.path || props.url
    const match = fileName.match(/\.([^./\\]+)($|\?)/)
    if (match) {
      extension = match[1].toLowerCase()
    }
  }
  return extension
}

const loadModel = async () => {
  loading.value = true
  error.value = null

  try {
    if (!props.url) {
      throw new Error('No URL available for loading the model')
    }

    if (!scene) {
      throw new Error('Scene not initialized')
    }

    const extension = getFileExtension()
    if (!extension) {
      throw new Error('Could not determine file extension')
    }

    // Clear previous model
    if (currentModel) {
      scene.remove(currentModel)
      currentModel = null
    }

    let object: THREE.Object3D | null = null
    const material = createMaterial()

    // Load based on file extension
    switch (extension) {
      case 'stl': {
        const loader = new STLLoader()
        const geometry = await loader.loadAsync(props.url)
        object = new THREE.Mesh(geometry, material)
        break
      }
      case 'obj': {
        const loader = new OBJLoader()
        object = await loader.loadAsync(props.url)
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = material
          }
        })
        break
      }
      case 'ply': {
        const loader = new PLYLoader()
        const geometry = await loader.loadAsync(props.url)
        const plyMaterial = createMaterial()
        if (geometry.hasAttribute('color')) {
          (plyMaterial as any).vertexColors = true
        }
        object = new THREE.Mesh(geometry, plyMaterial)
        break
      }
      case 'gltf':
      case 'glb': {
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(props.url)
        object = gltf.scene
        break
      }
      case '3mf': {
        try {
          const loader = new ThreeMFLoader()
          object = await loader.loadAsync(props.url)
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = material
            }
          })
        } catch (e) {
          throw new Error(
            `3MF file parsing failed. The file may be corrupted or use unsupported features. ${
              e instanceof Error ? e.message : String(e)
            }`
          )
        }
        break
      }
      default:
        throw new Error(`Unsupported file format: ${extension}`)
    }

    if (object) {
      positionAndScaleModel(object)
    }

    loading.value = false
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    loading.value = false
  }
}

const positionAndScaleModel = (object: THREE.Object3D) => {
  scene.add(object)
  currentModel = object

  // Ensure proper normals for lighting
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.computeVertexNormals()
    }
  })

  // Apply coordinate system conversion based on up axis
  applyUpAxisRotation(object)

  // Calculate bounding box and scale
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  if (maxDim > 0) {
    const scale = TARGET_MODEL_SIZE / maxDim
    object.scale.multiplyScalar(scale)
  }

  // Recalculate after scaling and position on grid
  box.setFromObject(object)
  const scaledCenter = box.getCenter(new THREE.Vector3())
  const scaledSize = box.getSize(new THREE.Vector3())

  object.position.x -= scaledCenter.x
  object.position.z -= scaledCenter.z
  object.position.y -= scaledCenter.y - scaledSize.y / 2 // Bottom at Y=0

  // Reset camera and controls
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z)
  camera.lookAt(0, 0, 0)

  if (controls) {
    controls.target.set(0, 0, 0)
    controls.update()
  }
}

const applyUpAxisRotation = (object: THREE.Object3D) => {
  // Reset rotation first
  object.rotation.set(0, 0, 0)
  
  // Three.js uses Y-up by default
  // Apply rotation to convert from other coordinate systems
  switch (upAxis.value) {
    case 'Y':
      // No rotation needed - already Y-up
      break
    case 'Z':
      // Z-up to Y-up: rotate -90° around X-axis
      object.rotation.x = -Math.PI / 2
      break
    case 'X':
      // X-up to Y-up: rotate 90° around Z-axis
      object.rotation.z = Math.PI / 2
      break
  }
}

const toggleGrid = () => {
  if (gridHelper) {
    gridHelper.visible = showGrid.value
  }
}

const toggleAxes = () => {
  if (axesHelper) {
    axesHelper.visible = showAxes.value
  }
}

const changeRenderMode = () => {
  if (!currentModel) return

  // Remove existing point clouds
  const toRemove: THREE.Object3D[] = []
  currentModel.traverse((child) => {
    if (child instanceof THREE.Points) {
      toRemove.push(child)
    }
  })
  toRemove.forEach((obj) => obj.parent?.remove(obj))

  // Apply render mode
  currentModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material

      switch (renderMode.value) {
        case 'solid':
          child.visible = true
          if (material && 'wireframe' in material) {
            (material as any).wireframe = false
          }
          break

        case 'wireframe':
          child.visible = true
          if (material && 'wireframe' in material) {
            (material as any).wireframe = true
          }
          break

        case 'points':
          child.visible = false
          const geometry = child.geometry
          const pointsMaterial = new THREE.PointsMaterial({
            color: new THREE.Color(modelColor.value),
            size: 0.05,
            sizeAttenuation: true
          })
          const points = new THREE.Points(geometry, pointsMaterial)
          points.position.copy(child.position)
          points.rotation.copy(child.rotation)
          points.scale.copy(child.scale)
          points.name = 'points_temp'
          child.parent?.add(points)
          break
      }
    }
  })
}

const changeModelColor = (color: string) => {
  modelColor.value = color

  if (!currentModel) return

  const threeColor = new THREE.Color(color)

  currentModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material
      if (material && 'color' in material) {
        (material as any).color = threeColor.clone()
        if ('specular' in material) {
          (material as any).specular = new THREE.Color(MATERIAL_CONFIG.specular)
        }
        if ('shininess' in material) {
          (material as any).shininess = MATERIAL_CONFIG.shininess
        }
      }
    }
  })
}

const changeLighting = () => {
  if (!ambientLight || !directionalLight1 || !directionalLight2) return

  const preset = LIGHTING_PRESETS[lightingMode.value]

  ambientLight.intensity = preset.ambient
  directionalLight1.intensity = preset.key.intensity
  directionalLight1.position.set(...preset.key.position)
  directionalLight2.intensity = preset.fill.intensity
  directionalLight2.position.set(...preset.fill.position)
}

const changeUpAxis = () => {
  if (!currentModel) return

  // Reapply the rotation based on new up axis
  applyUpAxisRotation(currentModel)

  // Recalculate position to keep model on grid
  const box = new THREE.Box3().setFromObject(currentModel)
  const scaledCenter = box.getCenter(new THREE.Vector3())
  const scaledSize = box.getSize(new THREE.Vector3())

  currentModel.position.x -= scaledCenter.x
  currentModel.position.z -= scaledCenter.z
  currentModel.position.y -= scaledCenter.y - scaledSize.y / 2
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
}

onMounted(() => {
  initScene()

  if (props.url) {
    loadModel()
  } else {
    error.value = 'No file URL provided'
    loading.value = false
  }
})

watch(() => props.url, (newUrl) => {
  if (newUrl) {
    loadModel()
  }
})

onBeforeUnmount(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  if (renderer) {
    renderer.dispose()
  }
  if (controls) {
    controls.dispose()
  }
})
</script>

<style scoped>
/* Component styles handled by Tailwind classes */
</style>
