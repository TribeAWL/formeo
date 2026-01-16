import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const expectedFiles = [
  'dist/formeo.es.js',
  'dist/formeo.min.es.js',
  'dist/formeo.cjs.js',
  'dist/formeo.min.cjs.js',
  'dist/formeo.umd.js',
  'dist/formeo.min.umd.js',
  'dist/formeo.css',
  'dist/formeo.min.css',
  'dist/formData_schema.json',
  'dist/runtime_schema.json',
  'dist/formeo-sprite.svg',
]

async function verifyBuild() {
  console.log('🔍 Verifying build output...')

  let allFilesExist = true

  for (const file of expectedFiles) {
    const filePath = resolve(projectRoot, file)

    try {
      await fs.access(filePath)
      const stats = await fs.stat(filePath)
      const sizeKB = Math.round(stats.size / 1024)
      console.log(`✓ ${file} (${sizeKB}KB)`)
    } catch {
      console.log(`✗ ${file} - MISSING`)
      allFilesExist = false
    }
  }

  if (allFilesExist) {
    console.log('\n✅ All expected files created successfully!')
  } else {
    console.log('\n❌ Some files are missing from the build')
    process.exit(1)
  }
}

verifyBuild()
