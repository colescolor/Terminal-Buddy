import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000 })
  if (result.error || result.status !== 0) throw Error(`${command} verification failed: ${result.error?.message ?? result.stderr}`)
  return result.stdout + result.stderr
}

export async function checkMacContainer(file, extension) {
  const handle = await open(file, 'r')
  try {
    const size = (await handle.stat()).size
    const bytes = Buffer.alloc(4)
    if (extension === 'dmg') {
      if (size < 512) throw Error('Invalid DMG: missing UDIF trailer')
      await handle.read(bytes, 0, 4, size - 512)
      if (bytes.toString('ascii') !== 'koly') throw Error('Invalid DMG: missing UDIF trailer')
    } else if (extension === 'zip') {
      await handle.read(bytes, 0, 4, 0)
      if (!bytes.equals(Buffer.from([0x50, 0x4b, 3, 4]))) throw Error('Invalid ZIP header')
    } else throw Error('Unsupported Mac container')
  } finally { await handle.close() }
}

/** Native checks are mandatory for the CLI; no Windows-built artifact is mislabeled as tested. */
export async function verifyNativeMac({ releaseDir, version, architecture, inputs }) {
  if (process.platform !== 'darwin' || process.arch !== architecture) throw Error('Run on a Mac of the requested architecture or the matching GitHub macOS runner.')
  const app = join(releaseDir, architecture === 'arm64' ? 'mac-arm64' : 'mac', 'Terminal Buddy.app')
  const plist = join(app, 'Contents', 'Info.plist')
  const readPlist = key => run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]).trim()
  if (readPlist('CFBundleShortVersionString') !== version) throw Error('Packaged app version does not match package.json')
  if (readPlist('CFBundleIdentifier') !== 'com.terminalbuddy.app') throw Error('Unexpected application bundle')
  const minimumOS = readPlist('LSMinimumSystemVersion')
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(minimumOS) || Number(minimumOS.split('.')[0]) < 13) throw Error('Electron 44 requires macOS 13 or newer')
  const binary = join(app, 'Contents', 'MacOS', 'Terminal Buddy')
  const machine = run('/usr/bin/lipo', ['-archs', binary]).trim()
  if (machine !== (architecture === 'arm64' ? 'arm64' : 'x86_64')) throw Error(`Wrong executable architecture: ${machine}`)
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app])
  const signature = run('/usr/bin/codesign', ['-dv', '--verbose=4', app])
  const signing = signature.includes('Signature=adhoc') ? 'ad-hoc' :
    signature.includes('Authority=Developer ID Application:') ? 'developer-id' : 'other'
  for (const asset of inputs) {
    if (asset.extension === 'dmg') run('/usr/bin/hdiutil', ['verify', asset.path])
    else run('/usr/bin/unzip', ['-tq', asset.path])
  }
  // Container integrity and signing do not establish notarization or downloaded-app launch.
  return { minimumOS, signing, notarization: 'not-verified', containerIntegrity: 'passed', bundleArchitecture: architecture }
}

export async function prepareMacDownloads({ releaseDir, version, architecture, licensePath }, verifyNative = verifyNativeMac) {
  if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?$/.test(version)) throw Error('Invalid release version')
  if (!['arm64', 'x64'].includes(architecture)) throw Error('Invalid Mac architecture')
  const license = await readFile(licensePath, 'utf8')
  const inputs = ['dmg', 'zip'].map(extension => ({ extension,
    path: join(releaseDir, `Terminal Buddy-${version}-mac-${architecture}.${extension}`),
    filename: `Terminal-Buddy-${version}-mac-${architecture}.${extension}` }))
  for (const asset of inputs) await checkMacContainer(asset.path, asset.extension)
  const verification = await verifyNative({ releaseDir, version, architecture, inputs })
  // All validation precedes output changes; never copy profiles or the broad release folder.
  const output = join(releaseDir, 'mac-downloads', architecture)
  await mkdir(output, { recursive: true })
  const downloads = []
  for (const asset of inputs) {
    const destination = join(output, asset.filename)
    await copyFile(asset.path, destination)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(destination)) hash.update(chunk)
    downloads.push({ id: asset.extension === 'dmg' ? 'installer' : 'archive', filename: asset.filename,
      bytes: (await stat(destination)).size, sha256: hash.digest('hex') })
  }
  const manifest = { version, platform: 'darwin', architecture, license: 'MIT', verification, downloads }
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(output, 'SHA256SUMS.txt'), downloads.map(asset => `${asset.sha256}  ${asset.filename}\n`).join(''))
  await writeFile(join(output, 'LICENSE.txt'), license)
  await writeFile(join(output, 'INSTALL.txt'), `Terminal Buddy ${version} — macOS ${verification.minimumOS}+ (${architecture})\n\nOpen the DMG and drag Terminal Buddy to Applications. Install and sign in to Claude Code or Codex separately.\n\nSigning: ${verification.signing}. Notarization: ${verification.notarization}.\nAd-hoc test builds are not Developer ID signed or notarized. Gatekeeper may block a downloaded test build; this is not a public-ready installer. Do not disable system security protections.\n\nQuit the app before moving it from Applications to Trash to uninstall. User settings are stored separately.\n`)
  return { output, manifest }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !/^--arch=(arm64|x64)$/.test(args[0])) throw Error('Usage: npm run downloads:mac -- --arch=arm64 (or x64)')
  const { version } = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
  const result = await prepareMacDownloads({ releaseDir: join(project, 'release'), version,
    architecture: args[0].slice(7), licensePath: join(project, 'LICENSE') })
  console.log(`Verified Mac package: ${result.output}`)
  console.log(JSON.stringify(result.manifest, null, 2))
}
