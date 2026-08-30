/* Full-content page history for desktop flows.  It carries page data only;
 * rendering remains owned by views.js so one state stack serves every route. */
(function registerContentPageHistory(root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.ContentPageHistory = api
})(globalThis, function createContentPageHistoryAPI() {
  function createContentPageHistory() {
    const stack = []
    return {
      push(target) { stack.push(target) },
      pop() {
        if (stack.length < 2) return null
        stack.pop()
        return stack.at(-1)
      },
      current() { return stack.at(-1) || null },
      canPop() { return stack.length > 1 },
      reset() { stack.length = 0 }
    }
  }

  return { createContentPageHistory }
})
