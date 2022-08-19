const { join } = require('path')
const { exit } = require('process')
const { buildSync } = require('esbuild')
const { nodeFileTrace } = require('@vercel/nft')
const { DeploymentBuilder } = require('@layer0/core/deploy')

const appDir = process.cwd()
const builder = new DeploymentBuilder(appDir)

module.exports = async function build(options) {
  try {
    builder.clearPreviousBuildOutput()
    builder.removeSync(join(appDir, 'build'))
    let command = 'npx tailwindcss -m -i ./styles/app.css -o app/styles/app.css && npx remix build'
    await builder.exec(command)
    builder.addJSAsset(join(appDir, 'build'))
    buildSync({
      entryPoints: [`${appDir}/sw/service-worker.js`],
      outfile: `${appDir}/dist/service-worker.js`,
      minify: true,
      bundle: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.LAYER0_PREFETCH_HEADER_VALUE': '"1"',
        'process.env.LAYER0_PREFETCH_CACHE_NAME': '"prefetch"',
      },
    })
    let dictNodeModules = await getNodeModules()
    Object.keys(dictNodeModules).forEach(async (i) => {
      await builder.addJSAsset(`${appDir}/${i}`)
    })
    await builder.build()
  } catch (e) {
    console.log(e)
    exit()
  }
}

async function getNodeModules() {
  const files = ['./server.js']
  const { fileList } = await nodeFileTrace(files)
  let packages = {}
  fileList.forEach((i) => {
    if (i.includes('node_modules/')) {
      let temp = i.replace('node_modules/', '')
      temp = temp.substring(0, temp.indexOf('/'))
      packages[`node_modules/${temp}`] = true
    } else {
      packages[i] = true
    }
  })
  return Object.keys(packages)
    .sort()
    .reduce((obj, key) => {
      obj[key] = packages[key]
      return obj
    }, {})
}
