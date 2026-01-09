import i18n from '@draggable/i18n'
import Sortable from 'sortablejs'
import animate from '../../common/animation.js'
import dom from '../../common/dom.js'
import { componentType, debounce } from '../../common/utils/index.mjs'
import {
  ANIMATION_SPEED_BASE,
  CONDITION_TEMPLATE,
  CONTROL_GROUP_CLASSNAME,
  ROW_CLASSNAME,
  SECTION_CLASSNAME,
  STAGE_CLASSNAME,
} from '../../constants.js'
import Component from '../component.js'
import Sections from '../sections/index.js'
import Stages from './index.js'

const DEFAULT_DATA = () => ({ conditions: [CONDITION_TEMPLATE()], children: [] })

/**
 * Stage is where fields and elements are dragged to.
 */
export default class Stage extends Component {
  /**
   * Process options and load existing fields from data to the stage
   * @param  {Object} formeoOptions
   * @param  {String} stageData uuid
   * @return {Object} DOM element
   */
  constructor(stageData) {
    super('stage', { ...DEFAULT_DATA(), ...stageData })

    this.updateEditPanels()

    this.debouncedUpdateEditPanels = debounce(this.updateEditPanels)

    // @todo move formSettings to its own component
    const _stageSettings = {
      className: 'stage-settings',
      children: [
        {
          tag: 'input',
          id: 'form-title',
          attrs: {
            className: 'form-title',
            placeholder: i18n.get('Untitled Form'),
            value: i18n.get('Untitled Form'),
            type: 'text',
          },
          config: {
            label: i18n.get('Form Title') || 'Stage Title',
          },
        },
        {
          tag: 'input',
          id: 'form-novalidate',
          attrs: {
            className: 'form-novalidate',
            value: false,
            type: 'checkbox',
          },
          config: {
            label: i18n.get('Form novalidate'),
          },
        },
        {
          tag: 'input',
          id: 'form-tags',
          attrs: {
            className: 'form-tags',
            type: 'text',
          },
          config: {
            label: i18n.get('Tags'),
          },
        },
      ],
    }

    // const editPanel = new EditPanel(stageData.conditions, 'conditions', this)

    const children = this.createChildWrap()

    this.dom = dom.create({
      attrs: {
        className: [STAGE_CLASSNAME, 'empty'],
        id: this.id,
      },
      children: [this.getComponentTag(), this.getActionButtons(), this.editWindow, children],
    })

    Sortable.create(children, {
      animation: 150,
      fallbackClass: 'row-moving',
      group: {
        name: 'stage',
        pull: true,
        put: ['row', 'column', 'controls', 'section'],
      },
      sort: true,
      disabled: false,
      onAdd: this.onAdd.bind(this),
      onRemove: this.onRemove.bind(this),
      onStart: () => {
        Stages.active = this
      },
      onSort: this.onSort.bind(this),
      onEnd: this.onEndValidation.bind(this),
      draggable: `.${ROW_CLASSNAME}, .${SECTION_CLASSNAME}`,
      handle: '.item-move',
    })
  }
  empty(isAnimated = true) {
    return new Promise(resolve => {
      if (isAnimated) {
        this.dom.classList.add('removing-all-fields')
        animate.slideUp(this.dom, ANIMATION_SPEED_BASE, () => {
          resolve(super.empty(isAnimated))
          this.dom.classList.remove('removing-all-fields')
          animate.slideDown(this.dom, ANIMATION_SPEED_BASE)
        })
      } else {
        resolve(super.empty())
      }
    })
  }

  /**
   * Check if a section exists in the stage
   * @return {Boolean} true if at least one section exists
   */
  hasSection() {
    const sections = Object.keys(Sections.data || {})
    return sections.length > 0
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

    // If it's a layout control (like section), it's not a form field
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
   * Check if the drop target is a section or inside a section
   * @param {HTMLElement} target - The drop target element
   * @return {Boolean} true if target is a section or inside a section
   */
  isDroppingIntoSection(target) {
    if (!target) {
      return false
    }
    // Check if target itself is a section
    if (target.classList && target.classList.contains(SECTION_CLASSNAME)) {
      return true
    }
    // Check if target is the .children container inside a section
    if (target.classList && target.classList.contains('children')) {
      const section = target.closest(`.${SECTION_CLASSNAME}`)
      if (section) {
        return true
      }
    }
    // Check if target is inside a section (traverse up the DOM)
    const section = target.closest(`.${SECTION_CLASSNAME}`)
    return !!section
  }

  /**
   * Store invalid drop info to clean up in onEnd
   */
  _invalidDrop = null

  /**
   * Override onEnd to clean up invalid drops after Sortable finishes
   * This ensures the clone is removed without affecting the original in controls panel
   * @param {Object} evt - Sortable event
   */
  onEndValidation(evt) {
    if (!this._invalidDrop) {
      return
    }

    const { item, to } = this._invalidDrop
    this._invalidDrop = null

    // Remove the clone that was added to the stage (the original stays in controls panel)
    // The item here is the clone, not the original, so removing it is safe
    if (item && item.parentNode === to && to.contains(item)) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (item.parentNode === to) {
          item.parentNode.removeChild(item)
        }
      })
    }
  }

  /**
   * Override onAdd to validate form fields before adding
   * @param {Object} evt - Sortable event
   * @return {Object|undefined} component if added, undefined if prevented
   */
  async onAdd(evt) {
    const { from, to, item } = evt

    // Check if item is from controls panel
    let fromElement = from
    if (from && !from.classList.contains(CONTROL_GROUP_CLASSNAME)) {
      fromElement = from.parentElement
    }

    const fromType = componentType(fromElement)

    // Only validate if dropping directly on the stage's children container (not into a section)
    // If dropping into a section, the Section's Sortable will handle it, and to will be the section's .children
    const stageChildren = this.dom.querySelector('.children')
    const isDroppingOnStage = to === stageChildren

    if ((fromType === 'controls' || fromType === CONTROL_GROUP_CLASSNAME) && isDroppingOnStage) {
      // Check if it's a form field
      const isField = await this.isFormField(item)

      if (isField) {
        // Check if there's at least one section in the stage
        if (!this.hasSection()) {
          // Show alert message
          alert(
            'Please add a section first before dragging form fields. Select "Section" from the layout fields, then you can drag and drop form fields into it.'
          )
          // Store info to remove the clone in onEnd (after Sortable finishes)
          // The item here is the clone, not the original
          this._invalidDrop = { item, to }
          // Still need to call parent onAdd to let Sortable process, but we'll remove it in onEnd
          // Actually, let's not call it to prevent component creation
          return undefined
        } else {
          // There are sections but dropping directly on stage - show alert
          alert('Please drag form fields into a section. Form fields can only be added inside sections.')
          // Store info to remove the clone in onEnd (after Sortable finishes)
          this._invalidDrop = { item, to }
          // Don't create component, but Sortable has already added the clone to DOM
          return undefined
        }
      }
    }

    // Call parent onAdd if validation passes (this includes drops into sections)
    const component = super.onAdd(evt)
    if (component?.name === 'column') {
      component.parent.autoColumnWidths()
    }
    return component
  }
}
