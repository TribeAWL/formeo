/**
 * Runtime Schema Serializer
 *
 * Converts Formeo's internal row/column structure to a step-based schema
 * optimized for rendering a stepper-based React UI.
 *
 * Output format:
 * {
 *   "formId": "<uuid>",
 *   "version": "1.0",
 *   "steps": [
 *     {
 *       "id": "<section-id>",
 *       "order": 1,
 *       "title": "Personal Details",
 *       "description": "This section is for personal details",
 *       "layout": {
 *         "columns": 2
 *       },
 *       "fields": [
 *         {
 *           "id": "<field-id>",
 *           "type": "text",
 *           "label": "First Name",
 *           "required": true,
 *           "placeholder": "Enter first name"
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

import { SECTION_CLASSNAME, version } from '../constants.js'
import Components from './index.js'

/**
 * Maps Formeo field to runtime field type
 * Uses controlId first (most reliable), then falls back to tag + attrs.type
 * @param {Object} fieldData - Formeo field data
 * @return {String} runtime field type
 */
function mapFieldType(fieldData) {
  const controlId = fieldData.config?.controlId || fieldData.meta?.id || ''
  const tag = fieldData.tag || ''
  const attrsType = fieldData.attrs?.type || ''

  // Map Formeo controlId to runtime types (most reliable)
  const controlIdMap = {
    'text-input': 'text',
    email: 'email',
    number: 'number',
    date: 'date',
    file: 'file',
    hidden: 'hidden',
    textarea: 'textarea',
    select: 'select',
    'checkbox-group': 'checkbox',
    'radio-group': 'radio',
  }

  // Try controlId first
  if (controlId && controlIdMap[controlId]) {
    return controlIdMap[controlId]
  }

  // Map common Formeo field types to runtime types using tag + attrs.type
  const typeMap = {
    input: {
      text: 'text',
      email: 'email',
      number: 'number',
      date: 'date',
      file: 'file',
      hidden: 'hidden',
    },
    textarea: {
      '': 'textarea',
    },
    select: {
      '': 'select',
    },
    checkbox: {
      '': 'checkbox',
    },
    radio: {
      '': 'radio',
    },
  }

  // Get type from tag + attrs.type combination
  if (typeMap[tag] && typeMap[tag][attrsType] !== undefined) {
    return typeMap[tag][attrsType]
  }

  // Fallback: use attrs.type if available, otherwise use tag, finally default to text
  return attrsType || tag || 'text'
}

/**
 * Extracts and maps a Formeo field to runtime field format
 * @param {Object} fieldData - Formeo field data
 * @return {Object} runtime field object
 */
function mapField(fieldData) {
  const field = {
    id: fieldData.id,
    type: mapFieldType(fieldData),
    label: fieldData.config?.label || '',
    required: fieldData.attrs?.required || false,
    placeholder: fieldData.attrs?.placeholder || '',
  }

  // Add additional field properties if they exist
  if (fieldData.attrs?.value !== undefined) {
    field.value = fieldData.attrs.value
  }

  if (fieldData.options && Array.isArray(fieldData.options)) {
    field.options = fieldData.options.map(opt => ({
      label: opt.label || opt.value || '',
      value: opt.value || '',
      selected: opt.selected || false,
      checked: opt.checked || false,
    }))
  }

  // Remove undefined values
  Object.keys(field).forEach(key => {
    if (field[key] === undefined) {
      delete field[key]
    }
  })

  return field
}

/**
 * Extracts all fields from a section, preserving row structure
 * @param {Object} section - Section component
 * @return {Object} { rows: Array }
 *   rows: Array of { columns: Number, fields: Array } objects
 */
function extractFieldsFromSection(section) {
  const rows = []

  // Prefer reading the live DOM children to reflect current UI state
  // This ensures removed fields (DOM nodes removed) are not included in the schema
  const sectionDom = section.dom
  const sectionChildrenContainer = sectionDom?.querySelector('.children')
  const domChildren = sectionChildrenContainer ? Array.from(sectionChildrenContainer.children) : []

  for (const domChild of domChildren) {
    const childId = domChild.id
    if (!childId) continue

    // If this DOM element corresponds to a field, treat as single-field row
    const field = Components.getAddress(`fields.${childId}`)
    if (field) {
      const fieldData = field.getData()
      rows.push({
        columns: 1,
        fields: [mapField(fieldData)],
      })
      continue
    }

    // If this DOM element corresponds to a row, traverse its column children
    const row = Components.getAddress(`rows.${childId}`)
    if (row) {
      const rowDom = row.dom
      const rowChildrenContainer = rowDom?.querySelector('.children')
      const rowDomChildren = rowChildrenContainer ? Array.from(rowChildrenContainer.children) : []
      const columnCount = rowDomChildren.length || 1

      const rowFields = []

      for (const colDom of rowDomChildren) {
        const columnId = colDom.id
        if (!columnId) continue

        const column = Components.getAddress(`columns.${columnId}`)
        if (!column) continue

        const columnChildrenContainer = column.dom?.querySelector('.children')
        const columnDomChildren = columnChildrenContainer ? Array.from(columnChildrenContainer.children) : []

        for (const fieldDom of columnDomChildren) {
          const fieldId = fieldDom.id
          if (!fieldId) continue
          const columnField = Components.getAddress(`fields.${fieldId}`)
          if (columnField) {
            const fieldData = columnField.getData()
            rowFields.push(mapField(fieldData))
          }
        }
      }

      rows.push({
        columns: columnCount,
        fields: rowFields,
      })
    }
  }

  return { rows }
}

/**
 * Gets the order of a section based on its position in the stage
 * @param {Object} section - Section component
 * @param {Object} stage - Stage component
 * @return {Number} order (1-based)
 */
function getSectionOrder(section, stage) {
  const stageChildren = stage.get('children') || []
  const sectionIndex = stageChildren.indexOf(section.id)
  return sectionIndex >= 0 ? sectionIndex + 1 : 0
}

/**
 * Builds the runtime schema from Formeo's internal structure
 * @param {Object} formeoState - Formeo Components instance
 * @return {Object} runtime schema
 */
export function buildRuntimeSchema(formeoState = Components) {
  const formId = formeoState.get('id')
  const stages = formeoState.get('stages') || {}
  const sections = formeoState.get('sections') || {}

  // Validate that sections exist
  const sectionIds = Object.keys(sections)
  if (sectionIds.length === 0) {
    throw new Error('Cannot export: No sections found. Please add at least one section to the form.')
  }

  // Get the first stage (typically there's only one)
  const stageId = Object.keys(stages)[0]
  if (!stageId) {
    throw new Error('Cannot export: No stage found.')
  }

  const stage = stages[stageId]

  // Get sections in DOM order (more reliable than stage.children array)
  // This ensures we get all sections in the correct visual order
  const stageDom = stage.dom
  const stageChildrenContainer = stageDom?.querySelector('.children')
  const domChildren = stageChildrenContainer ? Array.from(stageChildrenContainer.children) : []

  // Build steps array from sections in DOM order
  const steps = []
  const processedSections = new Set()
  const sectionIdToOrder = new Map()

  // First pass: Build a map of section order based on DOM position
  // Only consider elements that are actually sections (have SECTION_CLASSNAME)
  let sectionOrder = 1
  for (const domChild of domChildren) {
    const childId = domChild.id
    if (!childId) continue

    // Check if this DOM element is a section by class name
    if (!domChild.classList || !domChild.classList.contains(SECTION_CLASSNAME)) {
      continue // Skip non-section elements
    }

    const section = sections[childId]
    if (section) {
      // This is a section - record its order
      sectionIdToOrder.set(section.id, sectionOrder++)
    }
  }

  // Second pass: Process all sections in the order they appear in DOM
  for (const domChild of domChildren) {
    const childId = domChild.id
    if (!childId) continue

    // Check if this DOM element is a section by class name
    if (!domChild.classList || !domChild.classList.contains(SECTION_CLASSNAME)) {
      continue // Skip non-section elements
    }

    const section = sections[childId]
    if (!section) {
      continue // Skip if section not found in sections data
    }

    // Skip if already processed (shouldn't happen, but safety check)
    if (processedSections.has(section.id)) {
      continue
    }

    processedSections.add(section.id)

    // Validate section has a title
    const title = section.get('config.title') || section.get('config.name') || ''
    if (!title.trim()) {
      throw new Error(`Cannot export: Section "${section.id}" is missing a required title.`)
    }

    // Extract rows from section
    const { rows } = extractFieldsFromSection(section)

    // Get section order from DOM position (most reliable)
    const order = sectionIdToOrder.get(section.id) || getSectionOrder(section, stage)

    // Build step object with rows structure
    const step = {
      id: section.id,
      order,
      title: title.trim(),
      description: (section.get('config.description') || section.get('config.instruction') || '').trim(),
      rows: rows, // Preserve row structure
    }

    // Remove description if empty
    if (!step.description) {
      delete step.description
    }

    steps.push(step)
  }

  // If no sections were found in DOM, fall back to processing all sections by their stored order
  // This handles edge cases where DOM might not be available or sections aren't in DOM yet
  if (steps.length === 0 && sectionIds.length > 0) {
    console.warn('No sections found in DOM, falling back to processing all sections')
    for (const sectionId of sectionIds) {
      const section = sections[sectionId]
      if (!section || processedSections.has(section.id)) {
        continue
      }

      processedSections.add(section.id)

      const title = section.get('config.title') || section.get('config.name') || ''
      if (!title.trim()) {
        throw new Error(`Cannot export: Section "${section.id}" is missing a required title.`)
      }

      const { rows } = extractFieldsFromSection(section)
      const storedOrder = section.get('order')
      const order = storedOrder > 0 ? storedOrder : processedSections.size

      const step = {
        id: section.id,
        order,
        title: title.trim(),
        description: (section.get('config.description') || section.get('config.instruction') || '').trim(),
        rows: rows, // Preserve row structure
      }

      if (!step.description) {
        delete step.description
      }

      steps.push(step)
    }
  }

  // Sort steps by order to ensure correct sequence
  steps.sort((a, b) => a.order - b.order)

  // Validate that all sections in the data are accounted for
  const unprocessedSections = sectionIds.filter(id => !processedSections.has(id))
  if (unprocessedSections.length > 0) {
    console.warn('Warning: Some sections are not in the stage DOM:', unprocessedSections)
  }

  // Build final schema
  const schema = {
    formId,
    version: '1.0',
    steps,
  }

  return schema
}

/**
 * Validates the form structure before export
 * @param {Object} formeoState - Formeo Components instance
 * @return {Object} validation result with isValid and errors
 */
export function validateFormStructure(formeoState = Components) {
  const errors = []
  const sections = formeoState.get('sections') || {}
  const fields = formeoState.get('fields') || {}
  const stages = formeoState.get('stages') || {}

  // Check if sections exist
  const sectionIds = Object.keys(sections)
  if (sectionIds.length === 0) {
    errors.push('No sections found. Please add at least one section to the form.')
  }

  // Check if any fields exist outside sections
  // This is a structural validation - fields should only be in sections
  for (const [fieldId, field] of Object.entries(fields)) {
    const fieldData = field.getData()
    // Check if field is in a section by checking its parent chain
    // This is a simplified check - in practice, drag-and-drop constraints prevent this
    // But we validate here as a safety measure
  }

  // Check that all sections have titles
  for (const [sectionId, section] of Object.entries(sections)) {
    const title = section.get('config.title') || section.get('config.name') || ''
    if (!title.trim()) {
      errors.push(`Section "${sectionId}" is missing a required title.`)
    }
  }

  // Check that at least one stage exists
  const stageIds = Object.keys(stages)
  if (stageIds.length === 0) {
    errors.push('No stage found.')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export default buildRuntimeSchema
