'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, 'src', 'views.js'), 'utf8')
const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8')
const swift = fs.readFileSync(path.join(__dirname, '..', 'TuS', 'Views', 'Chat', 'MessageView.swift'), 'utf8')

assert.match(source, /message-reference-header/, 'Windows message screen needs the reference-style conversation header')
assert.match(source, /chat-composer-shell/, 'Windows message screen needs the rounded reference composer')
assert.match(css, /\.chat-composer-shell\s*\{/, 'Windows composer style is required')
assert.match(swift, /messageReferenceHeader/, 'iOS chat detail needs the reference-style header')
assert.match(swift, /messageComposerShell/, 'iOS chat detail needs the reference-style composer')

console.log('PASS | Messages adopt the reference header and composer layout')
