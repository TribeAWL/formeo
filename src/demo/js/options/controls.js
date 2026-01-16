// this code render form fields
const controls = {
  sortable: false,
  groupOrder: ['common', 'layout', 'settings'],
  panels: { displayType: 'tabbed' },
  disable: {
    formActions: ['clearBtn', 'saveBtn'],
    groups: ['html'],
    // Disable all default controls that we're replacing with custom versions
    elements: [
      // Form controls we're replacing
      'text-input',
      'checkbox',
      'select',
      'radio',
      'number',
      'date-input',
      'button',
      'upload',
      // Form controls we don't want
      'hidden',
      'textarea',
      // HTML controls - we're adding our own versions to common group
      'html.header',
      'paragraph',
      'divider',
      'tinymce',
      'block-text',
    ],
  },
  elements: [
    // Header - moved to common group with new icon
    {
      tag: 'h1',
      attrs: {
        tag: [
          { label: 'H1', value: 'h1', selected: true },
          { label: 'H2', value: 'h2' },
          { label: 'H3', value: 'h3' },
          { label: 'H4', value: 'h4' },
        ],
        className: '',
      },
      config: {
        label: 'Header',
        hideLabel: true,
        editableContent: true,
      },
      meta: {
        group: 'common',
        icon: 'header-t',
        id: 'ctrl-header',
      },
      content: 'Header',
    },
    // Text Input with new icon
    {
      tag: 'input',
      attrs: {
        required: false,
        type: 'text',
        className: '',
      },
      config: {
        label: 'Text Input',
      },
      meta: {
        group: 'common',
        icon: 'text-input-pilcrow',
        id: 'ctrl-textfield',
      },
    },
    // Paragraph - moved to common group with new icon
    {
      tag: 'p',
      attrs: {
        className: '',
      },
      config: {
        label: 'Paragraph',
        hideLabel: true,
        editableContent: true,
      },
      meta: {
        group: 'common',
        icon: 'paragraph-lines',
        id: 'ctrl-para',
      },
      content: 'Enter your paragraph text here.',
    },
    // Checkbox (simplified label)
    {
      tag: 'input',
      attrs: {
        type: 'checkbox',
        required: false,
      },
      config: {
        label: 'Checkbox',
        disabledAttrs: ['type'],
      },
      meta: {
        group: 'common',
        icon: 'checkbox-check',
        id: 'ctrl-check',
      },
      options: [{ label: 'Option 1', value: 'option-1', checked: false }],
    },
    // Dropdown (renamed from Select)
    {
      tag: 'select',
      config: {
        label: 'Dropdown',
      },
      attrs: {
        required: false,
        className: '',
        multiple: false,
      },
      meta: {
        group: 'common',
        icon: 'dropdown-chevron',
        id: 'ctrl-dropdown',
      },
      options: [
        { label: 'Option 1', value: 'option-1', selected: false },
        { label: 'Option 2', value: 'option-2', selected: false },
        { label: 'Option 3', value: 'option-3', selected: false },
      ],
    },
    // Radio (simplified label)
    {
      tag: 'input',
      attrs: {
        type: 'radio',
        required: false,
      },
      config: {
        label: 'Radio',
        disabled: ['attrs.type'],
      },
      meta: {
        group: 'common',
        icon: 'radio-circle',
        id: 'ctrl-rd',
      },
      options: [
        { label: 'Option 1', value: 'option-1', selected: false },
        { label: 'Option 2', value: 'option-2', selected: false },
        { label: 'Option 3', value: 'option-3', selected: false },
      ],
    },
    // Email
    {
      tag: 'input',
      config: {
        label: 'Email',
        disabledAttrs: ['type'],
      },
      meta: {
        group: 'common',
        id: 'ctrl-email',
        icon: 'email-envelope',
      },
      attrs: {
        className: '',
        type: 'email',
        required: false,
      },
    },
    // Number
    {
      tag: 'input',
      attrs: {
        type: 'number',
        required: false,
        className: '',
      },
      config: {
        label: 'Number',
      },
      meta: {
        group: 'common',
        icon: 'number-hash',
        id: 'ctrl-num',
      },
    },
    // Date
    {
      tag: 'input',
      attrs: {
        type: 'date',
        required: false,
        className: '',
      },
      config: {
        label: 'Date',
      },
      meta: {
        group: 'common',
        icon: 'date-calendar',
        id: 'ctrl-date',
      },
    },
    // Button
    {
      tag: 'button',
      attrs: {
        className: [
          { label: 'grouped', value: 'f-btn-group' },
          { label: 'ungrouped', value: 'f-field-group' },
        ],
      },
      config: {
        label: 'Button',
        hideLabel: true,
      },
      meta: {
        group: 'common',
        icon: 'button-line',
        id: 'ctrl-btn',
      },
      options: [
        {
          label: 'Button',
          type: [
            { label: 'button', value: 'button', selected: true },
            { label: 'submit', value: 'submit' },
            { label: 'reset', value: 'reset' },
          ],
          className: [
            { label: 'default', value: '', selected: true },
            { label: 'primary', value: 'primary' },
            { label: 'danger', value: 'error' },
            { label: 'success', value: 'success' },
          ],
        },
      ],
    },
    // File Upload
    {
      tag: 'input',
      attrs: {
        type: 'file',
        required: false,
      },
      config: {
        label: 'File Upload',
      },
      meta: {
        group: 'common',
        icon: 'file-upload-image',
        id: 'ctrl-file',
      },
    },
    // Divider - moved to common group
    {
      tag: 'hr',
      config: {
        label: 'Divider',
        hideLabel: true,
      },
      meta: {
        group: 'common',
        icon: 'divider-dots',
        id: 'ctrl-hr',
      },
    },
  ],
  elementOrder: {
    common: [
      'ctrl-header',
      'ctrl-textfield',
      'ctrl-para',
      'ctrl-check',
      'ctrl-dropdown',
      'ctrl-rd',
      'ctrl-email',
      'ctrl-num',
      'ctrl-date',
      'ctrl-btn',
      'ctrl-file',
      'ctrl-hr',
    ],
  },
}

export default controls
