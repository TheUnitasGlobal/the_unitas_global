import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'site-dist')

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(resolve(root, 'index.html'), resolve(dist, 'index.html'))
await cp(resolve(root, 'pages'), resolve(dist, 'pages'), { recursive: true })
await cp(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true })
await cp(resolve(root, 'CNAME'), resolve(dist, 'CNAME'))

console.log('Built static site in site-dist/')
