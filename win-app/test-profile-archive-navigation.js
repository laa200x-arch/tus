'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '..', 'TuS', 'Views', 'Profile', 'UserProfileView.swift'), 'utf8')

assert.match(source, /NavigationLink\s*\{\s*MyComplaintsView\(\)/s, 'My complaints metric must navigate')
assert.match(source, /NavigationLink\s*\{\s*FavoriteComplaintsView\(\)/s, 'Favorites metric must navigate')
assert.match(source, /NavigationLink\s*\{\s*MyStatusesArchiveView\(\)/s, 'My statuses metric must navigate')
assert.match(source, /NavigationLink\s*\{\s*MoodHistoryArchiveView\(\)/s, 'Mood history metric must navigate')

console.log('PASS | View Profile archive metrics navigate to full pages')
