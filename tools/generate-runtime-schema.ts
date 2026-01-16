import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Runtime schema structure based on formeo runtime requirements
const runtimeSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Formeo Runtime Schema',
  description: 'Schema for runtime form data used by Formeo renderer',
  type: 'object',
  properties: {
    formId: {
      type: 'string',
      description: 'Unique identifier for the form',
    },
    version: {
      type: 'string',
      description: 'Schema version',
      default: '1.0',
    },
    steps: {
      type: 'array',
      description: 'Array of form steps/sections',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the step',
          },
          order: {
            type: 'number',
            description: 'Order of the step in the form',
          },
          title: {
            type: 'string',
            description: 'Display title for the step',
          },
          description: {
            type: 'string',
            description: 'Optional description for the step',
          },
          rows: {
            type: 'array',
            description: 'Array of rows in this step',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier for the row',
                },
                columns: {
                  type: 'array',
                  description: 'Array of columns in this row',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                        description: 'Unique identifier for the column',
                      },
                      width: {
                        type: 'number',
                        description: 'Width percentage of the column',
                        minimum: 0,
                        maximum: 100,
                      },
                      fields: {
                        type: 'array',
                        description: 'Array of fields in this column',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                              description: 'Unique identifier for the field',
                            },
                            type: {
                              type: 'string',
                              description: 'Type of the field',
                              enum: [
                                'text',
                                'email',
                                'number',
                                'select',
                                'radio',
                                'checkbox',
                                'textarea',
                                'date',
                                'file',
                                'button',
                                'hidden',
                              ],
                            },
                            tag: {
                              type: 'string',
                              description: 'HTML tag for the field',
                              enum: ['input', 'textarea', 'select', 'button'],
                            },
                            label: {
                              type: 'string',
                              description: 'Display label for the field',
                            },
                            required: {
                              type: 'boolean',
                              description: 'Whether the field is required',
                            },
                            placeholder: {
                              type: 'string',
                              description: 'Placeholder text for the field',
                            },
                            value: {
                              type: 'string',
                              description: 'Default value for the field',
                            },
                            className: {
                              type: 'string',
                              description: 'CSS classes for the field',
                            },
                            name: {
                              type: 'string',
                              description: 'Name attribute for the field',
                            },
                            attrs: {
                              type: 'object',
                              description: 'Additional HTML attributes',
                              additionalProperties: true,
                            },
                            options: {
                              type: 'array',
                              description: 'Options for select, radio, or checkbox fields',
                              items: {
                                type: 'object',
                                properties: {
                                  label: {
                                    type: 'string',
                                    description: 'Display label for the option',
                                  },
                                  value: {
                                    type: 'string',
                                    description: 'Value of the option',
                                  },
                                  selected: {
                                    type: 'boolean',
                                    description: 'Whether the option is selected by default',
                                  },
                                  checked: {
                                    type: 'boolean',
                                    description: 'Whether the option is checked by default (for checkboxes/radios)',
                                  },
                                },
                                required: ['label', 'value'],
                              },
                            },
                            conditions: {
                              type: 'object',
                              description: 'Conditional logic for field visibility',
                              properties: {
                                action: {
                                  type: 'string',
                                  enum: ['show', 'hide'],
                                  description: 'Action to take when conditions are met',
                                },
                                operator: {
                                  type: 'string',
                                  enum: ['and', 'or'],
                                  description: 'Logical operator for multiple conditions',
                                },
                                rules: {
                                  type: 'array',
                                  description: 'Array of conditional rules',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      field: {
                                        type: 'string',
                                        description: 'ID of the field to check',
                                      },
                                      operator: {
                                        type: 'string',
                                        enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'],
                                        description: 'Comparison operator',
                                      },
                                      value: {
                                        type: 'string',
                                        description: 'Value to compare against',
                                      },
                                    },
                                    required: ['field', 'operator', 'value'],
                                  },
                                },
                              },
                            },
                          },
                          required: ['id', 'type', 'tag'],
                        },
                      },
                    },
                    required: ['id', 'fields'],
                  },
                },
              },
              required: ['id', 'columns'],
            },
          },
        },
        required: ['id', 'order', 'title', 'rows'],
      },
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata about the form',
      properties: {
        created: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp',
        },
        modified: {
          type: 'string',
          format: 'date-time',
          description: 'Last modification timestamp',
        },
        author: {
          type: 'string',
          description: 'Author of the form',
        },
        settings: {
          type: 'object',
          description: 'Form-wide settings',
          additionalProperties: true,
        },
      },
    },
  },
  required: ['formId', 'version', 'steps'],
}

const distDir = join(projectRoot, 'dist')
writeFileSync(join(distDir, 'runtime_schema.json'), JSON.stringify(runtimeSchemaDefinition, null, 2))

console.log('Runtime schema generated successfully')
