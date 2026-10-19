import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
const SITE = { scroll: { offset: 0, bodyRows: 30 }, view: {} }

test('the pane shows Momo and the speech bubble on every surface', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: 'monkey-mate',
      surface,
      component: 'Pane',
      requestId: 'momo',
      props: { title: 'Momo 🐒', isFocused: false, bodyColumns: 40, placement: 'dock', ...SITE },
      viewport: { columns: 40, rows: 30 },
    })
    expect(await ui.find({ type: 'Text', text: /Momo/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /coding buddy/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a narrow terminal gets the one-line band instead', async ($, on) => {
  mock.clock(on, { now: 1000 })

  const ui = await $.ui.mount({
    plugin: 'monkey-mate',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, ...SITE },
    viewport: { columns: 80, rows: 24 },
  })
  expect(await ui.find({ type: 'Text', text: /Momo:/ })).toBeDefined()
  await ui.unmount()
})
