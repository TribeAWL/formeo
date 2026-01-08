import i18n from '@draggable/i18n'
import Sortable from 'sortablejs'
import actions from '../../common/actions.js'
import dom from '../../common/dom.js'
import events from '../../common/events.js'
import { indexOfNode, orderObjectsBy } from '../../common/helpers.mjs'
import { clone, match, merge, unique } from '../../common/utils/index.mjs'
import { get, set } from '../../common/utils/object.mjs'
import {
  COMPARISON_OPERATORS,
  CONDITION_TEMPLATE,
  CONTROL_GROUP_CLASSNAME,
  conditionTypeIf,
  conditionTypeThen,
  PANEL_CLASSNAME,
} from '../../constants.js'
import Panels from '../panels.js'
import Rows from '../rows/index.js'
import Sections from '../sections/index.js'
import Stages from '../stages/index.js'
import Control from './control.js'
import defaultOptions from './options.js'

/**
 *
 */
export class Controls {
  constructor() {
    this.data = new Map()
    this.isDragging = false
    this.selectedField = null
    this.settingsGroupIndex = -1

    this.buttonActions = {
      // this is used for keyboard navigation. when tabbing through controls it
      // will auto navigated between the groups
      focus: ({ target }) => {
        // Prevent panel switching during drag operations
        if (this.isDragging) {
          return
        }
        const group = target.closest(`.${CONTROL_GROUP_CLASSNAME}`)
        return group && this.panels.nav.refresh(indexOfNode(group))
      },
      click: ({ target }) => {
        this.addElement(target.parentElement.id)
      },
    }
  }

  /**
   * Methods to be called on initialization
   * @param {Object} controlOptions
   */
  async init(controlOptions, sticky = false) {
    // this.isReady = false
    await this.applyOptions(controlOptions)
    this.buildDOM(sticky)

    return this
  }

  /**
   * Generate control config for UI and bind actions
   * @return {Array} elementControls
   */
  registerControls(elements) {
    this.controls = []
    return elements.map(Element => {
      const isControlClass = typeof Element === 'function'

      const control = isControlClass ? new Element() : new Control(Element)

      this.add(control)
      this.controls.push(control.dom)

      // the control may have dependencies so we need to resolve them asynchronously
      return control.promise()
    })
  }

  groupLabel = key => i18n.get(key) || key || ''

  /**
   * Group elements into their respective control group
   * @return {Array} allGroups
   */
  groupElements() {
    let groups = this.options.groups.slice()
    let elements = this.controls.slice()

    let allGroups = []
    const usedElementIds = []

    // Apply order to Groups
    groups = orderObjectsBy(groups, this.groupOrder, 'id')

    // remove disabled groups
    groups = groups.filter(group => match(group.id, this.options.disable.groups))

    // create group config
    allGroups = groups.map(group => {
      const groupConfig = {
        tag: 'ul',
        attrs: {
          className: [CONTROL_GROUP_CLASSNAME, PANEL_CLASSNAME],
          id: `${group.id}-${CONTROL_GROUP_CLASSNAME}`,
        },
        config: {
          label: this.groupLabel(group.label),
        },
      }

      // Apply order to elements/fields
      if (this.options.elementOrder[group.id]) {
        const userOrder = this.options.elementOrder[group.id]
        const newOrder = unique(userOrder.concat(group.elementOrder))
        group.elementOrder = newOrder
      }
      elements = orderObjectsBy(elements, group.elementOrder, 'meta.id')

      /**
       * Fill control groups with their fields
       * @param  {Object} field Field configuration object.
       * @return {Array}        Filtered array of Field config objects
       */
      groupConfig.content = elements.filter(control => {
        const { controlData: field } = this.get(control.id)
        const controlId = field.meta.id || ''
        const filters = [
          match(controlId, this.options.disable.elements),
          field.meta.group === group.id,
          !usedElementIds.includes(controlId),
        ]

        let shouldFilter = true
        shouldFilter = filters.every(val => val === true)
        if (shouldFilter) {
          usedElementIds.push(controlId)
        }

        return shouldFilter
      })

      return groupConfig
    })

    return allGroups
  }

  add(control = Object.create(null)) {
    const controlConfig = clone(control)
    this.data.set(controlConfig.id, controlConfig)
    if (controlConfig.controlData.meta.id) {
      this.data.set(controlConfig.controlData.meta.id, controlConfig.controlData)
    }
    return controlConfig
  }

  get(controlId) {
    return clone(this.data.get(controlId))
  }

  /**
   * Generate the DOM config for form actions like settings, save and clear
   * @return {Object} form action buttons config
   */
  formActions() {
    if (this.options.disable.formActions === true) {
      return null
    }
    const clearBtn = {
      ...dom.btnTemplate({ content: [dom.icon('bin'), i18n.get('clear')], title: i18n.get('clearAll') }),
      className: ['clear-form'],
      action: {
        click: evt => {
          if (Rows.size) {
            events.confirmClearAll = new window.CustomEvent('confirmClearAll', {
              detail: {
                confirmationMessage: i18n.get('confirmClearAll'),
                clearAllAction: () => {
                  Stages.clearAll().then(() => {
                    const evtData = {
                      src: evt.target,
                    }
                    events.formeoCleared(evtData)
                  })
                },
                btnCoords: dom.coords(evt.target),
              },
            })

            document.dispatchEvent(events.confirmClearAll)
          } else {
            window.alert(i18n.get('cannotClearFields'))
          }
        },
      },
    }

    const saveBtn = {
      ...dom.btnTemplate({ content: [dom.icon('floppy-disk'), i18n.get('save')], title: i18n.get('save') }),
      className: ['save-form'],
      action: {
        click: async ({ target }) => {
          // Dynamic import to avoid circular dependency
          const { default: Components } = await import('../index.js')
          const { formData } = Components
          const saveEvt = {
            action: () => {},
            coords: dom.coords(target),
            message: '',
            button: target,
          }
          actions.click.btn(saveEvt)

          return actions.save.form(formData)
        },
      },
    }

    const formActions = {
      className: 'form-actions f-btn-group',
      content: Object.entries({ clearBtn, saveBtn }).reduce((acc, [key, value]) => {
        if (!this.options.disable.formActions.includes(key)) {
          acc.push(value)
        }
        return acc
      }, []),
    }

    return formActions
  }

  /**
   * Returns the markup for the form controls/fields
   * @return {DOM}
   */
  buildDOM(sticky) {
    const groupedFields = this.groupElements()
    const formActions = this.formActions()
    const { displayType } = this.options.panels
    this.panels = new Panels({ panels: groupedFields, type: 'controls', displayType })
    const groupsWrapClasses = ['control-groups', 'formeo-panels-wrap', `panel-count-${groupedFields.length}`]
    const groupsWrap = dom.create({
      className: groupsWrapClasses,
      content: [this.panels.panelNav, this.panels.panelsWrap],
    })

    const controlClasses = ['formeo-controls']
    if (sticky) {
      controlClasses.push('formeo-sticky')
    }

    const element = dom.create({
      className: controlClasses,
      content: [groupsWrap, formActions],
    })
    const groups = element.getElementsByClassName('control-group')

    this.dom = element
    this.groups = groups
    const [firstGroup] = groups
    this.currentGroup = firstGroup

    this.actions = {
      filter: term => {
        const filtering = term !== ''
        const fields = this.controls
        let filteredTerm = groupsWrap.querySelector('.filtered-term')

        dom.toggleElementsByStr(fields, term)

        if (filtering) {
          const filteredStr = i18n.get('controls.filteringTerm', term)

          element.classList.add('filtered')

          if (filteredTerm) {
            filteredTerm.textContent = filteredStr
          } else {
            filteredTerm = dom.create({
              tag: 'h5',
              className: 'filtered-term',
              content: filteredStr,
            })
            groupsWrap.insertBefore(filteredTerm, groupsWrap.firstChild)
          }
        } else if (filteredTerm) {
          element.classList.remove('filtered')
          filteredTerm.remove()
        }
      },
      addElement: this.addElement,
      // @todo finish the addGroup method
      addGroup: group => console.log(group),
    }

    // Make controls sortable
    for (let i = groups.length - 1; i >= 0; i--) {
      const storeID = `formeo-controls-${groups[i]}`
      if (!this.options.sortable) {
        globalThis.localStorage.removeItem(storeID)
      }
      Sortable.create(groups[i], {
        animation: 150,
        fallbackClass: 'control-moving',
        fallbackOnBody: true,
        forceFallback: true,
        fallbackTolerance: 5,
        group: {
          name: 'controls',
          pull: 'clone',
          put: false,
          revertClone: true,
        },
        onClone: ({ clone, item }) => {
          // Copy the item's id to the clone so we can identify what control it represents
          clone.id = item.id

          if (this.options.ghostPreview) {
            const { controlData } = this.get(item.id)
            // Dynamically import Field to avoid circular dependency
            import('../fields/field.js').then(({ default: Field }) => {
              clone.innerHTML = ''
              clone.appendChild(new Field(controlData).preview)
            })
          }
        },
        onStart: () => {
          this.isDragging = true
          // Prevent scrollbar flashing during drag by hiding overflow
          this.originalDocumentOverflow = document.documentElement.style.overflow
          document.documentElement.style.overflow = 'hidden'
        },
        onEnd: ({ from, item, clone }) => {
          // With pull: 'clone', item is the original and clone is the dragged element
          // Ensure the original item stays in the controls panel
          if (from && item && !from.contains(item)) {
            // If original item is not in from, it might have been moved - restore it
            // This shouldn't happen with pull: 'clone', but handle it just in case
            if (from.contains(clone)) {
              from.replaceChild(item, clone)
            } else if (clone && clone.parentNode === from) {
              // Clone is still in from, replace it with original
              from.replaceChild(item, clone)
            }
          } else if (from && clone && from.contains(clone)) {
            // Clone is still in from (drop was cancelled), replace with original
            from.replaceChild(item, clone)
          }

          // Ensure original item is visible and in the correct position
          if (item && item.parentNode && item.style.display === 'none') {
            item.style.display = ''
          }

          // Restore overflow after drag completes
          document.documentElement.style.overflow = this.originalDocumentOverflow
          this.originalDocumentOverflow = null
          // Use setTimeout to ensure all events (focus, click, etc.) have already fired
          // before we reset the dragging state. Increased delay to handle all browser events.
          window.setTimeout(() => {
            this.isDragging = false
          }, 100)
        },
        sort: this.options.sortable,
        store: {
          /**
           * Get the order of elements.
           * @param   {Sortable}  sortable
           * @return {Array}
           */
          get: () => {
            const order = globalThis.localStorage.getItem(storeID)
            return order ? order.split('|') : []
          },

          /**
           * Save the order of elements.
           * @param {Sortable}  sortable
           */
          set: sortable => {
            const order = sortable.toArray()
            globalThis.localStorage.setItem(storeID, order.join('|'))
          },
        },
      })
    }

    // Set up document click listener to clear field selection when clicking outside
    this.setupDocumentClickListener()

    // Initialize the settings panel with placeholder
    const settingsPanel = element.querySelector('#settings-control-group')
    if (settingsPanel) {
      const placeholder = dom.create({
        className: 'settings-placeholder',
        children: [
          {
            tag: 'p',
            content: i18n.get('settings.selectField') || 'Select a field to edit its settings',
          },
        ],
      })
      settingsPanel.appendChild(placeholder)
    }

    return element
  }

  /**
   * Set up document click listener to clear field selection when clicking outside of fields
   */
  setupDocumentClickListener = () => {
    // Listen for field selection events
    document.addEventListener('formeo:field:selected', evt => {
      const { field } = evt.detail
      this.showFieldSettings(field)
    })

    document.addEventListener('click', evt => {
      // If clicking on a field, the field's click handler will handle it
      if (evt.target.closest('.formeo-field')) {
        return
      }

      // If clicking on controls panel, don't clear selection
      if (evt.target.closest('.formeo-controls')) {
        return
      }

      // If clicking on action buttons, don't clear selection
      if (evt.target.closest('.field-actions') || evt.target.closest('button')) {
        return
      }

      // Clear selection when clicking elsewhere on the stage
      if (evt.target.closest('.formeo-stage')) {
        this.clearFieldSelection()
      }
    })
  }

  layoutTypes = {
    row: () => Stages.active.addChild(),
    column: () => this.layoutTypes.row().addChild(),
    field: controlData => this.layoutTypes.column().addChild(controlData),
    section: () => {
      const section = Sections.add()
      Stages.active.dom.querySelector('.children').appendChild(section.dom)
      return section
    },
  }

  /**
   * Append an element to the stage
   * @param {String} id of elements
   */
  addElement = id => {
    const {
      meta: { group, id: metaId },
      ...elementData
    } = get(this.get(id), 'controlData')

    set(elementData, 'config.controlId', metaId)

    if (group === 'layout') {
      return this.layoutTypes[metaId.replace('layout-', '')]()
    }

    // Validate form field restrictions (same as drag-and-drop validation)
    // Check if it's a form field (not a layout control)
    const isFormField = group !== 'layout' && !metaId.startsWith('layout-')

    if (isFormField) {
      // Check if there's at least one section in the stage
      const activeStage = Stages.active
      if (!activeStage || !activeStage.hasSection()) {
        // Show alert message
        alert(
          'Please add a section first before adding form fields. Select "Section" from the layout fields, then you can add form fields into it.'
        )
        return null
      } else {
        // There are sections but trying to add directly to stage - show alert
        alert('Please add form fields into a section. Form fields can only be added inside sections.')
        return null
      }
    }

    return this.layoutTypes.field(elementData)
  }

  /**
   * Show field settings in the Settings tab
   * @param {Object} field - The field component to show settings for
   */
  showFieldSettings = field => {
    // Find the settings group panel
    const settingsPanel = this.dom?.querySelector('#settings-control-group')
    if (!settingsPanel) {
      return
    }

    // Clear previous selection highlight
    if (this.selectedField?.dom) {
      this.selectedField.dom.classList.remove('field-selected')
    }

    // Store the selected field
    this.selectedField = field

    // Clear existing settings content
    dom.empty(settingsPanel)

    if (field) {
      // Add selected highlight to field
      field.dom.classList.add('field-selected')

      // Create custom settings UI matching Figma design
      const fieldSettingsContent = this.createFieldSettingsUI(field)
      settingsPanel.appendChild(fieldSettingsContent)
    } else {
      // Show placeholder when no field is selected
      const placeholder = dom.create({
        className: 'settings-placeholder',
        children: [
          {
            tag: 'p',
            content: i18n.get('settings.selectField') || 'Select a field to edit its settings',
          },
        ],
      })
      settingsPanel.appendChild(placeholder)
    }

    // Switch to settings tab
    this.switchToSettingsTab()
  }

  /**
   * Get field type from field data
   * @param {Object} field - The field component
   * @return {String} The field type identifier
   */
  getFieldType = field => {
    const controlId = field.get('config.controlId') || field.get('meta.id') || ''
    const tag = field.get('tag') || ''
    const inputType = field.get('attrs.type') || ''

    // Check controlId first
    if (controlId.includes('header') || controlId === 'html.header') return 'header'
    if (controlId === 'paragraph') return 'paragraph'
    if (controlId === 'select') return 'select'
    if (controlId === 'checkbox') return 'checkbox'
    if (controlId === 'radio') return 'radio'
    if (controlId === 'textarea') return 'textarea'
    if (controlId === 'text' || controlId === 'input.text') return 'text'
    if (controlId === 'number' || controlId === 'input.number') return 'number'
    if (controlId === 'date' || controlId === 'input.date') return 'date'
    if (controlId === 'file' || controlId === 'input.file') return 'file'
    if (controlId === 'hidden' || controlId === 'input.hidden') return 'hidden'
    if (controlId === 'button') return 'button'
    if (controlId === 'hr') return 'hr'

    // Fallback to tag
    if (tag.match(/^h[1-6]$/)) return 'header'
    if (tag === 'p') return 'paragraph'
    if (tag === 'select') return 'select'
    if (tag === 'textarea') return 'textarea'
    if (tag === 'hr') return 'hr'
    if (tag === 'button') return 'button'
    if (tag === 'input') {
      if (inputType === 'checkbox') return 'checkbox'
      if (inputType === 'radio') return 'radio'
      if (inputType === 'file') return 'file'
      if (inputType === 'hidden') return 'hidden'
      if (inputType === 'number') return 'number'
      if (inputType === 'date') return 'date'
      return 'text'
    }

    return 'text' // Default
  }

  /**
   * Create custom field settings UI matching Figma design
   * @param {Object} field - The field component
   * @return {HTMLElement} The settings UI element
   */
  createFieldSettingsUI = field => {
    const fieldType = this.getFieldType(field)
    const settingsRows = []

    // Get common field data
    const title = field.get('config.label') || ''
    const content = field.get('content') || ''

    // Field type specific settings
    switch (fieldType) {
      case 'header':
        settingsRows.push(this.createHeaderTagRow(field))
        settingsRows.push(this.createContentRow(field, content))
        break

      case 'paragraph':
        settingsRows.push(this.createContentRow(field, content))
        break

      case 'hr':
        // Horizontal rule has no editable settings
        settingsRows.push({
          className: 'settings-row',
          children: [
            {
              tag: 'p',
              className: 'settings-info',
              content: i18n.get('settings.hrInfo') || 'Horizontal rule has no editable properties',
            },
          ],
        })
        break

      case 'select':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createMultipleRow(field))
        settingsRows.push(this.createOptionsSection(field))
        break

      case 'checkbox':
      case 'radio':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createOptionsSection(field))
        break

      case 'textarea':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createPlaceholderRow(field))
        settingsRows.push(this.createRowsRow(field))
        break

      case 'hidden':
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createValueRow(field))
        break

      case 'button':
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createButtonTypeRow(field))
        break

      case 'file':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createAcceptRow(field))
        break

      case 'number':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createPlaceholderRow(field))
        settingsRows.push(this.createMinMaxRow(field))
        break

      case 'date':
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        break

      case 'text':
      default:
        settingsRows.push(this.createRequiredRow(field))
        settingsRows.push(this.createTitleRow(field, title))
        settingsRows.push(this.createPlaceholderRow(field))
        break
    }

    // Add conditions section for all field types except hr
    if (fieldType !== 'hr') {
      settingsRows.push(this.createConditionsSection(field))
    }

    return dom.create({
      className: 'field-settings-content',
      children: settingsRows.filter(Boolean),
    })
  }

  // Settings row builders

  createRequiredRow = field => {
    const isRequired = field.get('attrs.required') || false
    return {
      className: 'settings-row settings-row-toggle',
      children: [
        {
          tag: 'label',
          content: i18n.get('required') || 'Required',
          attrs: { for: `${field.id}-required` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'checkbox',
            id: `${field.id}-required`,
            checked: isRequired,
          },
          action: {
            change: ({ target }) => {
              field.set('attrs.required', target.checked)
            },
          },
        },
      ],
    }
  }

  createTitleRow = (field, title) => ({
    className: 'settings-row',
    children: [
      {
        tag: 'label',
        content: i18n.get('title') || 'Title',
        attrs: { for: `${field.id}-title` },
      },
      {
        tag: 'input',
        attrs: {
          type: 'text',
          id: `${field.id}-title`,
          value: title,
          placeholder: '',
        },
        action: {
          input: ({ target }) => {
            field.set('config.label', target.value)
          },
        },
      },
    ],
  })

  createPlaceholderRow = field => {
    const placeholder = field.get('attrs.placeholder') || ''
    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('placeholder') || 'Placeholder',
          attrs: { for: `${field.id}-placeholder` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'text',
            id: `${field.id}-placeholder`,
            value: placeholder,
            placeholder: '',
          },
          action: {
            input: ({ target }) => {
              field.set('attrs.placeholder', target.value)
            },
          },
        },
      ],
    }
  }

  createContentRow = (field, content) => ({
    className: 'settings-row',
    children: [
      {
        tag: 'label',
        content: i18n.get('content') || 'Content',
        attrs: { for: `${field.id}-content` },
      },
      {
        tag: 'textarea',
        attrs: {
          id: `${field.id}-content`,
          rows: 3,
        },
        content: content,
        action: {
          input: ({ target }) => {
            field.set('content', target.value)
          },
        },
      },
    ],
  })

  createHeaderTagRow = field => {
    const currentTag = field.get('tag') || 'h1'
    const tagOptions = ['h1', 'h2', 'h3', 'h4'].map(tag => ({
      label: tag.toUpperCase(),
      value: tag,
      selected: tag === currentTag,
    }))

    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('headerLevel') || 'Header Level',
          attrs: { for: `${field.id}-tag` },
        },
        {
          tag: 'select',
          attrs: { id: `${field.id}-tag` },
          options: tagOptions,
          action: {
            change: ({ target }) => {
              field.set('tag', target.value)
            },
          },
        },
      ],
    }
  }

  createMultipleRow = field => {
    const isMultiple = field.get('attrs.multiple') || false
    return {
      className: 'settings-row settings-row-toggle',
      children: [
        {
          tag: 'label',
          content: i18n.get('allowMultiple') || 'Allow Multiple',
          attrs: { for: `${field.id}-multiple` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'checkbox',
            id: `${field.id}-multiple`,
            checked: isMultiple,
          },
          action: {
            change: ({ target }) => {
              field.set('attrs.multiple', target.checked)
            },
          },
        },
      ],
    }
  }

  createOptionsSection = field => {
    const options = field.get('options') || []

    const optionRows = options.map((opt, index) => ({
      className: 'settings-option-row',
      children: [
        {
          tag: 'input',
          attrs: {
            type: 'text',
            value: opt.label || opt.value || '',
            placeholder: i18n.get('optionLabel') || 'Option label',
          },
          action: {
            input: ({ target }) => {
              field.set(`options[${index}].label`, target.value)
              if (!opt.value || opt.value === opt.label) {
                field.set(`options[${index}].value`, target.value)
              }
            },
          },
        },
        {
          tag: 'button',
          className: 'option-remove-btn',
          attrs: { type: 'button' },
          content: '×',
          action: {
            click: () => {
              const currentOptions = field.get('options') || []
              currentOptions.splice(index, 1)
              field.set('options', currentOptions)
              this.showFieldSettings(field)
            },
          },
        },
      ],
    }))

    return {
      className: 'settings-options-section',
      children: [
        {
          tag: 'label',
          content: i18n.get('options') || 'Options',
        },
        {
          className: 'settings-options-list',
          children: optionRows,
        },
        {
          tag: 'button',
          className: 'settings-add-option-btn',
          attrs: { type: 'button' },
          children: [dom.icon('plus'), { tag: 'span', content: i18n.get('addOption') || 'Add Option' }],
          action: {
            click: () => {
              const currentOptions = field.get('options') || []
              const newIndex = currentOptions.length + 1
              currentOptions.push({
                label: `${i18n.get('option') || 'Option'} ${newIndex}`,
                value: `option-${newIndex}`,
                selected: false,
              })
              field.set('options', currentOptions)
              this.showFieldSettings(field)
            },
          },
        },
      ],
    }
  }

  createRowsRow = field => {
    const rows = field.get('attrs.rows') || 3
    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('rows') || 'Rows',
          attrs: { for: `${field.id}-rows` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'number',
            id: `${field.id}-rows`,
            value: rows,
            min: 1,
            max: 20,
          },
          action: {
            input: ({ target }) => {
              field.set('attrs.rows', parseInt(target.value, 10))
            },
          },
        },
      ],
    }
  }

  createValueRow = field => {
    const value = field.get('attrs.value') || ''
    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('value') || 'Value',
          attrs: { for: `${field.id}-value` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'text',
            id: `${field.id}-value`,
            value: value,
          },
          action: {
            input: ({ target }) => {
              field.set('attrs.value', target.value)
            },
          },
        },
      ],
    }
  }

  createButtonTypeRow = field => {
    const buttonType = field.get('attrs.type') || 'button'
    const typeOptions = [
      { label: 'Button', value: 'button', selected: buttonType === 'button' },
      { label: 'Submit', value: 'submit', selected: buttonType === 'submit' },
      { label: 'Reset', value: 'reset', selected: buttonType === 'reset' },
    ]

    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('buttonType') || 'Button Type',
          attrs: { for: `${field.id}-button-type` },
        },
        {
          tag: 'select',
          attrs: { id: `${field.id}-button-type` },
          options: typeOptions,
          action: {
            change: ({ target }) => {
              field.set('attrs.type', target.value)
            },
          },
        },
      ],
    }
  }

  createAcceptRow = field => {
    const accept = field.get('attrs.accept') || ''
    return {
      className: 'settings-row',
      children: [
        {
          tag: 'label',
          content: i18n.get('acceptedFiles') || 'Accepted Files',
          attrs: { for: `${field.id}-accept` },
        },
        {
          tag: 'input',
          attrs: {
            type: 'text',
            id: `${field.id}-accept`,
            value: accept,
            placeholder: 'e.g., .pdf,.doc,image/*',
          },
          action: {
            input: ({ target }) => {
              field.set('attrs.accept', target.value)
            },
          },
        },
      ],
    }
  }

  createMinMaxRow = field => {
    const min = field.get('attrs.min') || ''
    const max = field.get('attrs.max') || ''
    return {
      className: 'settings-row settings-row-double',
      children: [
        {
          className: 'settings-half',
          children: [
            {
              tag: 'label',
              content: i18n.get('min') || 'Min',
              attrs: { for: `${field.id}-min` },
            },
            {
              tag: 'input',
              attrs: {
                type: 'number',
                id: `${field.id}-min`,
                value: min,
              },
              action: {
                input: ({ target }) => {
                  field.set('attrs.min', target.value)
                },
              },
            },
          ],
        },
        {
          className: 'settings-half',
          children: [
            {
              tag: 'label',
              content: i18n.get('max') || 'Max',
              attrs: { for: `${field.id}-max` },
            },
            {
              tag: 'input',
              attrs: {
                type: 'number',
                id: `${field.id}-max`,
                value: max,
              },
              action: {
                input: ({ target }) => {
                  field.set('attrs.max', target.value)
                },
              },
            },
          ],
        },
      ],
    }
  }

  /**
   * Create conditions section UI matching Figma design
   * @param {Object} field - The field component
   * @return {Object} The conditions section config
   */
  createConditionsSection = field => {
    // Get field's conditions data
    const conditions = field.get('conditions') || [CONDITION_TEMPLATE()]
    const hasConditions = conditions.length > 0 && conditions[0]?.[conditionTypeIf]?.[0]?.source

    // State for managing conditions UI
    this.conditionValues = this.conditionValues || new Map()
    if (!this.conditionValues.has(field.id)) {
      this.conditionValues.set(field.id, { values: [], showConditions: hasConditions })
    }

    const fieldConditionState = this.conditionValues.get(field.id)

    // If no conditions yet, show "Add conditions" button
    if (!fieldConditionState.showConditions) {
      return {
        className: 'settings-add-conditions',
        children: [
          {
            tag: 'button',
            attrs: { type: 'button' },
            children: [
              { tag: 'span', className: 'add-conditions-plus', content: '+' },
              { tag: 'span', content: i18n.get('addConditions') || 'Add conditions' },
            ],
            action: {
              click: () => {
                fieldConditionState.showConditions = true
                // Re-render settings to show conditions UI
                this.showFieldSettings(field)
              },
            },
          },
        ],
      }
    }

    // Create full conditions UI
    return {
      className: 'settings-conditions-section',
      children: [
        // Conditions header with trash icon
        {
          className: 'conditions-header',
          children: [
            { tag: 'h4', content: i18n.get('conditions') || 'Conditions' },
            {
              tag: 'button',
              className: 'conditions-delete-btn',
              attrs: { type: 'button', title: i18n.get('deleteCondition') || 'Delete condition' },
              children: [dom.icon('bin')],
              action: {
                click: () => {
                  // Reset conditions
                  field.set('conditions', [CONDITION_TEMPLATE()])
                  fieldConditionState.showConditions = false
                  fieldConditionState.values = []
                  this.showFieldSettings(field)
                },
              },
            },
          ],
        },
        // If section
        this.createIfSection(field, conditions, fieldConditionState),
        // Divider
        { className: 'conditions-divider' },
        // Then section
        this.createThenSection(field, conditions),
      ],
    }
  }

  /**
   * Create "If" section for conditions
   * @param {Object} field - The field component
   * @param {Array} conditions - The conditions data
   * @param {Object} fieldConditionState - State for this field's conditions
   * @return {Object} The If section config
   */
  createIfSection = (field, conditions, fieldConditionState) => {
    const ifCondition = conditions[0]?.[conditionTypeIf]?.[0] || {}

    // Get available fields for the source dropdown
    const sourceOptions = this.getFieldOptions(field.id)

    // Operator options matching Figma
    const operatorOptions = [
      { label: i18n.get('comparison.equals') || 'Is equal to', value: COMPARISON_OPERATORS.equals },
      { label: i18n.get('comparison.notEquals') || 'Is not equal to', value: COMPARISON_OPERATORS.notEquals },
      { label: i18n.get('comparison.contains') || 'Is contain', value: COMPARISON_OPERATORS.contains },
      { label: i18n.get('comparison.notContains') || 'Does not contain', value: COMPARISON_OPERATORS.notContains },
    ]

    // Initialize condition values from existing data or empty
    const currentValues = fieldConditionState.values.length > 0 ? fieldConditionState.values : []

    return {
      className: 'conditions-if-section',
      children: [
        // If label
        { tag: 'label', className: 'condition-type-label', content: i18n.get('if') || 'If' },
        // Source field dropdown
        {
          className: 'settings-row',
          children: [
            {
              tag: 'select',
              className: 'condition-source-select',
              attrs: { id: `${field.id}-condition-source` },
              options: sourceOptions,
              action: {
                change: ({ target }) => {
                  const conditionData = field.get('conditions') || [CONDITION_TEMPLATE()]
                  if (!conditionData[0][conditionTypeIf]) {
                    conditionData[0][conditionTypeIf] = [{}]
                  }
                  conditionData[0][conditionTypeIf][0].source = target.value
                  conditionData[0][conditionTypeIf][0].sourceProperty = 'value'
                  field.set('conditions', conditionData)
                },
              },
            },
          ],
        },
        // Operator label
        { tag: 'label', className: 'condition-field-label', content: i18n.get('operator') || 'Operator' },
        // Operator dropdown
        {
          className: 'settings-row',
          children: [
            {
              tag: 'select',
              className: 'condition-operator-select',
              attrs: { id: `${field.id}-condition-operator` },
              options: operatorOptions.map(opt => ({
                ...opt,
                selected: opt.value === ifCondition.comparison,
              })),
              action: {
                change: ({ target }) => {
                  const conditionData = field.get('conditions') || [CONDITION_TEMPLATE()]
                  if (!conditionData[0][conditionTypeIf]) {
                    conditionData[0][conditionTypeIf] = [{}]
                  }
                  conditionData[0][conditionTypeIf][0].comparison = target.value
                  field.set('conditions', conditionData)
                },
              },
            },
          ],
        },
        // Value label
        { tag: 'label', className: 'condition-field-label', content: i18n.get('value') || 'Value' },
        // Value input with tag chips
        {
          className: 'settings-row condition-value-row',
          children: [
            {
              tag: 'input',
              className: 'condition-value-input',
              attrs: {
                type: 'text',
                id: `${field.id}-condition-value`,
                placeholder: '',
                value: ifCondition.target || '',
              },
              action: {
                input: ({ target }) => {
                  const conditionData = field.get('conditions') || [CONDITION_TEMPLATE()]
                  if (!conditionData[0][conditionTypeIf]) {
                    conditionData[0][conditionTypeIf] = [{}]
                  }
                  conditionData[0][conditionTypeIf][0].target = target.value
                  field.set('conditions', conditionData)
                },
                keydown: evt => {
                  // Add tag on Enter key
                  if (evt.key === 'Enter' && evt.target.value.trim()) {
                    evt.preventDefault()
                    const value = evt.target.value.trim()
                    if (!fieldConditionState.values.includes(value)) {
                      fieldConditionState.values.push(value)
                      this.showFieldSettings(field)
                    }
                    evt.target.value = ''
                  }
                },
              },
            },
          ],
        },
        // Tag chips for values
        currentValues.length > 0
          ? {
              className: 'condition-value-tags',
              children: currentValues.map((value, index) => ({
                className: 'condition-tag',
                children: [
                  { tag: 'span', content: value },
                  {
                    tag: 'button',
                    className: 'tag-remove-btn',
                    attrs: { type: 'button' },
                    content: '×',
                    action: {
                      click: () => {
                        fieldConditionState.values.splice(index, 1)
                        this.showFieldSettings(field)
                      },
                    },
                  },
                ],
              })),
            }
          : null,
      ].filter(Boolean),
    }
  }

  /**
   * Create "Then" section for conditions
   * @param {Object} field - The field component
   * @param {Array} conditions - The conditions data
   * @return {Object} The Then section config
   */
  createThenSection = (field, conditions) => {
    const thenCondition = conditions[0]?.[conditionTypeThen]?.[0] || {}

    // Get available fields for the target dropdown
    const targetOptions = this.getFieldOptions(field.id)

    // Action options
    const actionOptions = [
      { label: i18n.get('action.show') || 'Show', value: 'isVisible' },
      { label: i18n.get('action.hide') || 'Hide', value: 'isNotVisible' },
      { label: i18n.get('action.setValue') || 'Set value', value: 'value' },
    ]

    return {
      className: 'conditions-then-section',
      children: [
        // Then label
        { tag: 'label', className: 'condition-type-label', content: i18n.get('then') || 'Then' },
        // Target field dropdown
        {
          className: 'settings-row',
          children: [
            {
              tag: 'select',
              className: 'condition-target-select',
              attrs: { id: `${field.id}-condition-target` },
              options: targetOptions.map(opt => ({
                ...opt,
                selected: opt.value === thenCondition.target,
              })),
              action: {
                change: ({ target }) => {
                  const conditionData = field.get('conditions') || [CONDITION_TEMPLATE()]
                  if (!conditionData[0][conditionTypeThen]) {
                    conditionData[0][conditionTypeThen] = [{}]
                  }
                  conditionData[0][conditionTypeThen][0].target = target.value
                  field.set('conditions', conditionData)
                },
              },
            },
          ],
        },
        // Action label
        { tag: 'label', className: 'condition-field-label', content: i18n.get('action') || 'Action' },
        // Action dropdown
        {
          className: 'settings-row',
          children: [
            {
              tag: 'select',
              className: 'condition-action-select',
              attrs: { id: `${field.id}-condition-action` },
              options: actionOptions.map(opt => ({
                ...opt,
                selected: opt.value === thenCondition.targetProperty,
              })),
              action: {
                change: ({ target }) => {
                  const conditionData = field.get('conditions') || [CONDITION_TEMPLATE()]
                  if (!conditionData[0][conditionTypeThen]) {
                    conditionData[0][conditionTypeThen] = [{}]
                  }
                  conditionData[0][conditionTypeThen][0].targetProperty = target.value
                  conditionData[0][conditionTypeThen][0].assignment = '='
                  field.set('conditions', conditionData)
                },
              },
            },
          ],
        },
      ],
    }
  }

  /**
   * Get available field options for condition dropdowns
   * @param {String} excludeFieldId - Field ID to exclude from options
   * @return {Array} Array of options for select
   */
  getFieldOptions = excludeFieldId => {
    const options = [{ label: i18n.get('selectField') || 'Select field...', value: '' }]

    // Get all fields from the form
    import('../fields/index.js').then(({ default: Fields }) => {
      const fieldsData = Fields.getData() || {}
      for (const [fieldId, fieldData] of Object.entries(fieldsData)) {
        if (fieldId !== excludeFieldId) {
          const label = fieldData.config?.label || fieldData.attrs?.placeholder || fieldId
          options.push({ label, value: `fields.${fieldId}` })
        }
      }
    })

    // For synchronous access, we need to use cached data
    // This will be populated after the first render
    if (this.cachedFieldOptions) {
      return this.cachedFieldOptions.filter(opt => opt.value !== `fields.${excludeFieldId}`)
    }

    return options
  }

  /**
   * Refresh cached field options
   */
  refreshFieldOptions = async () => {
    const { default: Fields } = await import('../fields/index.js')
    const fieldsData = Fields.getData() || {}
    this.cachedFieldOptions = [{ label: i18n.get('selectField') || 'Select field...', value: '' }]

    for (const [fieldId, fieldData] of Object.entries(fieldsData)) {
      const label = fieldData.config?.label || fieldData.attrs?.placeholder || fieldId
      this.cachedFieldOptions.push({ label, value: `fields.${fieldId}` })
    }
  }

  /**
   * Switch to the Settings tab
   */
  switchToSettingsTab = () => {
    if (this.settingsGroupIndex === -1) {
      // Find the index of the settings group
      const groups = Array.from(this.groups || [])
      this.settingsGroupIndex = groups.findIndex(g => g.id === 'settings-control-group')
    }

    if (this.settingsGroupIndex !== -1 && this.panels?.nav) {
      this.panels.nav.refresh(this.settingsGroupIndex)
    }
  }

  /**
   * Clear field selection
   */
  clearFieldSelection = () => {
    if (this.selectedField?.dom) {
      this.selectedField.dom.classList.remove('field-selected')
    }
    this.selectedField = null

    // Show placeholder in settings panel
    const settingsPanel = this.dom?.querySelector('#settings-control-group')
    if (settingsPanel) {
      dom.empty(settingsPanel)
      const placeholder = dom.create({
        className: 'settings-placeholder',
        children: [
          {
            tag: 'p',
            content: i18n.get('settings.selectField') || 'Select a field to edit its settings',
          },
        ],
      })
      settingsPanel.appendChild(placeholder)
    }
  }

  applyOptions = async (controlOptions = {}) => {
    const { container, elements, groupOrder, ...options } = merge(defaultOptions, controlOptions)
    this.container = container
    this.groupOrder = unique(groupOrder.concat(['common', 'html', 'layout']))
    this.options = options

    const [layoutControls, formControls, htmlControls] = await Promise.all([
      import('./layout/index.js'),
      import('./form/index.js'),
      import('./html/index.js'),
    ])

    const allControls = [layoutControls.default, formControls.default, htmlControls.default].flat()

    return Promise.all(this.registerControls([...allControls, ...elements]))
  }
}

export default new Controls()
