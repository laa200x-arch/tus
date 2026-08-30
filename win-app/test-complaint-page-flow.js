const assert = require('node:assert/strict')

const { createContentPageHistory } = require('./src/page-history.js')

const history = createContentPageHistory()
history.push({ page: 'complaint-feed', title: '吐槽广场' })
history.push({ page: 'complaint-detail', complaintID: 'c-1', title: '吐槽详情' })

assert.equal(history.current().page, 'complaint-detail')
assert.equal(history.current().complaintID, 'c-1')
assert.equal(history.canPop(), true)
assert.deepEqual(history.pop(), { page: 'complaint-feed', title: '吐槽广场' })
assert.equal(history.canPop(), false)
assert.equal(history.pop(), null)

console.log('Complaint full-page history preserves a detail return target.')
