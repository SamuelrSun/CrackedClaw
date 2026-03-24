/**
 * content-glow.js — Injected into controlled tabs to show/hide an orange glow border.
 * Called via chrome.scripting.executeScript from background.js.
 *
 * Expects `args[0]` to be 'add' or 'remove'.
 */
;(function (action) {
  const GLOW_ID = 'dopl-cowork-glow'

  if (action === 'add') {
    if (document.getElementById(GLOW_ID)) return
    const el = document.createElement('div')
    el.id = GLOW_ID
    el.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 2147483647',
      'pointer-events: none',
      'border: 3px solid #f97316',
      'box-shadow: inset 0 0 30px rgba(249, 115, 22, 0.12)',
      'border-radius: 0',
      'transition: opacity 0.3s ease',
      'opacity: 1',
    ].join('; ')
    document.documentElement.appendChild(el)
  } else if (action === 'remove') {
    const el = document.getElementById(GLOW_ID)
    if (!el) return
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }
})(arguments[0])
