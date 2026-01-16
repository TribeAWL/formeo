import '../sass/formeo.scss'
import i18n from '@draggable/i18n'
import { SmartTooltip } from '@draggable/tooltip'
import Actions from './common/actions.js'
import dom from './common/dom.js'
import Events from './common/events.js'
import { fetchFormeoStyle, fetchIcons } from './common/loaders.js'
import { cleanFormData, merge } from './common/utils/index.mjs'
import Controls from './components/controls/index.js'
import Components from './components/index.js'
import { defaults } from './config.js'
import { DEFAULT_FORMDATA, SESSION_LOCALE_KEY } from './constants.js'
import FormeoRenderer from './renderer/index.js'
import { renderRuntimeSchemaForm } from './renderer/runtime-schema-renderer.js'

new SmartTooltip()

/**
 * Main class
 */
export class FormeoEditor {
  /**
   * @param  {Object} options  formeo options
   * @param  {String|Object}   userFormData loaded formData
   * @return {Object}          formeo references and actions
   */
  constructor({ formData, ...options }, userFormData) {
    const mergedOptions = merge(defaults.editor, options)

    const { actions, events, debug, config, editorContainer, ...opts } = mergedOptions
    if (editorContainer) {
      this.editorContainer =
        typeof editorContainer === 'string' ? document.querySelector(editorContainer) : editorContainer
    }
    this.opts = opts
    dom.setOptions = opts
    Components.config = config

    this.userFormData = userFormData || formData

    this.Components = Components
    this.dom = dom
    Events.init({ debug, ...events })
    Actions.init({ debug, sessionStorage: opts.sessionStorage, ...actions })

    // Load remote resources such as css and svg sprite
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.loadResources.bind(this))
    } else {
      this.loadResources()
    }
  }

  get formData() {
    return this.Components.formData
  }
  set formData(data = {}) {
    this.userFormData = cleanFormData(data)
    this.load(this.userFormData, this.opts)
  }

  /**
   * Returns the legacy Formeo format for rendering/preview
   * This is the old structure (stages, rows, columns, fields, sections)
   * that the FormeoRenderer expects
   * @return {Object} legacy Formeo formData structure
   */
  getLegacyFormData() {
    return this.Components.getLegacyFormData()
  }

  loadData(data = {}) {
    this.formData = data
  }

  get json() {
    return this.Components.json
  }

  /**
   * Clear the editor and reset to initial state
   * @return {void}
   */
  clear() {
    // Reset form data to default structure with empty stage
    this.userFormData = DEFAULT_FORMDATA()

    // Clear components and reload with default data
    this.Components.load(this.userFormData, this.opts)

    // Re-render the editor
    this.render()
  }

  /**
   * Load remote resources
   * @return {Promise} asynchronously loaded remote resources
   */
  async loadResources() {
    document.removeEventListener('DOMContentLoaded', this.loadResources)

    const promises = []
    promises.push(
      fetchIcons(this.opts.svgSprite),
      fetchFormeoStyle(this.opts.style),
      i18n.init({
        ...this.opts.i18n,
        locale: globalThis.sessionStorage?.getItem(SESSION_LOCALE_KEY),
      })
    )

    await Promise.all(promises)

    if (this.opts.allowEdit) {
      this.init()
    }
  }

  /**
   * Formeo initializer
   * @return {Object} References to formeo instance,
   * dom elements, actions events and more.
   */
  init() {
    return Controls.init(this.opts.controls, this.opts.stickyControls).then(controls => {
      this.controls = controls
      this.load(this.userFormData, this.opts)
      this.formId = Components.get('id')
      this.i18n = {
        setLang: formeoLocale => {
          window.sessionStorage?.setItem(SESSION_LOCALE_KEY, formeoLocale)
          const loadLang = i18n.setCurrent(formeoLocale)
          loadLang.then(() => {
            this.init()
          }, console.error)
        },
      }

      this.opts.onLoad?.(this)
    })
  }

  load(formData = this.userFormData, opts = this.opts) {
    this.Components.load(formData, opts)
    this.render()
  }

  /**
   * Render the formeo sections
   * @return {void}
   */
  render() {
    if (!this.controls) {
      return window.requestAnimationFrame(() => this.render())
    }

    this.stages = Object.values(Components.get('stages'))
    if (this.opts.controlOnLeft) {
      for (const stage of this.stages) {
        stage.dom.style.order = 1
      }
    }

    // Track preview state (only initialize if not already set)
    if (this.isPreviewMode === undefined) {
      this.isPreviewMode = false
    }

    // Create preview container
    this.previewContainer = dom.create({
      tag: 'div',
      className: 'formeo-preview-container',
      attrs: {
        style: 'display: none;',
      },
    })

    // Create preview button for the stage header
    this.previewButton = dom.create({
      tag: 'button',
      className: 'formeo-preview-btn',
      attrs: {
        type: 'button',
        title: i18n.get('Preview'),
      },
      children: [dom.icon('new-eye')],
      action: {
        click: () => {
          this.togglePreview()
        },
      },
    })

    // Create stage header (aligned with tab row)
    const stageHeader = dom.create({
      tag: 'div',
      className: 'formeo-stage-header',
      children: [this.previewButton],
    })

    const elemConfig = {
      attrs: {
        className: 'formeo formeo-editor',
        id: this.formId,
      },
      content: [this.stages.map(({ dom }) => dom)],
    }

    if (i18n.current.dir) {
      elemConfig.attrs.dir = i18n.current.dir
      dom.dir = i18n.current.dir
    }

    this.editor = dom.create(elemConfig)

    const controlsContainer = this.controls.container || this.editor
    controlsContainer.appendChild(this.controls.dom)
    // this code renders stage where we insert fields
    // Insert the stage header and preview container at the top of the stage
    const stageArea = this.stages[0]?.dom
    console.log('🚀 ~ FormeoEditor ~ render ~ stageArea:', stageArea)
    if (stageArea) {
      stageArea.insertBefore(stageHeader, stageArea.firstChild)
      // Insert preview container after the header
      stageHeader.after(this.previewContainer)
      // Store reference to stage content (children container)
      this.stageContent = stageArea.querySelector('.children')
    }

    if (this.editorContainer) {
      dom.empty(this.editorContainer)
      this.editorContainer.appendChild(this.editor)
    }

    Events.formeoLoaded = new globalThis.CustomEvent('formeoLoaded', {
      detail: {
        formeo: this,
      },
    })

    document.dispatchEvent(Events.formeoLoaded)
  }

  /**
   * Get CSS styles for runtime schema form
   * @return {String} CSS string
   */
  getRuntimeSchemaStyles() {
    return `
      .runtime-schema-form-wrapper {
        display: flex;
        min-height: 600px;
        background: #f5f7fa;
        border-radius: 15px;
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
        padding: 16px 24px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        margin-bottom: 0;
      }
      
      .runtime-schema-step-item:hover:not(.active) {
        background-color: transparent;
      }
      
      .runtime-schema-step-item.active {
        background-color: transparent;
        border-left: none;
        padding-left: 24px;
      }
      
      .runtime-schema-step-item.active .runtime-schema-step-number {
        background-color: #8b1538;
        color: #ffffff;
      }
      
      .runtime-schema-step-item.active .runtime-schema-step-label {
        color: #8b1538;
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
        position: relative;
        z-index: 1;
      }
      
      .runtime-schema-step-label {
        color: #666666;
        font-size: 14px;
        font-weight: 400;
        transition: color 0.2s ease;
      }
      
      .runtime-schema-step-item.active .runtime-schema-step-label {
        color: #8b1538;
        font-weight: 600;
      }
      
      .runtime-schema-step-connector {
        position: absolute;
        left: 40px;
        top: 48px;
        width: 2px;
        height: 24px;
        background-color: #e0e0e0;
        z-index: 0;
      }
      
      .runtime-schema-form-content {
        flex: 1;
        background: #ffffff;
        padding: 40px 48px;
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
        margin: 0 0 24px 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      
      .runtime-schema-step-description {
        font-size: 14px;
        color: #666666;
        margin: 0 0 24px 0;
      }
      
      .runtime-schema-fields-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        margin-bottom: 32px;
      }
      
      .runtime-schema-row {
        display: grid;
        gap: 20px 24px;
        width: 100%;
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
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #ffffff;
        color: #1a1a1a;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        font-family: inherit;
      }
      
      .runtime-schema-field-input:focus {
        outline: none;
        border-color: #8b1538;
        box-shadow: 0 0 0 3px rgba(139, 21, 56, 0.1);
      }
      
      .runtime-schema-field-input:invalid.error,
      .runtime-schema-field-input.error {
        border-color: #d32f2f;
        box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.1);
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
      
      input[type="radio"].error,
      input[type="checkbox"].error {
        outline: 2px solid #d32f2f;
        outline-offset: 2px;
        border-radius: 2px;
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
        justify-content: flex-start;
        gap: 16px;
        margin-top: 32px;
        padding-top: 0;
        border-top: none;
      }
      
      .runtime-schema-nav-button {
        padding: 14px 32px;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 8px;
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
        border-color: #8b1538;
        color: #8b1538;
      }
      
      .runtime-schema-nav-button.runtime-schema-nav-next {
        background-color: #000000;
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
          border-bottom: 3px solid #8b1538;
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
          gap: 20px;
        }
        
        .runtime-schema-row {
          grid-template-columns: 1fr !important;
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

  /**
   * Toggle between edit mode and preview mode
   * @return {void}
   */
  togglePreview() {
    this.isPreviewMode = !this.isPreviewMode

    // Update the icon and button state based on mode
    const iconName = this.isPreviewMode ? 'eye-open' : 'new-eye'
    this.previewButton.innerHTML = dom.icon(iconName)
    this.previewButton.classList.toggle('active', this.isPreviewMode)

    if (this.isPreviewMode) {
      // Hide stage content, show preview
      if (this.stageContent) {
        this.stageContent.style.display = 'none'
      }
      this.previewContainer.style.display = 'block'

      // Get runtime schema from editor
      const runtimeSchema = this.formData

      if (!runtimeSchema || !runtimeSchema.steps || runtimeSchema.steps.length === 0) {
        alert('No form steps found. Please add at least one section with fields to the form.')
        this.isPreviewMode = false
        this.previewButton.innerHTML = dom.icon('new-eye')
        this.previewButton.classList.remove('active')
        if (this.stageContent) {
          this.stageContent.style.display = ''
        }
        this.previewContainer.style.display = 'none'
        return
      }

      // Inject runtime schema styles if not already present
      const styleId = 'formeo-runtime-schema-styles'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = this.getRuntimeSchemaStyles()
        document.head.appendChild(style)
      }

      // Render using runtime schema renderer
      renderRuntimeSchemaForm(runtimeSchema, this.previewContainer)

      // Dispatch preview event
      Events.formeoUpdated({ type: 'preview', isPreviewMode: true }, 'formeoPreview')
    } else {
      // Show stage content, hide preview
      if (this.stageContent) {
        this.stageContent.style.display = ''
      }
      this.previewContainer.style.display = 'none'
      dom.empty(this.previewContainer)

      // Remove runtime schema styles (optional - can keep for performance)
      // const styleId = 'formeo-runtime-schema-styles'
      // const style = document.getElementById(styleId)
      // if (style) {
      //   style.remove()
      // }

      // Dispatch preview event
      Events.formeoUpdated({ type: 'preview', isPreviewMode: false }, 'formeoPreview')
    }
  }
}

export default FormeoEditor
