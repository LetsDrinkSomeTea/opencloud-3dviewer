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

        <!-- Viewing Mode -->
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
              v-for="color in ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']"
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

const props = defineProps<{
  url?: string
  currentFileContext?: {
    name?: string
    path?: string
    extension?: string
  }
}>()

const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// UI controls
const showGrid = ref(true)
const showAxes = ref(true)
const renderMode = ref<'solid' | 'wireframe' | 'points'>('solid')
const modelColor = ref('#9333ea')
const lightingMode = ref<'bright' | 'soft' | 'dramatic'>('bright')

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

  // Create scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf3f4f6)

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(5, 5, 5)

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)

  // Add grid helper
  gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xe0e0e0)
  scene.add(gridHelper)

  // Add axes helper
  axesHelper = new THREE.AxesHelper(5)
  scene.add(axesHelper)

  // Add lights with better setup for showing form
  ambientLight = new THREE.AmbientLight(0xffffff, 0.4) // Reduced ambient for more contrast
  scene.add(ambientLight)

  directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0) // Key light
  directionalLight1.position.set(5, 5, 5)
  directionalLight1.castShadow = false
  scene.add(directionalLight1)

  directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5) // Fill light
  directionalLight2.position.set(-3, -2, -3)
  scene.add(directionalLight2)

  // Add a third rim light for better edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
  rimLight.position.set(0, -5, 0)
  scene.add(rimLight)

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Start animation loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  // Handle window resize
  const handleResize = () => {
    if (!canvasContainer.value) return
    camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  }
  window.addEventListener('resize', handleResize)
}

const loadModel = async () => {
  loading.value = true
  error.value = null

  try {
    // AppWrapperRoute with urlForResourceOptions: { disposition: 'inline' } provides a direct URL
    if (!props.url) {
      throw new Error('No URL available for loading the model')
    }

    console.log('Loading model from URL:', props.url)

    // Get file extension
    let extension = props.currentFileContext?.extension?.toLowerCase() || ''
    if (!extension) {
      const fileName = props.currentFileContext?.name || props.currentFileContext?.path || props.url
      const match = fileName.match(/\.([^./\\]+)($|\?)/)
      if (match) {
        extension = match[1].toLowerCase()
      }
    }

    console.log('File extension:', extension)

    // Scene should already be initialized from onMounted()
    if (!scene) {
      throw new Error('Scene not initialized')
    }

    // Clear previous model
    if (currentModel) {
      scene.remove(currentModel)
      currentModel = null
    }

    let object: THREE.Object3D | null = null

    // Use the selected color for materials
    const threeColor = new THREE.Color(modelColor.value)
    
    // Improved material with better shading properties
    const sharedMaterial = new THREE.MeshPhongMaterial({
      color: threeColor,
      specular: 0x444444,  // More specular reflection
      shininess: 30,        // Lower shininess for softer highlights
      flatShading: false,   // Smooth shading
      side: THREE.DoubleSide // Show both sides
    })

    // Load based on file extension using the URL directly
    switch (extension) {
      case 'stl': {
        const loader = new STLLoader()
        const geometry = await loader.loadAsync(props.url)
        object = new THREE.Mesh(geometry, sharedMaterial)
        break
      }
      case 'obj': {
        const loader = new OBJLoader()
        object = await loader.loadAsync(props.url)
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = sharedMaterial
          }
        })
        break
      }
      case 'ply': {
        const loader = new PLYLoader()
        const geometry = await loader.loadAsync(props.url)
        const material = new THREE.MeshPhongMaterial({
          color: threeColor,
          specular: 0x444444,
          shininess: 30,
          flatShading: false,
          side: THREE.DoubleSide,
          vertexColors: geometry.hasAttribute('color')
        })
        object = new THREE.Mesh(geometry, material)
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
              child.material = sharedMaterial
            }
          })
        } catch (e) {
          // 3MF files can have structural issues - provide helpful error
          console.error('3MF parsing error:', e)
          throw new Error(`3MF file parsing failed. The file may be corrupted or use unsupported features. Error: ${e instanceof Error ? e.message : String(e)}`)
        }
        break
      }
      default:
        throw new Error(`Unsupported file format: ${extension}`)
    }

    if (object) {
      // Add to scene first
      scene.add(object)
      currentModel = object

      // Ensure all geometries have proper normals for lighting
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.computeVertexNormals()
          }
        }
      })

      // Many 3D formats use Z-up, but Three.js uses Y-up
      // Rotate -90 degrees around X-axis to convert Z-up to Y-up
      object.rotation.x = -Math.PI / 2

      // Calculate bounding box
      const box = new THREE.Box3().setFromObject(object)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())

      // Scale to fit (target size around 4 units)
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        const targetSize = 4
        const scale = targetSize / maxDim
        object.scale.multiplyScalar(scale)
      }

      // Recalculate box after scaling
      box.setFromObject(object)
      const scaledCenter = box.getCenter(new THREE.Vector3())
      const scaledSize = box.getSize(new THREE.Vector3())
      
      // Center the model horizontally (X and Z) but place bottom on the grid (Y=0)
      object.position.x -= scaledCenter.x
      object.position.z -= scaledCenter.z
      object.position.y -= (scaledCenter.y - scaledSize.y / 2) // Bottom at Y=0

      // Position camera to view the model
      camera.position.set(6, 4, 6)
      camera.lookAt(0, 0, 0) // Look at origin

      if (controls) {
        controls.target.set(0, 0, 0) // Orbit around origin
        controls.update()
      }
    }

    loading.value = false
  } catch (err) {
    console.error('Error loading 3D model:', err)
    error.value = err instanceof Error ? err.message : String(err)
    loading.value = false
  }
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
}

const toggleGrid = () => {
  console.log('Toggle grid:', showGrid.value, gridHelper)
  if (gridHelper) {
    gridHelper.visible = showGrid.value
  }
}

const toggleAxes = () => {
  console.log('Toggle axes:', showAxes.value, axesHelper)
  if (axesHelper) {
    axesHelper.visible = showAxes.value
  }
}

const changeRenderMode = () => {
  console.log('Change render mode:', renderMode.value, currentModel)
  if (!currentModel) {
    console.log('No current model')
    return
  }

  // Remove any existing point clouds first
  const toRemove: THREE.Object3D[] = []
  currentModel.traverse((child) => {
    if (child instanceof THREE.Points) {
      toRemove.push(child)
    }
  })
  toRemove.forEach(obj => {
    if (obj.parent) obj.parent.remove(obj)
  })

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
          // Hide mesh and create point cloud
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

  console.log('Render mode changed successfully')
}

const changeModelColor = (color: string) => {
  console.log('Change model color:', color)
  modelColor.value = color
  
  if (!currentModel) {
    console.log('No current model')
    return
  }

  const threeColor = new THREE.Color(color)
  
  currentModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material
      if (material && 'color' in material) {
        (material as any).color = threeColor.clone()
        // Ensure good shading properties
        if ('specular' in material) {
          (material as any).specular = new THREE.Color(0x444444)
        }
        if ('shininess' in material) {
          (material as any).shininess = 30
        }
      }
    }
  })
  
  console.log('Model color changed successfully')
}

const changeLighting = () => {
  console.log('Change lighting:', lightingMode.value)
  
  if (!ambientLight || !directionalLight1 || !directionalLight2) {
    console.log('Lights not initialized')
    return
  }

  switch (lightingMode.value) {
    case 'bright':
      // Balanced lighting with good form visibility
      ambientLight.intensity = 0.4
      directionalLight1.intensity = 1.0
      directionalLight1.position.set(5, 5, 5)
      directionalLight2.intensity = 0.5
      directionalLight2.position.set(-3, -2, -3)
      break
      
    case 'soft':
      // Soft, even lighting with gentle shadows
      ambientLight.intensity = 0.6
      directionalLight1.intensity = 0.6
      directionalLight1.position.set(2, 4, 2)
      directionalLight2.intensity = 0.4
      directionalLight2.position.set(-2, -2, -2)
      break
      
    case 'dramatic':
      // Strong directional lighting with deep shadows
      ambientLight.intensity = 0.2
      directionalLight1.intensity = 1.5
      directionalLight1.position.set(4, 6, 3)
      directionalLight2.intensity = 0.2
      directionalLight2.position.set(-2, -1, -2)
      break
  }
  
  console.log('Lighting changed successfully')
}

onMounted(() => {
  // Initialize scene first
  initScene()
  
  // Then load model if URL is available
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
/* Component-specific styles if needed */
</style>
