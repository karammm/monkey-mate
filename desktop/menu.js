// Momo's click menu: each row is an action; the field hands a request to Claude's prompt box.

for (const button of document.querySelectorAll('button[data-action]')) {
  button.addEventListener('click', () => window.menu.act({ action: button.dataset.action }))
}

const field = document.getElementById('ask-text')
document.getElementById('ask').addEventListener('submit', event => {
  event.preventDefault()
  const text = field.value.trim()
  if (text) window.menu.act({ action: 'ask', text })
  field.value = ''
})

window.menu.onOpen(({ isPlaying, muted, listenForName, canTalk, isListening }) => {
  document.getElementById('tune-label').textContent = isPlaying ? 'Stop the tune' : 'Play a tune'
  document.getElementById('talk').hidden = !canTalk
  document.getElementById('talk-label').textContent = isListening ? 'Stop listening' : 'Talk to Momo'
  document.getElementById('mute-label').textContent = muted ? 'Unmute Momo' : 'Mute Momo'
  document.getElementById('mute-icon').textContent = muted ? '🔊' : '🔇'
  document.getElementById('listen-row').hidden = !canTalk
  document.getElementById('listen-label').textContent = `Listen for “Momo”: ${listenForName ? 'on' : 'off'}`
  field.value = ''
  field.focus()
})

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') window.menu.act({ action: 'close' })
})

// Tell the window how tall the menu is, so it fits exactly.
window.menu.size(Math.ceil(document.body.scrollHeight))
