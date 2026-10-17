import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import test from 'node:test'
import { prepareMacDownloads, verifyNativeMac } from './prepare-mac-downloads.mjs'

test('Mac packaging isolates architectures and files, hashes real bytes, and fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-mac-downloads-'))
  const version = '0.1.18', licensePath = join(root, 'LICENSE')
  // Container fixtures only; these are not usable installers or evidence of Mac runtime support.
  const dmg = Buffer.alloc(1024); dmg.write('koly', 512)
  const zip = Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3])
  const verified = async ({ architecture }) => ({ minimumOS: '13.0', signing: 'test-fixture', notarization: 'not-verified', bundleArchitecture: architecture })
  try {
    await writeFile(licensePath, 'MIT fixture')
    await writeFile(join(root, 'private-history.json'), 'NEVER SHIP')
    for (const architecture of ['arm64', 'x64']) {
      await writeFile(join(root, `Terminal Buddy-${version}-mac-${architecture}.dmg`), dmg)
      await writeFile(join(root, `Terminal Buddy-${version}-mac-${architecture}.zip`), zip)
      const options = { releaseDir: root, version, architecture, licensePath }
      const { output, manifest } = await prepareMacDownloads(options, verified)
      assert.equal(manifest.architecture, architecture)
      assert.deepEqual((await readdir(output)).sort(), [
        'INSTALL.txt', 'LICENSE.txt', 'SHA256SUMS.txt', 'manifest.json',
        `Terminal-Buddy-${version}-mac-${architecture}.dmg`, `Terminal-Buddy-${version}-mac-${architecture}.zip`
      ].sort())
      for (const asset of manifest.downloads) {
        const bytes = await readFile(join(output, asset.filename))
        assert.equal(asset.bytes, bytes.length)
        assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'))
        assert.ok((await readFile(join(output, 'SHA256SUMS.txt'), 'utf8')).includes(`${asset.sha256}  ${asset.filename}\n`))
      }
      const before = await readFile(join(output, 'manifest.json'), 'utf8')
      await assert.rejects(prepareMacDownloads(options, async () => { throw Error('wrong bundle version') }), /wrong bundle version/)
      await writeFile(join(root, `Terminal Buddy-${version}-mac-${architecture}.zip`), '<html>Not an archive</html>')
      await assert.rejects(prepareMacDownloads(options, verified), /Invalid ZIP/)
      assert.equal(await readFile(join(output, 'manifest.json'), 'utf8'), before)
    }
    await assert.rejects(prepareMacDownloads({ releaseDir: root, version: '../oops', architecture: 'arm64', licensePath }, verified), /Invalid release version/)
    await assert.rejects(prepareMacDownloads({ releaseDir: root, version, architecture: 'universal', licensePath }, verified), /Invalid Mac architecture/)
    await writeFile(join(root, `Terminal Buddy-${version}-mac-arm64.dmg`), Buffer.alloc(1024))
    await assert.rejects(prepareMacDownloads({ releaseDir: root, version, architecture: 'arm64', licensePath }, verified), /Invalid DMG/)
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
    await rm(root, { recursive: true, force: true })
  }
})

test('native validation refuses the wrong host before running commands', async () => {
  const architecture = process.platform === 'darwin' && process.arch === 'arm64' ? 'x64' : 'arm64'
  await assert.rejects(verifyNativeMac({ architecture }), /Run on a Mac of the requested architecture/)
})
