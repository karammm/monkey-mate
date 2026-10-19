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

window.menu.onOpen(({ isPlaying }) => {
  document.getElementById('tune-label').textContent = isPlaying ? 'Stop the tune' : 'Play a tune'
  field.value = ''
  field.focus()
})

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') window.menu.act({ action: 'close' })
})

// Tell the window how tall the menu is, so it fits exactly.
window.menu.size(Math.ceil(document.body.scrollHeight))
