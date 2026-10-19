// Packages Momo Desktop as Momo.app on macOS, so permission prompts say "Momo" (not "Electron") and the
// app can declare why it uses the microphone and speech recognition (push-to-talk).
// Momo.app is started with this folder as its argument (npm run start:mac), so edits here take effect on
// the next start.
//   node make-app.js               rebuild Momo.app
//   node make-app.js --if-missing  build it only when it is not there yet

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'darwin') {
  console.log('Momo.app is for macOS; elsewhere run: npm start')
  process.exit(0)
}

const app = path.join(__dirname, 'Momo.app')
if (process.argv.includes('--if-missing') && fs.existsSync(app)) process.exit(0)

const electron = path.join(__dirname, 'node_modules', 'electron', 'dist', 'Electron.app')
fs.rmSync(app, { recursive: true, force: true })
execFileSync('ditto', [electron, app])

const plist = path.join(app, 'Contents', 'Info.plist')
const set = (key, type, value) => {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, plist], { stdio: 'ignore' })
  } catch {}
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} ${type} ${value}`, plist])
}
set('CFBundleName', 'string', 'Momo')
set('CFBundleDisplayName', 'string', 'Momo')
set('CFBundleIdentifier', 'string', 'io.github.karammm.momo')
// A menu-bar companion: no Dock icon.
set('LSUIElement', 'bool', 'true')
set('NSMicrophoneUsageDescription', 'string', 'Momo listens only while you use push-to-talk.')
set('NSSpeechRecognitionUsageDescription', 'string', 'Momo turns what you say into text when you ask him to listen.')
set('NSAccessibilityUsageDescription', 'string', 'Momo finds where you are typing so he can sit beside it. He never reads your text.')

// His icon, from the 3D render (sprites/icon.png, made by scripts/bake.ts).
const iconSource = path.join(__dirname, 'sprites', 'icon.png')
if (fs.existsSync(iconSource)) {
  const iconset = path.join(__dirname, 'node_modules', '.momo.iconset')
  fs.rmSync(iconset, { recursive: true, force: true })
  fs.mkdirSync(iconset)
  for (const size of [16, 32, 64, 128, 256, 512]) {
    execFileSync('sips', ['-z', `${size}`, `${size}`, iconSource, '--out', path.join(iconset, `icon_${size}x${size}.png`)], { stdio: 'ignore' })
    execFileSync('sips', ['-z', `${size * 2}`, `${size * 2}`, iconSource, '--out', path.join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: 'ignore' })
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(app, 'Contents', 'Resources', 'electron.icns')])
  fs.rmSync(iconset, { recursive: true, force: true })
}

// Changing Info.plist breaks Electron's signature; sign it again for this Mac.
execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'ignore' })
console.log('Made Momo.app. Start Momo with: npm run start:mac')
