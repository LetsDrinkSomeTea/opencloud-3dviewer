import { defineWebApplication, Extension, AppWrapperRoute } from '@opencloud-eu/web-pkg'
import '@opencloud-eu/extension-sdk/tailwind.css'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import ModelViewer from './views/ModelViewer.vue'

const applicationId = '3dviewer'

export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()

    const appInfo = {
      id: applicationId,
      name: $gettext('3D Viewer'),
      icon: 'box-2',
      iconFillType: 'line' as const,
      iconColor: '#9333ea',
      extensions: [
        {
          extension: '3mf',
          routeName: '3dviewer',
          canBeDefault: true
        },
        {
          extension: 'obj',
          routeName: '3dviewer',
          canBeDefault: true
        },
        {
          extension: 'stl',
          routeName: '3dviewer',
          canBeDefault: true
        },
        {
          extension: 'ply',
          routeName: '3dviewer',
          canBeDefault: true
        },
        {
          extension: 'gltf',
          routeName: '3dviewer',
          canBeDefault: true
        },
        {
          extension: 'glb',
          routeName: '3dviewer',
          canBeDefault: true
        }
      ]
    }

    const routes: RouteRecordRaw[] = [
      {
        name: '3dviewer',
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(ModelViewer, {
          applicationId,
          urlForResourceOptions: {
            disposition: 'inline'
          }
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('3D Viewer'),
          patchCleanPath: true
        }
      }
    ]

    const extensions = () => {
      return computed<Extension[]>(() => {
        return []
      })
    }

    return {
      appInfo,
      routes,
      extensions: extensions()
    }
  }
})
