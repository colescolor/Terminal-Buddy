import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Publish only these artifacts, never the entire release directory or a user profile. */
export async function prepareDownloads({ releaseDir, version, licensePath }) {
  if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?$/.test(version)) throw Error('Invalid release version')
  const assets = [
    { id: 'installer', source: `Terminal Buddy-${version}-x64.exe`, filename: 'Terminal-Buddy-Setup.exe' },
    { id: 'portable', source: `Terminal Buddy-${version}-portable.exe`, filename: 'Terminal-Buddy-Portable.exe' }
  ]
  // Validate all inputs before updating any website files. An old release must
  // never be silently relabeled as the version currently in package.json.
  const license = await readFile(licensePath, 'utf8')
  for (const asset of assets) {
    const input = join(releaseDir, asset.source)
    const file = await open(input, 'r')
    try {
      const header = Buffer.alloc(64)
      const { bytesRead } = await file.read(header, 0, header.length, 0)
      if (bytesRead !== 64 || header.toString('ascii', 0, 2) !== 'MZ') throw Error(`Not a Windows executable: ${asset.source}`)
      const signature = Buffer.alloc(4)
      await file.read(signature, 0, 4, header.readUInt32LE(60))
      if (!signature.equals(Buffer.from([0x50, 0x45, 0, 0]))) throw Error(`Missing PE signature: ${asset.source}`)
    } finally { await file.close() }
  }
  const output = join(releaseDir, 'website-downloads')
  await mkdir(output, { recursive: true })
  const downloads = []
  for (const asset of assets) {
    const destination = join(output, asset.filename)
    await copyFile(join(releaseDir, asset.source), destination)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(destination)) hash.update(chunk)
    downloads.push({ id: asset.id, filename: asset.filename, bytes: (await stat(destination)).size, sha256: hash.digest('hex') })
  }
  await writeFile(join(output, 'LICENSE.txt'), license)
  await writeFile(join(output, 'SHA256SUMS.txt'), downloads.map(a => `${a.sha256}  ${a.filename}\n`).join(''))
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ version, platform: 'win32', architecture: 'x64', license: 'MIT', downloads }, null, 2) + '\n')
  await writeFile(join(output, 'RELEASE-NOTES.md'), `# Terminal Buddy ${version}\n\nFree, MIT-licensed terminal app for Windows x64.\n\n- **Terminal-Buddy-Setup.exe**: recommended installer with Start menu and desktop shortcuts.\n- **Terminal-Buddy-Portable.exe**: run without installing. Preferences are still stored in your Windows user profile.\n\nThe app includes its runtime; Node.js is not required to run it. Install and sign in to your preferred coding assistants separately. Those services have their own terms and pricing.\n\nUnsigned builds can show a Windows unknown-publisher warning.\n\nSHA-256 checksums and the MIT license are included.\n`)
  return { output, downloads }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'))
  const result = await prepareDownloads({ releaseDir: join(project, 'release'), version, licensePath: join(project, 'LICENSE') })
  console.log(`Website downloads ready: ${result.output}`)
  for (const asset of result.downloads) console.log(`${asset.filename} (${(asset.bytes / 1024 / 1024).toFixed(1)} MiB) SHA-256 ${asset.sha256}`)
}
