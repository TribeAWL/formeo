const defaultOptions = Object.freeze({
  sortable: true,
  elementOrder: {},
  groupOrder: [],
  groups: [
    {
      id: 'layout',
      label: 'Layout',
      elementOrder: ['row', 'column'],
    },
    {
      id: 'common',
      label: 'Form Fields',
      elementOrder: ['button', 'checkbox'],
    },
    {
      id: 'html',
      label: 'HTML Elements',
      elementOrder: ['header', 'block-text'],
    },
    {
      id: 'settings',
      label: 'Settings',
      elementOrder: [],
    },
  ],
  disable: {
    groups: [],
    elements: [],
    formActions: [],
  },
  elements: [],
  container: null,
  panels: { displayType: 'auto' },
})

export default defaultOptions
