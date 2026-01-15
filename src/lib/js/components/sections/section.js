import i18n from '@draggable/i18n'
import Sortable from 'sortablejs'
import animate from '../../common/animation.js'
import dom from '../../common/dom.js'
import { componentType } from '../../common/utils/index.mjs'
import {
  ANIMATION_SPEED_BASE,
  COLUMN_CLASSNAME,
  CONTROL_GROUP_CLASSNAME,
  FIELD_CLASSNAME,
  ROW_CLASSNAME,
  SECTION_CLASSNAME,
  STAGE_CLASSNAME,
} from '../../constants.js'
import Component from '../component.js'
import Components from '../index.js'

// Re-export SECTION_CLASSNAME for backward compatibility with renderer
export { SECTION_CLASSNAME }

const DEFAULT_DATA = () =>
  Object.freeze({
    config: {
      name: '',
      instruction: '',
      collapsed: false,
      title: '',
      description: '',
    },
    children: [],
    className: [SECTION_CLASSNAME, STAGE_CLASSNAME],
    order: 0,
  })

/**
 * Editor Section - A collapsible container with name and instruction
 */
export default class Section extends Component {
  /**
   * Set default and generate dom for section in editor
   * @param  {Object} sectionData
   * @return {Object}
   */
  constructor(sectionData) {
    super('section', { ...DEFAULT_DATA(), ...sectionData })

    // Override getComponentTag to ensure it shows only "Section" (not "Handle-SectionSection")
    this.getComponentTag = () => {
      return dom.create({
        tag: 'span',
        className: ['component-tag', `${this.name}-tag`],
        children: ['Section'],
      })
    }

    // Initialize order if not set (will be updated based on position in stage)
    if (this.get('order') === undefined || this.get('order') === 0) {
      this.updateOrder()
    }

    const children = this.createChildWrap()

    // Section header with collapse toggle, drag handle, name, and instruction
    const sectionHeader = this.createSectionHeader()

    this.dom = dom.create({
      tag: 'div',
      className: [SECTION_CLASSNAME, STAGE_CLASSNAME, 'empty'],
      dataset: {
        hoverTag: i18n.get('section') || 'Section',
        editingHoverTag: i18n.get('editing.section') || 'Editing Section',
      },
      id: this.id,
      content: [this.getComponentTag(), sectionHeader, this.getActionButtons(), children],
      action: {
        click: evt => {
          // Don't trigger selection when clicking on action buttons or inputs
          const target = evt.target
          if (
            target.closest('.section-actions') ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea')
          ) {
            return
          }
          evt.stopPropagation()
          this.selectSection()
        },
      },
    })

    // Make children sortable (can contain fields, rows, and columns)
    Sortable.create(children, {
      animation: 150,
      fallbackClass: 'row-moving',
      forceFallback: true,
      group: {
        name: 'section',
        pull: true,
        put: ['controls', 'row', 'column'], // Allow controls (form fields), rows, and columns
      },
      sort: true,
      disabled: false,
      onRemove: this.onRemove.bind(this),
      onEnd: this.onEnd.bind(this),
      onAdd: this.onAdd.bind(this),
      onSort: this.onSort.bind(this),
      draggable: `.${FIELD_CLASSNAME}, .${ROW_CLASSNAME}`,
      handle: '.item-move',
      filter: `.${SECTION_CLASSNAME}`, // Only prevent nested sections
    })
  }

  /**
   * Create the section header with collapse toggle, name, and instruction
   * @return {Object} DOM element config
   */
  createSectionHeader() {
    const collapseToggle = {
      tag: 'button',
      className: 'section-collapse-toggle',
      attrs: {
        type: 'button',
        ariaLabel: 'Toggle section',
      },
      content: dom.icon('triangle-down'),
      action: {
        click: () => this.toggleCollapse(),
      },
    }

    const dragHandle = {
      tag: 'span',
      className: 'section-drag-handle',
      content: dom.icon('handle'),
    }

    const titleInput = {
      tag: 'input',
      className: 'section-title-input',
      attrs: {
        type: 'text',
        placeholder: i18n.get('section.title.placeholder') || 'Section title (required)',
        value: this.get('config.title') || this.get('config.name') || '',
        required: true,
      },
      action: {
        input: ({ target }) => {
          this.set('config.title', target.value)
          // Also update name for backwards compatibility
          this.set('config.name', target.value)
        },
        blur: ({ target }) => {
          if (!target.value.trim()) {
            target.classList.add('invalid')
          } else {
            target.classList.remove('invalid')
          }
        },
      },
    }

    const descriptionInput = {
      tag: 'input',
      className: 'section-description-input',
      attrs: {
        type: 'text',
        placeholder: i18n.get('section.description.placeholder') || 'Section description (optional)',
        value: this.get('config.description') || this.get('config.instruction') || '',
      },
      action: {
        input: ({ target }) => {
          this.set('config.description', target.value)
          // Also update instruction for backwards compatibility
          this.set('config.instruction', target.value)
        },
      },
    }

    const headerContent = {
      className: 'section-header-content',
      content: [titleInput, descriptionInput],
    }

    return {
      className: 'section-header',
      content: [collapseToggle, dragHandle, headerContent],
    }
  }

  /**
   * Toggle the collapsed state of the section
   */
  toggleCollapse() {
    const isCollapsed = this.get('config.collapsed')
    this.set('config.collapsed', !isCollapsed)
    this.dom.classList.toggle('collapsed', !isCollapsed)
  }

  /**
   * Select this section and show its settings in the Settings tab
   */
  selectSection = () => {
    // Dispatch custom event that Controls will listen for
    const event = new CustomEvent('formeo:section:selected', {
      detail: { section: this },
      bubbles: true,
    })
    document.dispatchEvent(event)
  }

  /**
   * Override onAdd to validate that sections cannot be nested
   * @param {Object} evt - Sortable event
   * @return {Object|undefined} component if added, undefined if prevented
   */
  async onAdd(evt) {
    const { from, to, item } = evt

    // Check if trying to nest a section inside a section
    if (item.classList && item.classList.contains(SECTION_CLASSNAME)) {
      alert('Sections cannot be nested inside other sections.')
      this._invalidDrop = { item, to }
      return undefined
    }

    // Allow rows, columns, and fields - call parent onAdd
    return super.onAdd(evt)
  }

  /**
   * Check if the dragged item is a form field (not a layout control)
   * @param {HTMLElement} item - The element being dragged
   * @return {Promise<Boolean>} true if it's a form field
   */
  async isFormField(item) {
    // Check if it's from the controls panel
    if (!item || !item.id) {
      return false
    }

    // Lazy import Controls to avoid circular dependency
    const { default: Controls } = await import('../controls/index.js')
    const controlData = Controls.get(item.id)
    if (!controlData) {
      return false
    }

    const { meta } = controlData.controlData || {}
    if (!meta) {
      return false
    }

    // If it's a layout control (like section, row, column), it's not a form field
    if (meta.group === 'layout') {
      return false
    }

    // If meta.id starts with 'layout-', it's a layout control
    if (meta.id && meta.id.startsWith('layout-')) {
      return false
    }

    // Otherwise, it's a form field
    return true
  }

  /**
   * Store invalid drop info to clean up in onEnd
   */
  _invalidDrop = null

  /**
   * Override onEnd to clean up invalid drops after Sortable finishes
   * @param {Object} evt - Sortable event
   */
  onEnd(evt) {
    if (this._invalidDrop) {
      const { item, to } = this._invalidDrop
      this._invalidDrop = null

      // Remove the clone that was added to the section
      if (item && item.parentNode === to && to.contains(item)) {
        requestAnimationFrame(() => {
          if (item.parentNode === to) {
            item.parentNode.removeChild(item)
          }
        })
      }
    }

    // Update order when section is moved
    this.updateOrder()

    // Call parent onEnd
    super.onEnd(evt)
  }

  /**
   * Update the order of this section based on its position in the stage
   */
  updateOrder() {
    const parent = this.parent
    if (parent && parent.name === 'stage') {
      const stageChildren = parent.get('children') || []
      const order = stageChildren.indexOf(this.id) + 1
      this.set('order', order)
    }
  }

  /**
   * Override onSort to update order when section is reordered
   */
  onSort() {
    this.updateOrder()
    return super.onSort()
  }

  /**
   * Override getComponentTag to show just "Section" text
   */
  getComponentTag() {
    return dom.create({
      tag: 'span',
      className: ['component-tag', `${this.name}-tag`],
      children: ['Section'],
    })
  }

  /**
   * Override buttons getter for sections to use shared actions from component.js
   * Only customize the edit button to call selectSection instead of toggleEdit
   */
  get buttons() {
    // Get buttons from parent Component class
    const buttons = super.buttons

    // Customize edit button to call selectSection instead of toggleEdit
    const editButton = buttons.find(btn => btn.meta?.id === 'edit')
    if (editButton) {
      editButton.action = {
        click: () => {
          this.selectSection()
        },
      }
    }

    return buttons
  }
}
