// Shows one message in the glass bubble and reports its size, so the window can fit around it.

const glass = document.getElementById('glass')

window.bubble.onShow(({ text, kind }) => {
  glass.textContent = text
  glass.classList.toggle('thought', kind === 'thought')
  const { width, height } = glass.getBoundingClientRect()
  window.bubble.reportSize(Math.ceil(width), Math.ceil(height))
})
