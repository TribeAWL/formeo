import aceEditor, { config } from 'ace-builds/src-noconflict/ace'
import Json from 'ace-builds/src-noconflict/mode-json?url'
import githubTheme from 'ace-builds/src-noconflict/theme-github_light_default?url'
import startCase from 'lodash/startCase'
import { getRuntimeSchemaHTML, renderRuntimeSchemaForm } from '../../lib/js/renderer/runtime-schema-renderer.js'

config.setModuleUrl('ace/mode/json', Json)
config.setModuleUrl('ace/theme/github_light_default', githubTheme)
const jsonEditor = aceEditor.edit('formData-editor')
jsonEditor.session.setOption('useWorker', false)

jsonEditor.setOptions({
  theme: 'ace/theme/github_light_default',
  mode: 'ace/mode/json',
})

const submitFormData = document.getElementById('submit-formData')
const popover = document.getElementById('formData-popover')

const editorActionButtonContainer = document.getElementById('editor-action-buttons')
const editorActions = (editor, renderer) => {
  return {
    renderForm: () => {
      try {
        const renderFormWrap = document.querySelector('.render-form')
        if (!renderFormWrap) {
          console.error('Render form container not found')
          return
        }
        renderFormWrap.style.display = 'block'

        // Get runtime schema from editor
        const runtimeSchema = editor.formData

        if (!runtimeSchema || !runtimeSchema.steps || runtimeSchema.steps.length === 0) {
          alert('No form steps found. Please add at least one section with fields to the form.')
          return
        }

        // Render using runtime schema renderer
        renderRuntimeSchemaForm(runtimeSchema, renderFormWrap)
      } catch (error) {
        console.error('Error rendering form:', error)
        alert('Error rendering form: ' + error.message)
      }
    },
    // logJSON: () => console.log(JSON.stringify(JSON.parse(editor.json), null, 2)),
    // viewData: () => {
    //   for (const [key, val] of Object.entries(editor.formData)) {
    //     console.log(key, val)
    //   }
    // },
    getHtml: () => {
      try {
        // Get runtime schema from editor
        const runtimeSchema = editor.formData

        if (!runtimeSchema || !runtimeSchema.steps || runtimeSchema.steps.length === 0) {
          alert('No form steps found. Please add at least one section with fields to the form.')
          return
        }

        // Get HTML from runtime schema renderer
        const html = getRuntimeSchemaHTML(runtimeSchema)

        // Create a complete HTML document with styles
        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form Preview</title>
  <style>
    ${getRuntimeSchemaStyles()}
  </style>
</head>
<body>
  ${html}
</body>
</html>
        `

        const win = window.open('', '_blank')
        win.document.write(fullHtml)
        win.document.close()
      } catch (error) {
        console.error('Error getting HTML:', error)
        alert('Error getting HTML: ' + error.message)
      }
    },
    getUserData: () => {
      // renderer.getRenderedForm(editor.formData)
      console.log(renderer.userData)
    },
    resetEditor: () => {
      window.sessionStorage.removeItem('formeo-formData')
      window.location.reload()
    },
    editData: () => {
      jsonEditor.setValue(JSON.stringify(editor.formData, null, 2), 1)
    },
  }
}

const buttonIdAttrsMap = {
  editData: { popovertarget: 'formData-popover' },
}
const getButtonAttrs = id => {
  const attrs = buttonIdAttrsMap[id] || {}
  return { id, type: 'button', ...attrs }
}

export const editorButtons = (editor, renderer) => {
  submitFormData.addEventListener('click', () => {
    editor.formData = jsonEditor.session.getValue()
    popover.hidePopover()
  })

  const buttonActions = editorActions(editor, renderer)
  const buttons = Object.entries(buttonActions).map(([id, cb]) => {
    const attrs = getButtonAttrs(id)
    const button = Object.assign(document.createElement('button'), attrs)
    for (const [key, value] of Object.entries(attrs)) {
      button.setAttribute(key, value)
    }
    const buttonText = document.createTextNode(startCase(id))
    button.appendChild(buttonText)
    button.addEventListener('click', cb, false)
    editorActionButtonContainer.appendChild(button)
    return button
  })

  return buttons
}

document.getElementById('format-json').addEventListener('click', formatJSON)
document.getElementById('collapse-json').addEventListener('click', collapseJSON)
document.getElementById('copy-json').addEventListener('click', copyJSON)

function formatJSON() {
  const val = jsonEditor.session.getValue()
  const o = JSON.parse(val)
  jsonEditor.setValue(JSON.stringify(o, null, 2), 1)
}

function collapseJSON() {
  const val = jsonEditor.session.getValue()
  const o = JSON.parse(val)
  jsonEditor.setValue(JSON.stringify(o, null, 0), 1)
}

async function copyJSON({ target }) {
  const textBackup = target.textContent
  target.textContent = 'Copied!'
  const timeout = setTimeout(() => {
    target.textContent = textBackup
    clearTimeout(timeout)
  }, 3000)

  try {
    await navigator.clipboard.writeText(jsonEditor.session.getValue())
    console.log('Text copied to clipboard')
  } catch (err) {
    console.error('Failed to copy: ', err)
  }
}

/**
 * Get CSS styles for runtime schema form
 * @return {String} CSS string
 */
function getRuntimeSchemaStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      padding: 20px;
    }
    
    .runtime-schema-form-wrapper {
      display: flex;
      min-height: 600px;
      background: #f5f7fa;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .runtime-schema-sidebar {
      width: 280px;
      background: #ffffff;
      border-right: 1px solid #e0e0e0;
      padding: 24px 0;
      flex-shrink: 0;
    }
    
    .runtime-schema-steps-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .runtime-schema-step-item {
      position: relative;
      display: flex;
      align-items: center;
      padding: 12px 24px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      margin-bottom: 4px;
    }
    
    .runtime-schema-step-item:hover:not(.active) {
      background-color: #f8f9fa;
    }
    
    .runtime-schema-step-item.active {
      background-color: #f0f0f0;
      border-left: 3px solid #8b4513;
      padding-left: 21px;
    }
    
    .runtime-schema-step-item.active .runtime-schema-step-number {
      background-color: #8b4513;
      color: #ffffff;
    }
    
    .runtime-schema-step-item.active .runtime-schema-step-label {
      color: #8b4513;
      font-weight: 600;
    }
    
    .runtime-schema-step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #e0e0e0;
      color: #666666;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      margin-right: 12px;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    
    .runtime-schema-step-label {
      color: #666666;
      font-size: 14px;
      font-weight: 400;
      transition: color 0.2s ease;
    }
    
    .runtime-schema-step-connector {
      position: absolute;
      left: 40px;
      bottom: -4px;
      width: 2px;
      height: 20px;
      background-color: #e0e0e0;
      z-index: 0;
    }
    
    .runtime-schema-form-content {
      flex: 1;
      background: #ffffff;
      padding: 40px;
      overflow-y: auto;
      width: 100%;
    }
    
    .runtime-schema-form {
      width: 100%;
      max-width: 100%;
    }
    
    .runtime-schema-step-header {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 8px 0;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .runtime-schema-step-description {
      font-size: 14px;
      color: #666666;
      margin: 0 0 24px 0;
    }
    
    .runtime-schema-fields-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin-bottom: 32px;
    }
    
    .runtime-schema-field-wrapper {
      display: flex;
      flex-direction: column;
    }
    
    .runtime-schema-field-label {
      font-size: 14px;
      font-weight: 500;
      color: #333333;
      margin-bottom: 8px;
      display: block;
    }
    
    .runtime-schema-required-asterisk {
      color: #d32f2f;
      margin-left: 2px;
    }
    
    .runtime-schema-field-input {
      width: 100%;
      padding: 12px 16px;
      font-size: 14px;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      background-color: #ffffff;
      color: #1a1a1a;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      font-family: inherit;
    }
    
    .runtime-schema-field-input:focus {
      outline: none;
      border-color: #8b4513;
      box-shadow: 0 0 0 3px rgba(139, 69, 19, 0.1);
    }
    
    .runtime-schema-field-input:invalid.error {
      border-color: #d32f2f;
    }
    
    .runtime-schema-field-input::placeholder {
      color: #999999;
    }
    
    .runtime-schema-date-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    
    .runtime-schema-date-wrapper .runtime-schema-field-input {
      padding-right: 40px;
    }
    
    .runtime-schema-date-icon {
      position: absolute;
      right: 12px;
      pointer-events: none;
      font-size: 18px;
      opacity: 0.6;
    }
    
    .runtime-schema-select-wrapper {
      position: relative;
    }
    
    .runtime-schema-select-wrapper .runtime-schema-field-input {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 36px;
      cursor: pointer;
    }
    
    .runtime-schema-radio-group,
    .runtime-schema-checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .runtime-schema-radio-option,
    .runtime-schema-checkbox-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .runtime-schema-radio-option input[type="radio"],
    .runtime-schema-checkbox-option input[type="checkbox"] {
      width: auto;
      margin: 0;
      cursor: pointer;
    }
    
    .runtime-schema-radio-option label,
    .runtime-schema-checkbox-option label {
      font-weight: 400;
      margin: 0;
      cursor: pointer;
      color: #333333;
    }
    
    textarea.runtime-schema-field-input {
      min-height: 100px;
      resize: vertical;
      font-family: inherit;
    }
    
    .runtime-schema-navigation {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }
    
    .runtime-schema-nav-button {
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      min-width: 120px;
    }
    
    .runtime-schema-nav-button.runtime-schema-nav-prev {
      background-color: #ffffff;
      color: #666666;
      border: 1px solid #d0d0d0;
    }
    
    .runtime-schema-nav-button.runtime-schema-nav-prev:hover {
      background-color: #f8f9fa;
      border-color: #8b4513;
      color: #8b4513;
    }
    
    .runtime-schema-nav-button.runtime-schema-nav-next {
      background-color: #1a1a1a;
      color: #ffffff;
    }
    
    .runtime-schema-nav-button.runtime-schema-nav-next:hover {
      background-color: #333333;
    }
    
    .runtime-schema-nav-button.runtime-schema-nav-next:active {
      transform: translateY(1px);
    }
    
    .runtime-schema-nav-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
      .runtime-schema-form-wrapper {
        flex-direction: column;
      }
      
      .runtime-schema-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid #e0e0e0;
        padding: 16px 0;
      }
      
      .runtime-schema-steps-list {
        display: flex;
        overflow-x: auto;
        padding: 0 16px;
      }
      
      .runtime-schema-step-item {
        flex-direction: column;
        align-items: center;
        min-width: 80px;
        padding: 8px;
        margin-right: 16px;
      }
      
      .runtime-schema-step-item.active {
        border-left: none;
        border-bottom: 3px solid #8b4513;
        padding-left: 8px;
        padding-bottom: 5px;
      }
      
      .runtime-schema-step-connector {
        display: none;
      }
      
      .runtime-schema-form-content {
        padding: 24px 16px;
      }
      
      .runtime-schema-fields-container {
        grid-template-columns: 1fr;
        gap: 20px;
      }
      
      .runtime-schema-navigation {
        flex-direction: column;
      }
      
      .runtime-schema-nav-button {
        width: 100%;
      }
    }
  `
}
