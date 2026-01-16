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
  {
    src: resolve(projectRoot, 'dist/formeo.umd.js'),
    dest: resolve(projectRoot, 'dist/'),
    rename: 'formeo.min.js',
  },
  {
    src: resolve(projectRoot, 'dist/*.js'),
    dest: resolve(projectRoot, 'dist/demo/assets/js/'),
  },
  {
    src: resolve(projectRoot, 'dist/formeo.min.css'),
    dest: resolve(projectRoot, 'dist/demo/assets/css/'),
  },
]

async function copyFile(src, dest, rename = null) {
  for await (const file of fs.glob(src)) {
    const destPath = rename ? join(dest, rename) : join(dest, basename(file))
    await fs.mkdir(dirname(destPath), { recursive: true })
    await fs.copyFile(file, destPath)
  }
}

// Entry point
async function main() {
  for (const target of targets) {
    try {
      await copyFile(target.src, target.dest, target.rename)
      console.log(`Copied ${basename(target.src)} to ${target.dest}`)
    } catch (error) {
      console.error(`Error copying file: ${error.message}`)
    }
  }

  // After copying, if demo CSS exists, append it to dist/formeo.min.css so package consumers receive demo overrides
  try {
    const demoCssGlob = resolve(projectRoot, 'dist/demo/assets/css/*.css')
    const outCss = resolve(projectRoot, 'dist/formeo.min.css')
    const demoFiles = []
    for await (const f of fs.glob(demoCssGlob)) demoFiles.push(f)
    if (demoFiles.length) {
      let outExists = false
      try {
        await fs.access(outCss)
        outExists = true
      } catch (e) {
        outExists = false
      }
      let outContent = ''
      if (outExists) outContent = await fs.readFile(outCss, 'utf8')
      for (const demoFile of demoFiles) {
        const demoContent = await fs.readFile(demoFile, 'utf8')
        outContent += `\n\n/* Demo overrides from ${basename(demoFile)} */\n` + demoContent
      }
      await fs.mkdir(dirname(outCss), { recursive: true })
      await fs.writeFile(outCss, outContent, 'utf8')
      console.log(`Appended demo CSS (${demoFiles.length} files) into ${outCss}`)
    }
  } catch (err) {
    console.error(`Error appending demo CSS: ${err.message}`)
  }
}

main()
