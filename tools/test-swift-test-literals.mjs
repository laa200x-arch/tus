import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = join(process.cwd(), 'TuSTests')
const offenders = []

for (const file of readdirSync(root).filter((name) => name.endsWith('.swift'))) {
  readFileSync(join(root, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
    const delimiters = line.match(/"""/g)?.length ?? 0
    if (delimiters > 1) offenders.push(`${file}:${index + 1}`)
  })
}

assert.deepEqual(offenders, [], `Swift multi-line delimiters cannot open and close on one line: ${offenders.join(', ')}`)
console.log('PASS | Swift test multi-line strings use legal delimiter layout')
