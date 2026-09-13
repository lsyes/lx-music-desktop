const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const sqliteDir = path.join(__dirname, '../node_modules/better-sqlite3')
const bindingFilePath = path.join(sqliteDir, 'binding.gyp')
const bindingBakFilePath = path.join(sqliteDir, 'binding.gyp.bak')
const sqliteLibPath = path.join(sqliteDir, 'build/Release/better_sqlite3.node')

exports.isBuildFromSource = (arch) => arch === 'loong64'

const resolveFrom = (searchPath) => {
  try {
    return require.resolve('node-gyp/bin/node-gyp.js', { paths: [searchPath] })
  } catch (_) {
    return null
  }
}

const resolveNodeGyp = () => resolveFrom(path.join(__dirname, '../node_modules')) ?? resolveFrom(path.join(__dirname, '../node_modules/.pnpm/node_modules'))

const buildSqliteFromSource = () => {
  if (fs.existsSync(sqliteLibPath)) return
  console.log('build better-sqlite3 from source...')
  if (!fs.existsSync(bindingFilePath) && fs.existsSync(bindingBakFilePath)) fs.renameSync(bindingBakFilePath, bindingFilePath)
  const nodeGyp = resolveNodeGyp()
  const { status, error } = spawnSync(
    nodeGyp ? process.execPath : 'node-gyp',
    [...(nodeGyp ? [nodeGyp] : []), 'rebuild', '--release', '--force_build=1'],
    { cwd: sqliteDir, stdio: 'inherit' },
  )
  if (status !== 0) throw error ?? new Error('Failed to build better-sqlite3 from source')
}

exports.beforePack = async(buildFromSource = false) => {
  if (buildFromSource || !fs.existsSync(bindingFilePath)) return
  fs.renameSync(bindingFilePath, bindingBakFilePath)
  // try {
  //   fs.writeFileSync(
  //     bindingFilePath,
  //     fs.readFileSync(bindingFilePath, 'utf-8').replace('\'force_build%\': 0,', '\'force_build%\': 1,'),
  //   )
  // } catch (error) {
  //   console.error(error)
  // }
}
exports.afterPack = async() => {
  if (fs.existsSync(bindingFilePath)) return
  fs.renameSync(bindingBakFilePath, bindingFilePath)
  // try {
  //   fs.writeFileSync(
  //     bindingFilePath,
  //     fs.readFileSync(bindingFilePath, 'utf-8').replace('\'force_build%\': 1,', '\'force_build%\': 0,'),
  //   )
  // } catch (error) {
  //   console.error(error)
  // }
}


const replaceSqliteLib = async(arch) => {
  // console.log(await fs.readdir(path.join(context.appOutDir, './resources/')))
  // if (context.electronPlatformName != 'linux' || context.arch != Arch.arm64) return
  // https://github.com/lyswhut/lx-music-desktop/issues/1102
  // https://github.com/lyswhut/lx-music-desktop/issues/1161
  console.log('replace sqlite lib...')
  const filePath = path.join(__dirname, `./lib/better_sqlite3_${process.platform}-${arch}.node`)
  console.log(filePath)
  const targetPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  await fs.promises.unlink(targetPath).catch(_ => _)
  await fs.promises.copyFile(filePath, targetPath)
}
exports.copyLib = async(arch = process.arch, replaceLocal = false) => {
  if (exports.isBuildFromSource(arch)) {
    buildSqliteFromSource()
    return
  }
  if (process.platform === 'linux' || replaceLocal) {
    await replaceSqliteLib(arch)
    return
  }
  const libPath = path.join(__dirname, `../node_modules/better-sqlite3/prebuilds/${process.platform}-${arch}.node`)
  if (!fs.existsSync(libPath)) {
    console.error(`Better-sqlite3 prebuild not found for ${process.platform}-${arch}`)
    return
  }
  const targetPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  await fs.promises.cp(libPath, targetPath, { recursive: true, force: true })
}
