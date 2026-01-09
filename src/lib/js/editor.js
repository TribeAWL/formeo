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

      // Render the form in preview container
      // Use legacy format for preview (renderer expects old Formeo structure)
      const renderer = new FormeoRenderer({
        renderContainer: this.previewContainer,
      })
      renderer.render(this.Components.getLegacyFormData())

      // Dispatch preview event
      Events.formeoUpdated({ type: 'preview', isPreviewMode: true }, 'formeoPreview')
    } else {
      // Show stage content, hide preview
      if (this.stageContent) {
        this.stageContent.style.display = ''
      }
      this.previewContainer.style.display = 'none'
      dom.empty(this.previewContainer)

      // Dispatch preview event
      Events.formeoUpdated({ type: 'preview', isPreviewMode: false }, 'formeoPreview')
    }
  }
}

export default FormeoEditor
