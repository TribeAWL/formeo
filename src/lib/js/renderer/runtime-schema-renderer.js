/**
 * Runtime Schema Renderer
 *
 * Renders a multi-step form UI based on the runtime schema format.
 * Creates a professional stepper interface with sidebar navigation and form content.
 */

import { buildRuntimeSchema } from '../components/runtime-schema.js'

/**
 * Renders a multi-step form from runtime schema
 * @param {Object} schema - Runtime schema object
 * @param {HTMLElement} container - Container element to render into
 * @return {HTMLElement} The rendered form element
 */
export function renderRuntimeSchemaForm(schema, container) {
  // Clear container
  container.innerHTML = ''

  // Create main wrapper
  const wrapper = document.createElement('div')
  wrapper.className = 'runtime-schema-form-wrapper'

  // Create sidebar for step navigation
  const sidebar = createSidebar(schema.steps)

  // Create main content area
  const mainContent = document.createElement('div')
  mainContent.className = 'runtime-schema-form-content'

  // Create form element
  const form = document.createElement('form')
  form.className = 'runtime-schema-form'
  form.id = `form-${schema.formId || 'default'}`

  // Render all steps (initially hidden, show first)
  schema.steps.forEach((step, index) => {
    const stepElement = renderStep(step, index === 0)
    form.appendChild(stepElement)
  })

  // Add navigation buttons
  const navigation = createNavigation(schema.steps.length)
  form.appendChild(navigation)

  mainContent.appendChild(form)
  wrapper.appendChild(sidebar)
  wrapper.appendChild(mainContent)

  container.appendChild(wrapper)

  // Initialize step navigation with schema for validation
  initializeStepNavigation(wrapper, schema.steps.length, schema)

  return wrapper
}

/**
 * Creates the sidebar with step navigation
 * @param {Array} steps - Array of step objects
 * @return {HTMLElement} Sidebar element
 */
function createSidebar(steps) {
  const sidebar = document.createElement('div')
  sidebar.className = 'runtime-schema-sidebar'

  const stepsList = document.createElement('ul')
  stepsList.className = 'runtime-schema-steps-list'

  steps.forEach((step, index) => {
    const stepItem = document.createElement('li')
    stepItem.className = 'runtime-schema-step-item'
    stepItem.dataset.stepIndex = index
    if (index === 0) {
      stepItem.classList.add('active')
    }

    const stepNumber = document.createElement('div')
    stepNumber.className = 'runtime-schema-step-number'
    stepNumber.textContent = step.order || index + 1

    const stepLabel = document.createElement('div')
    stepLabel.className = 'runtime-schema-step-label'
    stepLabel.textContent = step.title

    stepItem.appendChild(stepNumber)
    stepItem.appendChild(stepLabel)

    // Add connector line (except for last item)
    if (index < steps.length - 1) {
      const connector = document.createElement('div')
      connector.className = 'runtime-schema-step-connector'
      stepItem.appendChild(connector)
    }

    stepsList.appendChild(stepItem)
  })

  sidebar.appendChild(stepsList)
  return sidebar
}

/**
 * Renders a single step with its fields
 * @param {Object} step - Step object from schema
 * @param {Boolean} isActive - Whether this step is currently active
 * @return {HTMLElement} Step element
 */
function renderStep(step, isActive = false) {
  const stepElement = document.createElement('div')
  stepElement.className = 'runtime-schema-step'
  stepElement.dataset.stepId = step.id
  stepElement.dataset.stepOrder = step.order
  if (!isActive) {
    stepElement.style.display = 'none'
  }

  // Step header
  const stepHeader = document.createElement('h2')
  stepHeader.className = 'runtime-schema-step-header'
  stepHeader.textContent = step.title
  stepElement.appendChild(stepHeader)

  // Step description (if exists)
  if (step.description) {
    const stepDescription = document.createElement('p')
    stepDescription.className = 'runtime-schema-step-description'
    stepDescription.textContent = step.description
    stepElement.appendChild(stepDescription)
  }

  // Fields container
  const fieldsContainer = document.createElement('div')
  fieldsContainer.className = 'runtime-schema-fields-container'

  // Determine column layout
  const columns = step.layout?.columns || 2
  if (columns === 1) {
    fieldsContainer.style.gridTemplateColumns = '1fr'
  } else {
    fieldsContainer.style.gridTemplateColumns = `repeat(${Math.min(columns, 3)}, 1fr)`
  }

  // Render fields
  step.fields.forEach(field => {
    const fieldElement = renderField(field)
    fieldsContainer.appendChild(fieldElement)
  })

  stepElement.appendChild(fieldsContainer)

  return stepElement
}

/**
 * Renders a single form field
 * @param {Object} field - Field object from schema
 * @return {HTMLElement} Field element
 */
function renderField(field) {
  const fieldWrapper = document.createElement('div')
  fieldWrapper.className = 'runtime-schema-field-wrapper'

  // Create label
  const label = document.createElement('label')
  label.className = 'runtime-schema-field-label'
  label.htmlFor = `field-${field.id}`

  const labelText = document.createTextNode(field.label || '')
  label.appendChild(labelText)

  // Add required asterisk
  if (field.required) {
    const asterisk = document.createElement('span')
    asterisk.className = 'runtime-schema-required-asterisk'
    asterisk.textContent = ' *'
    asterisk.setAttribute('aria-label', 'required')
    label.appendChild(asterisk)
  }

  fieldWrapper.appendChild(label)

  // Create input based on field type
  let inputElement
  switch (field.type) {
    case 'textarea':
      inputElement = document.createElement('textarea')
      break
    case 'select':
      inputElement = document.createElement('select')
      if (field.options && Array.isArray(field.options)) {
        field.options.forEach(option => {
          const optionElement = document.createElement('option')
          optionElement.value = option.value || ''
          optionElement.textContent = option.label || option.value || ''
          if (option.selected || option.checked) {
            optionElement.selected = true
          }
          inputElement.appendChild(optionElement)
        })
      }
      break
    case 'radio':
      inputElement = createRadioGroup(field)
      break
    case 'checkbox':
      inputElement = createCheckboxGroup(field)
      break
    default:
      inputElement = document.createElement('input')
      inputElement.type = field.type || 'text'
  }

  // Set common attributes
  if (inputElement.tagName !== 'DIV') {
    inputElement.id = `field-${field.id}`
    inputElement.name = `field-${field.id}`
    inputElement.className = 'runtime-schema-field-input'

    if (field.placeholder) {
      inputElement.placeholder = field.placeholder
    }

    if (field.required) {
      inputElement.required = true
    }

    if (field.value !== undefined) {
      inputElement.value = field.value
    }

    // Special handling for date inputs
    if (field.type === 'date') {
      const dateWrapper = document.createElement('div')
      dateWrapper.className = 'runtime-schema-date-wrapper'
      dateWrapper.appendChild(inputElement)

      // Add calendar icon
      const calendarIcon = document.createElement('span')
      calendarIcon.className = 'runtime-schema-date-icon'
      calendarIcon.innerHTML = '📅'
      dateWrapper.appendChild(calendarIcon)

      fieldWrapper.appendChild(label)
      fieldWrapper.appendChild(dateWrapper)
      return fieldWrapper
    }

    // Special handling for select dropdowns
    if (field.type === 'select') {
      const selectWrapper = document.createElement('div')
      selectWrapper.className = 'runtime-schema-select-wrapper'
      selectWrapper.appendChild(inputElement)
      fieldWrapper.appendChild(label)
      fieldWrapper.appendChild(selectWrapper)
      return fieldWrapper
    }
  }

  fieldWrapper.appendChild(inputElement)

  return fieldWrapper
}

/**
 * Creates a radio button group
 * @param {Object} field - Field object
 * @return {HTMLElement} Container with radio buttons
 */
function createRadioGroup(field) {
  const container = document.createElement('div')
  container.className = 'runtime-schema-radio-group'

  if (field.options && Array.isArray(field.options)) {
    field.options.forEach((option, index) => {
      const radioWrapper = document.createElement('div')
      radioWrapper.className = 'runtime-schema-radio-option'

      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.id = `field-${field.id}-${index}`
      radio.name = `field-${field.id}`
      radio.value = option.value || ''
      radio.className = 'runtime-schema-field-input'

      if (option.checked || option.selected) {
        radio.checked = true
      }

      if (field.required) {
        radio.required = true
      }

      const radioLabel = document.createElement('label')
      radioLabel.htmlFor = `field-${field.id}-${index}`
      radioLabel.textContent = option.label || option.value || ''

      radioWrapper.appendChild(radio)
      radioWrapper.appendChild(radioLabel)
      container.appendChild(radioWrapper)
    })
  }

  return container
}

/**
 * Creates a checkbox group
 * @param {Object} field - Field object
 * @return {HTMLElement} Container with checkboxes
 */
function createCheckboxGroup(field) {
  const container = document.createElement('div')
  container.className = 'runtime-schema-checkbox-group'

  if (field.options && Array.isArray(field.options)) {
    field.options.forEach((option, index) => {
      const checkboxWrapper = document.createElement('div')
      checkboxWrapper.className = 'runtime-schema-checkbox-option'

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = `field-${field.id}-${index}`
      checkbox.name = `field-${field.id}`
      checkbox.value = option.value || ''
      checkbox.className = 'runtime-schema-field-input'

      if (option.checked || option.selected) {
        checkbox.checked = true
      }

      const checkboxLabel = document.createElement('label')
      checkboxLabel.htmlFor = `field-${field.id}-${index}`
      checkboxLabel.textContent = option.label || option.value || ''

      checkboxWrapper.appendChild(checkbox)
      checkboxWrapper.appendChild(checkboxLabel)
      container.appendChild(checkboxWrapper)
    })
  }

  return container
}

/**
 * Creates navigation buttons
 * @param {Number} totalSteps - Total number of steps
 * @return {HTMLElement} Navigation element
 */
function createNavigation(totalSteps) {
  const navigation = document.createElement('div')
  navigation.className = 'runtime-schema-navigation'

  const prevButton = document.createElement('button')
  prevButton.type = 'button'
  prevButton.className = 'runtime-schema-nav-button runtime-schema-nav-prev'
  prevButton.textContent = 'Previous'
  prevButton.style.display = 'none' // Hidden on first step

  const nextButton = document.createElement('button')
  nextButton.type = 'button'
  nextButton.className = 'runtime-schema-nav-button runtime-schema-nav-next'
  nextButton.textContent = totalSteps > 1 ? 'Next' : 'Start'

  navigation.appendChild(prevButton)
  navigation.appendChild(nextButton)

  return navigation
}

/**
 * Validates a single field based on its type and requirements
 * @param {HTMLElement} input - Input element
 * @param {Object} fieldSchema - Field schema from runtime schema
 * @return {Object} Validation result with isValid and error message
 */
function validateField(input, fieldSchema) {
  const value = input.value.trim()
  const label = fieldSchema.label || 'Field'

  // Check required fields
  if (fieldSchema.required && !value) {
    return {
      isValid: false,
      error: `${label} is required`,
    }
  }

  // Skip further validation if field is empty and not required
  if (!value && !fieldSchema.required) {
    return { isValid: true }
  }

  // Type-specific validation
  switch (fieldSchema.type) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (value && !emailRegex.test(value)) {
        return {
          isValid: false,
          error: `${label} must be a valid email address`,
        }
      }
      break
    }

    case 'number':
      if (value && isNaN(value)) {
        return {
          isValid: false,
          error: `${label} must be a valid number`,
        }
      }
      break

    case 'date':
      if (value && isNaN(Date.parse(value))) {
        return {
          isValid: false,
          error: `${label} must be a valid date`,
        }
      }
      break
  }

  return { isValid: true }
}

/**
 * Validates all fields in a step
 * @param {HTMLElement} stepElement - Step element
 * @param {Object} stepSchema - Step schema from runtime schema
 * @return {Object} Validation result with isValid, errors array, and invalidFields array
 */
function validateStep(stepElement, stepSchema) {
  const errors = []
  const invalidFields = []

  stepSchema.fields.forEach(fieldSchema => {
    // Find the input element for this field
    const input = stepElement.querySelector(`#field-${fieldSchema.id}`)

    // For radio groups, check if any is selected
    if (fieldSchema.type === 'radio') {
      const radios = stepElement.querySelectorAll(`input[name="field-${fieldSchema.id}"]`)
      if (radios.length > 0) {
        const isChecked = Array.from(radios).some(radio => radio.checked)
        if (fieldSchema.required && !isChecked) {
          errors.push(`${fieldSchema.label || 'Field'} is required`)
          // Mark all radio buttons in the group as invalid
          invalidFields.push(...Array.from(radios))
        }
        return
      }
    }

    // For checkbox groups, check if any is checked
    if (fieldSchema.type === 'checkbox') {
      const checkboxes = stepElement.querySelectorAll(`input[name="field-${fieldSchema.id}"]`)
      if (checkboxes.length > 0) {
        const isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked)
        if (fieldSchema.required && !isChecked) {
          errors.push(`${fieldSchema.label || 'Field'} is required`)
          // Mark all checkboxes in the group as invalid
          invalidFields.push(...Array.from(checkboxes))
        }
        return
      }
    }

    if (!input) {
      return // Field not found, skip
    }

    const validation = validateField(input, fieldSchema)
    if (!validation.isValid) {
      errors.push(validation.error)
      invalidFields.push(input)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    invalidFields,
  }
}

/**
 * Collects all form data from the rendered form
 * @param {HTMLElement} form - Form element
 * @param {Object} schema - Runtime schema
 * @return {Object} Form data object with field labels and values
 */
function collectFormData(form, schema) {
  const formData = {}

  schema.steps.forEach(step => {
    step.fields.forEach(field => {
      const fieldId = `field-${field.id}`
      let value = ''

      // Handle different field types
      if (field.type === 'radio') {
        const checkedRadio = form.querySelector(`input[name="${fieldId}"]:checked`)
        value = checkedRadio ? checkedRadio.value : ''
      } else if (field.type === 'checkbox') {
        const checkedBoxes = form.querySelectorAll(`input[name="${fieldId}"]:checked`)
        if (checkedBoxes.length > 0) {
          value = Array.from(checkedBoxes)
            .map(cb => cb.value)
            .join(', ')
        }
      } else {
        const input = form.querySelector(`#${fieldId}`)
        if (input) {
          value = input.value.trim()
        }
      }

      // Use field label as key (trimmed)
      const label = (field.label || `Field ${field.id}`).trim()
      formData[label] = value || ''
    })
  })

  return formData
}

/**
 * Initializes step navigation functionality
 * @param {HTMLElement} wrapper - Main wrapper element
 * @param {Number} totalSteps - Total number of steps
 * @param {Object} schema - Runtime schema object
 */
function initializeStepNavigation(wrapper, totalSteps, schema) {
  let currentStep = 0

  const steps = wrapper.querySelectorAll('.runtime-schema-step')
  const stepItems = wrapper.querySelectorAll('.runtime-schema-step-item')
  const prevButton = wrapper.querySelector('.runtime-schema-nav-prev')
  const nextButton = wrapper.querySelector('.runtime-schema-nav-next')
  const form = wrapper.querySelector('.runtime-schema-form')

  function showStep(stepIndex) {
    // Hide all steps
    steps.forEach((step, index) => {
      step.style.display = index === stepIndex ? 'block' : 'none'
    })

    // Update sidebar active state
    stepItems.forEach((item, index) => {
      item.classList.toggle('active', index === stepIndex)
    })

    // Update navigation buttons
    prevButton.style.display = stepIndex === 0 ? 'none' : 'block'
    if (stepIndex === 0) {
      nextButton.textContent = 'Start'
    } else if (stepIndex === totalSteps - 1) {
      nextButton.textContent = 'Submit'
    } else {
      nextButton.textContent = 'Next'
    }

    currentStep = stepIndex

    // Clear any previous error states
    const currentStepElement = steps[currentStep]
    if (currentStepElement) {
      const allInputs = currentStepElement.querySelectorAll('.runtime-schema-field-input, input, select, textarea')
      allInputs.forEach(input => {
        input.classList.remove('error')
      })
    }
  }

  // Next button handler
  nextButton.addEventListener('click', () => {
    const currentStepElement = steps[currentStep]
    const currentStepSchema = schema.steps[currentStep]

    // Validate current step
    const validation = validateStep(currentStepElement, currentStepSchema)

    if (!validation.isValid) {
      // Show error styling on invalid fields
      validation.invalidFields.forEach(field => {
        field.classList.add('error')
        // Scroll to first invalid field
        if (validation.invalidFields.indexOf(field) === 0) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })

      // Show alert with all errors
      const errorMessage = validation.errors.join('\n')
      alert(`Please fix the following errors:\n\n${errorMessage}`)
      return
    }

    // Clear error states
    const allInputs = currentStepElement.querySelectorAll('.runtime-schema-field-input, input, select, textarea')
    allInputs.forEach(input => {
      input.classList.remove('error')
    })

    // If valid, proceed to next step or submit
    if (currentStep < totalSteps - 1) {
      showStep(currentStep + 1)
    } else {
      // Last step - submit form
      const finalValidation = validateStep(currentStepElement, currentStepSchema)
      if (finalValidation.isValid) {
        // Collect all form data
        const formData = collectFormData(form, schema)

        // Format data for alert (simple format: label: value)
        let alertMessage = ''
        Object.entries(formData).forEach(([label, value]) => {
          alertMessage += `${label}: ${value}\n`
        })

        alert(alertMessage.trim())

        // Also dispatch submit event for any listeners
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      } else {
        // Show validation errors
        finalValidation.invalidFields.forEach(field => {
          field.classList.add('error')
        })
        const errorMessage = finalValidation.errors.join('\n')
        alert(`Please fix the following errors:\n\n${errorMessage}`)
      }
    }
  })

  // Previous button handler
  prevButton.addEventListener('click', () => {
    if (currentStep > 0) {
      showStep(currentStep - 1)
    }
  })

  // Sidebar step click handler
  stepItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      // Allow navigation to any previous step or current step
      if (index <= currentStep) {
        showStep(index)
      }
    })
  })

  // Add input event listeners to clear errors on input
  form.addEventListener('input', e => {
    if (e.target.classList.contains('error')) {
      e.target.classList.remove('error')
    }
  })

  // Add change event listeners for radio and checkbox
  form.addEventListener('change', e => {
    if (e.target.type === 'radio' || e.target.type === 'checkbox') {
      // Clear error from all radios/checkboxes in the same group
      const name = e.target.name
      const groupInputs = form.querySelectorAll(`input[name="${name}"]`)
      groupInputs.forEach(input => {
        input.classList.remove('error')
      })
    }
  })
}

/**
 * Gets HTML string from rendered form
 * @param {Object} schema - Runtime schema object
 * @return {String} HTML string
 */
export function getRuntimeSchemaHTML(schema) {
  const container = document.createElement('div')
  renderRuntimeSchemaForm(schema, container)
  return container.innerHTML
}

export default renderRuntimeSchemaForm
