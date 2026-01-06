import i18n from '@draggable/i18n'
import Sortable from 'sortablejs'
import dom from '../../common/dom.js'
import { ROW_CLASSNAME, STAGE_CLASSNAME } from '../../constants.js'
import Component from '../component.js'

export const SECTION_CLASSNAME = 'formeo-section'

const DEFAULT_DATA = () =>
  Object.freeze({
    config: {
      name: '',
      instruction: '',
      collapsed: false,
    },
    children: [],
    className: [SECTION_CLASSNAME, STAGE_CLASSNAME],
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
      content: [sectionHeader, this.getActionButtons(), this.editWindow, children],
    })

    // Make children sortable (can contain rows)
    Sortable.create(children, {
      animation: 150,
      fallbackClass: 'row-moving',
      forceFallback: true,
      group: {
        name: 'section',
        pull: true,
        put: ['row', 'column', 'controls'],
      },
      sort: true,
      disabled: false,
      onRemove: this.onRemove.bind(this),
      onEnd: this.onEnd.bind(this),
      onAdd: this.onAdd.bind(this),
      onSort: this.onSort.bind(this),
      draggable: `.${ROW_CLASSNAME}`,
      handle: '.item-move',
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

    const nameInput = {
      tag: 'input',
      className: 'section-name-input',
      attrs: {
        type: 'text',
        placeholder: i18n.get('section.name.placeholder') || 'Section name (required)',
        value: this.get('config.name') || '',
        required: true,
      },
      action: {
        input: ({ target }) => {
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

    const instructionInput = {
      tag: 'input',
      className: 'section-instruction-input',
      attrs: {
        type: 'text',
        placeholder: i18n.get('section.instruction.placeholder') || 'Add instruction or context (optional)',
        value: this.get('config.instruction') || '',
      },
      action: {
        input: ({ target }) => {
          this.set('config.instruction', target.value)
        },
      },
    }

    const headerContent = {
      className: 'section-header-content',
      content: [nameInput, instructionInput],
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
   * Edit window for Section
   * @return {Object} edit window dom config for Section
   */
  get editWindow() {
    const nameInput = {
      tag: 'input',
      id: `${this.id}-name`,
      attrs: {
        type: 'text',
        value: this.get('config.name') || '',
        placeholder: 'Section name',
      },
      config: {
        label: i18n.get('section.name') || 'Section Name',
      },
      action: {
        input: ({ target }) => {
          this.set('config.name', target.value)
          // Update the inline input as well
          const inlineInput = this.dom.querySelector('.section-name-input')
          if (inlineInput) {
            inlineInput.value = target.value
          }
        },
      },
    }

    const instructionInput = {
      tag: 'textarea',
      id: `${this.id}-instruction`,
      attrs: {
        value: this.get('config.instruction') || '',
        placeholder: 'Add instruction or context for this section',
        rows: 3,
      },
      config: {
        label: i18n.get('section.instruction') || 'Section Instruction (optional)',
      },
      action: {
        input: ({ target }) => {
          this.set('config.instruction', target.value)
          // Update the inline input as well
          const inlineInput = this.dom.querySelector('.section-instruction-input')
          if (inlineInput) {
            inlineInput.value = target.value
          }
        },
      },
    }

    const editWindow = dom.create({
      className: `${this.name}-edit group-config`,
      content: [dom.create(dom.formGroup(nameInput)), dom.create(dom.formGroup(instructionInput))],
    })

    return editWindow
  }
}
