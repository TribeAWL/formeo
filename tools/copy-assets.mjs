// copyDir.mjs
import { promises as fs } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const projectRoot = resolve(__dirname, '..')

const targets = [
  {
    src: resolve(projectRoot, 'src/lib/icons/formeo-sprite.svg'),
    dest: resolve(projectRoot, 'dist/demo/assets/img/'),
  },
  {
    src: resolve(projectRoot, 'src/lib/icons/formeo-sprite.svg'),
    dest: resolve(projectRoot, 'dist/'),
  },
  {
    src: resolve(projectRoot, 'node_modules', '@draggable/formeo-languages/dist/lang/*'),
    dest: resolve(projectRoot, 'dist/demo/assets/lang'),
  },
  // Copy all JS variants to demo
  {
    src: resolve(projectRoot, 'dist/formeo.*.js'),
    dest: resolve(projectRoot, 'dist/demo/assets/js/'),
  },
  // Copy CSS variants to demo
  {
    src: resolve(projectRoot, 'dist/formeo*.css'),
    dest: resolve(projectRoot, 'dist/demo/assets/css/'),
  },
  // Copy all demo JS (minified and unminified) to dist/
  {
    src: resolve(projectRoot, 'dist/demo/assets/js/*.js'),
    dest: resolve(projectRoot, 'dist/'),
  },
  // Copy all demo CSS (minified and unminified) to dist/
  {
    src: resolve(projectRoot, 'dist/demo/assets/css/*.css'),
    dest: resolve(projectRoot, 'dist/'),
  },
  // Copy schema files
  {
    src: resolve(projectRoot, 'dist/formData_schema.json'),
    dest: resolve(projectRoot, 'dist/demo/assets/'),
  },
  {
    src: resolve(projectRoot, 'dist/runtime_schema.json'),
    dest: resolve(projectRoot, 'dist/demo/assets/'),
  },
]

async function copyFile(src, dest, rename = null) {
  try {
    const stats = await fs.stat(src)

    if (stats.isDirectory()) {
      return
    }

    await fs.mkdir(dirname(dest), { recursive: true })

    const fileName = rename || basename(src)
    const destPath = join(dest, fileName)

    await fs.copyFile(src, destPath)
    console.log(`✓ Copied: ${src} → ${destPath}`)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`✗ Error copying ${src}: ${error.message}`)
    }
  }
}

async function copyGlob(pattern, dest) {
  try {
    const { globSync } = await import('glob')
    const files = globSync(pattern)

    for (const file of files) {
      await copyFile(file, dest)
    }
  } catch (error) {
    console.error(`✗ Error with glob pattern ${pattern}: ${error.message}`)
  }
}

// Entry point
async function main() {
  console.log('📁 Copying assets...')

  for (const target of targets) {
    if (target.src.includes('*')) {
      await copyGlob(target.src, target.dest)
    } else {
      await copyFile(target.src, target.dest, target.rename)
    }
  }

  console.log('✅ Asset copying completed')
}

main()
