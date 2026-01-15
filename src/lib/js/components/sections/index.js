import ComponentData from '../component-data.js'
import Section from './section.js'

const DEFAULT_CONFIG = {
  actionButtons: {
    buttons: ['move', 'edit', 'remove'],
    disabled: [],
  },
}

export class Sections extends ComponentData {
  constructor(sectionData) {
    super('sections', sectionData)
    this.config = { all: DEFAULT_CONFIG }
  }
  Component(data) {
    return new Section(data)
  }
}

const sections = new Sections()

export default sections
