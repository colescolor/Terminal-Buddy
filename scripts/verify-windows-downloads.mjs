import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import test from 'node:test'
import { prepareDownloads } from './prepare-windows-downloads.mjs'

test('website bundle contains only this version, with stable names and matching hashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-downloads-'))
  const version = '0.1.18', licensePath = join(root, 'LICENSE')
  const exe = Buffer.alloc(128)
  exe.write('MZ'); exe.writeUInt32LE(64, 60); exe.write('PE\0\0', 64)
  try {
    await writeFile(licensePath, 'MIT test license')
    await writeFile(join(root, `Terminal Buddy-${version}-x64.exe`), exe)
    await writeFile(join(root, `Terminal Buddy-${version}-portable.exe`), exe)
    await writeFile(join(root, 'private-profile.json'), 'must not ship')
    await writeFile(join(root, 'Terminal Buddy-0.1.0-x64.exe'), 'old release')
    const { output } = await prepareDownloads({ releaseDir: root, version, licensePath })
    assert.deepEqual((await readdir(output)).sort(), ['LICENSE.txt', 'RELEASE-NOTES.md', 'SHA256SUMS.txt', 'Terminal-Buddy-Portable.exe', 'Terminal-Buddy-Setup.exe', 'manifest.json'].sort())
    const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))
    assert.equal(manifest.version, version)
    for (const asset of manifest.downloads) {
      assert.deepEqual(await readFile(join(output, asset.filename)), exe)
      assert.equal(asset.bytes, exe.length)
      assert.equal(asset.sha256, createHash('sha256').update(exe).digest('hex'))
      assert.ok((await readFile(join(output, 'SHA256SUMS.txt'), 'utf8')).includes(`${asset.sha256}  ${asset.filename}\n`))
    }
    await assert.rejects(prepareDownloads({ releaseDir: root, version: '0.1.19', licensePath }), /ENOENT/)
    await assert.rejects(prepareDownloads({ releaseDir: root, version: '../bad', licensePath }), /Invalid release version/)
    await writeFile(join(root, `Terminal Buddy-${version}-portable.exe`), '<html>download failed</html>')
    await assert.rejects(prepareDownloads({ releaseDir: root, version, licensePath }), /Not a Windows executable/)
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).version, version)
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
    await rm(root, { recursive: true, force: true })
  }
})
