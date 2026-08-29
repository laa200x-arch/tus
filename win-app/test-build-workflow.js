const assert = require('assert')
const fs = require('fs')
const path = require('path')

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build-ipa.yml'), 'utf8')

assert.ok(
  workflow.includes("-destination 'generic/platform=iOS Simulator'"),
  'unit-test compilation must use the generic iOS Simulator destination, not a runner-specific device name'
)
assert.ok(
  workflow.includes('build-for-testing 2>&1 | tee xcode-test.log'),
  'unit-test compilation must not require an installed simulator runtime'
)
assert.ok(
  !/name=iPhone\s*16\s*Pro/.test(workflow),
  'workflow must not hard-code iPhone 16 Pro'
)

console.log('PASS | iOS CI compiles tests without depending on a named simulator')
