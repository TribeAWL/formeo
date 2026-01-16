// copy-scss.mjs
import { promises as fs } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

async function copyDirectory(srcDir, destDir) {
  // Create destination directory if it doesn't exist
  await fs.mkdir(destDir, { recursive: true })

  // Read all items in the source directory
  const items = await fs.readdir(srcDir, { withFileTypes: true })

  for (const item of items) {
    const srcPath = join(srcDir, item.name)
    const destPath = join(destDir, item.name)

    if (item.isDirectory()) {
      // Recursively copy subdirectories
      await copyDirectory(srcPath, destPath)
    } else if (item.isFile() && item.name.endsWith('.scss')) {
      // Copy only SCSS files
      await fs.copyFile(srcPath, destPath)
    }
  }
}

// Entry point
async function main() {
  const srcDir = resolve(projectRoot, 'src/lib/sass')
  const destDir = resolve(projectRoot, 'dist/sass')

  try {
    await copyDirectory(srcDir, destDir)
    console.log(`Copied SCSS files from ${srcDir} to ${destDir}`)
  } catch (error) {
    console.error(`Error copying SCSS files: ${error.message}`)
    process.exit(1)
  }
}

main()
