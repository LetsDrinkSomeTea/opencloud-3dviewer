# OpenCloud 3D Model Viewer

OpenCloud 3D Model Viewer - View 3D models (3mf, obj, stl, and more) in the browser.

This webapp allows you to view 3D model files directly in your OpenCloud instance. It supports various 3D file formats including:

- **3MF** (3D Manufacturing Format)
- **STL** (Stereolithography - ASCII and binary)
- **OBJ** (Wavefront Object)
- **PLY** (Polygon File Format - ASCII and binary)
- **GLTF/GLB** (GL Transmission Format - text and binary)

The viewer uses Three.js for rendering and provides interactive controls to rotate, zoom, and pan the 3D models.

## Disclaimer

I'm by no means a web developer, this app was created with heavy use of AI.
Therefore the app only is mentioned in the [opencloud-eu/awesome-apps](https://github.com/opencloud-eu/awesome-apps), but will not be featured in the App Store until I have time to properly develop and check the app.

Hopefully the app still is useful for someone.

## Known Issues

- Some Files contain unsupported data. Issue is on the side of three.js, nothing I can do about it

## Contribution

PRs are welcome.

## Development Environment

Currently local development requires docker and is only supported on Linux and macOS.

1. Make sure you have a working docker- and docker compose environment running.
1. Install [pnpm](https://pnpm.io/installation) if you haven't already.

   > **Correct version:** Our `package.json` holds a `packageManager` field. Please make sure that you have at least the same major version of pnpm installed.

   > **Corepack:** We recommend to use [pnpm with corepack](https://pnpm.io/installation#using-corepack) to handle the pnpm version automatically.

1. Install dependencies and run a first build process by running:
   ```bash
   pnpm install && pnpm build:w
   ```
   In case you see errors about failed commands (such as Command "vite" not found) try to re-run the pnpm command.
1. Add `127.0.0.1 host.docker.internal` to your `/etc/hosts` file to make sure the address host.docker.internal can be resolved locally.
1. Start the development server:
   ```bash
   docker compose up
   ```
1. Open your browser and navigate to `https://host.docker.internal:9200` to see your OpenCloud dev environment. The default user is `admin` with password `admin`. Your app from this directory is automatically loaded.
