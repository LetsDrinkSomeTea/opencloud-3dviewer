<template>
  <div class="ext:flex ext:flex-col ext:h-full">
    <div v-if="error" class="ext:p-4 ext:text-red-600">
      <p>{{ $gettext('Error loading 3D model:') }} {{ error }}</p>
    </div>
    <div v-else-if="loading" class="ext:p-4">
      <p>{{ $gettext('Loading 3D model...') }}</p>
    </div>
    <div ref="canvasContainer" class="ext:flex-1 ext:relative ext:bg-gray-100" @wheel="onWheel" />
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

const { currentContent, currentFileContext } = defineProps<{
  currentContent: string
  currentFileContext: {
    name?: string
    path?: string
    extension?: string
  }
}>()

const canvasContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationFrameId: number | null = null
let currentModel: THREE.Object3D | null = null

const initScene = () => {
  if (!canvasContainer.value) return

  // Create scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf3f4f6)

  // Create camera
  const container = canvasContainer.value
  const aspect = container.clientWidth / container.clientHeight
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000)
  camera.position.set(0, 0, 5)

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight1.position.set(1, 1, 1)
  scene.add(directionalLight1)

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
  directionalLight2.position.set(-1, -1, -1)
  scene.add(directionalLight2)

  // Add grid helper
  const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc)
  scene.add(gridHelper)

  // Add orbit controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.screenSpacePanning = false
  controls.minDistance = 0.1
  controls.maxDistance = 1000

  // Handle window resize
  window.addEventListener('resize', onWindowResize)

  // Start animation loop
  animate()
}

const animate = () => {
  animationFrameId = requestAnimationFrame(animate)
  if (controls) controls.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

const onWindowResize = () => {
  if (!canvasContainer.value || !camera || !renderer) return

  const container = canvasContainer.value
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
}

const onWheel = (event: WheelEvent) => {
  // Prevent default scroll behavior
  event.preventDefault()
}

const loadModel = async () => {
  if (!scene || !camera || !currentContent || !currentFileContext) return

  loading.value = true
  error.value = null

  // Remove previous model
  if (currentModel) {
    // Dispose of geometries and materials to free GPU memory
    currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose()
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
    scene.remove(currentModel)
    currentModel = null
  }

  try {
    // Get the file extension from currentFileContext.extension or extract from filename
    let extension = currentFileContext.extension?.toLowerCase() || ''

    // If extension is not provided, try to extract it from the filename or path
    if (!extension) {
      const fileName = currentFileContext.name || currentFileContext.path || ''
      const match = fileName.match(/\.([^./\\]+)$/)
      if (match) {
        extension = match[1].toLowerCase()
      }
    }

    // Determine if currentContent is a URL or actual content
    let url: string
    let needsCleanup = false

    if (currentContent.startsWith('data:') || currentContent.startsWith('blob:') ||
        currentContent.startsWith('http://') || currentContent.startsWith('https://')) {
      // currentContent is already a URL (data URL, blob URL, or http URL)
      // Use it directly without creating a new blob
      url = currentContent
    } else {
      // currentContent contains actual file content
      // Convert to blob and create object URL
      const blob: Blob = new Blob([currentContent], { type: 'text/plain' })
      // For text-based formats like OBJ, create a text blob
      // For binary formats, we'd need the raw data, but in practice
      // binary files should come as URLs from the framework
      url = URL.createObjectURL(blob)
      needsCleanup = true
    }

    let object: THREE.Object3D | null = null

    // Create a shared material for efficiency
    const sharedMaterial = new THREE.MeshPhongMaterial({
      color: 0x9333ea,
      specular: 0x111111,
      shininess: 200
    })

    switch (extension) {
      case 'stl': {
        const loader = new STLLoader()
        const geometry = await loader.loadAsync(url)
        object = new THREE.Mesh(geometry, sharedMaterial)
        break
      }
      case 'obj': {
        const loader = new OBJLoader()
        object = await loader.loadAsync(url)
        // Apply purple color to all meshes in the object
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = sharedMaterial
          }
        })
        break
      }
      case 'ply': {
        const loader = new PLYLoader()
        const geometry = await loader.loadAsync(url)
        const material = new THREE.MeshPhongMaterial({
          color: 0x9333ea,
          specular: 0x111111,
          shininess: 200,
          vertexColors: geometry.hasAttribute('color')
        })
        object = new THREE.Mesh(geometry, material)
        break
      }
      case 'gltf':
      case 'glb': {
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(url)
        object = gltf.scene
        break
      }
      case '3mf': {
        const loader = new ThreeMFLoader()
        object = await loader.loadAsync(url)
        // Apply purple color to all meshes
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = sharedMaterial
          }
        })
        break
      }
      default:
        throw new Error(`Unsupported file format: ${extension}`)
    }

    if (needsCleanup) {
      URL.revokeObjectURL(url)
    }

    if (object) {
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      // Center the model
      object.position.sub(center)

      // Scale the model to fit in view
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        const scale = 2 / maxDim
        object.scale.multiplyScalar(scale)
      }

      // Add to scene
      scene.add(object)
      currentModel = object

      // Adjust camera position
      const distance = maxDim * 2
      camera.position.set(distance, distance * 0.5, distance)
      camera.lookAt(0, 0, 0)

      if (controls) {
        controls.target.set(0, 0, 0)
        controls.update()
      }
    }

    loading.value = false
  } catch (err) {
    console.error('Error loading 3D model:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error'
    loading.value = false
  }
}

onMounted(() => {
  initScene()
  loadModel()
})

watch(() => currentContent, loadModel)

onBeforeUnmount(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  if (controls) {
    controls.dispose()
  }
  if (renderer) {
    renderer.dispose()
  }
  window.removeEventListener('resize', onWindowResize)
})
</script>
